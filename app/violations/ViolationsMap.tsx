"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Circle, CircleMarker, LayerGroup, Map as LeafletMap, Marker, TileLayer } from "leaflet";
import { FieldPanel, latestHomeFieldLine } from "./FieldPanel";
import { TopChrome, type ChromePanel } from "./TopChrome";
import { driveSessionStart, shareFieldReport } from "./field/share";
import { useFieldLog } from "./field/useFieldLog";
import { formatDistance, formatMoney, haversineMeters } from "./geo";
import { homeFieldCleared } from "../../lib/field/match";
import {
  angularDelta,
  chooseHeading,
  headingFromOrientation,
  requestCompassAccess,
  smoothHeading,
} from "./heading";
import { localSearchParam, readDemoGeo, readDemoHeading } from "./local-demo";
import { attachMapBearing, type MapBearing } from "./map-bearing";
import {
  isViolationsData,
  matchesFilter,
  owesMoney,
  statusLabel,
  type Home,
  type HomeFilter,
  type HomeStatus,
  type ViolationsData,
} from "./types";
import "leaflet/dist/leaflet.css";
import "./violations.css";

type LeafletLib = typeof import("leaflet");
type SheetState = "closed" | "peek" | "expanded";
type GeoFix = { lat: number; lon: number; accuracy: number };

const ESRI =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CENTER: [number, number] = [28.501, -81.459];
const AUTO_OPEN_METERS = 30;

function resolveLeaflet(mod: LeafletLib): LeafletLib {
  const wrapped = mod as LeafletLib & { default?: LeafletLib };
  if (wrapped.default && typeof wrapped.default.map === "function") return wrapped.default;
  return mod;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

function markerHtml(address: string, status: HomeStatus, selected: boolean, fieldOk: boolean): string {
  const selectedClass = selected ? " is-selected" : "";
  const fieldClass = fieldOk ? " is-field-ok" : "";
  const badge = fieldOk ? `<span class="pv-check" aria-hidden="true">✓</span>` : "";
  const label = escapeHtml(`${address}, ${statusLabel(status)}${fieldOk ? ", field resolved" : ""}`);
  return `<div class="pv-marker pv-marker-${status}${selectedClass}${fieldClass}" role="img" aria-label="${label}">${badge}</div>`;
}

export default function ViolationsMap() {
  const searchId = useId();
  const listId = useId();
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletLib | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const imageryRef = useRef<TileLayer | null>(null);
  const streetRef = useRef<TileLayer | null>(null);
  const youDot = useRef<CircleMarker | null>(null);
  const youAcc = useRef<Circle | null>(null);
  const selectRef = useRef<(id: string, source: "map" | "search" | "nearest") => void>(() => {});
  const followRef = useRef(false);
  const homesRef = useRef<Home[]>([]);
  const autoOpenRef = useRef(false);
  const suppressRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const dragRef = useRef<{ y: number } | null>(null);
  const lastPan = useRef<GeoFix | null>(null);
  const fitted = useRef(false);
  const bearingRef = useRef<MapBearing | null>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const youArrow = useRef<Marker | null>(null);
  const geoRef = useRef<GeoFix | null>(null);
  const courseRef = useRef<number | null>(null);
  const speedRef = useRef<number | null>(null);
  const compassRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const displayedHeading = useRef<number | null>(null);
  const [compassAllowed, setCompassAllowed] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const [data, setData] = useState<ViolationsData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HomeFilter>("all");
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<ChromePanel>(null);
  const [clearedIds, setClearedIds] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const field = useFieldLog();
  const [follow, setFollow] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>("closed");
  const [basemap, setBasemap] = useState<"satellite" | "street">("satellite");
  const [suppressAutoId, setSuppressAutoId] = useState<string | null>(null);

  const homes = useMemo(() => {
    if (!data) return [];
    return data.homes.filter(
      (home) => Number.isFinite(home.lat) && Number.isFinite(home.lon) && Boolean(home.address),
    );
  }, [data]);

  const activeHome = homes.find((home) => home.id === activeId) ?? null;

  const selectHome = useCallback((id: string, source: "map" | "search" | "nearest") => {
    if (source === "search") setFollow(false);
    suppressRef.current = null;
    activeIdRef.current = id;
    setSuppressAutoId(null);
    setActiveId(id);
    setSheet("peek");
    setQuery("");
    setPanel(null);
  }, []);

  const considerAutoOpen = useCallback((fix: GeoFix) => {
    if (!followRef.current || !autoOpenRef.current) return;
    const closest = homesRef.current
      .filter((home) => home.status === "red" || home.status === "orange")
      .map((home) => ({ home, meters: haversineMeters(fix, home) }))
      .sort((a, b) => a.meters - b.meters)[0];
    if (!closest || closest.meters > AUTO_OPEN_METERS) return;
    if (closest.home.id === suppressRef.current) return;
    if (activeIdRef.current === closest.home.id) return;
    suppressRef.current = null;
    activeIdRef.current = closest.home.id;
    setSuppressAutoId(null);
    setActiveId(closest.home.id);
    setSheet("peek");
  }, []);

  useEffect(() => {
    followRef.current = follow;
    homesRef.current = homes;
    autoOpenRef.current = autoOpen;
    suppressRef.current = suppressAutoId;
    activeIdRef.current = activeId;
    selectRef.current = selectHome;
  }, [follow, homes, autoOpen, suppressAutoId, activeId, selectHome]);

  const closeSheet = useCallback(() => {
    if (activeIdRef.current) {
      suppressRef.current = activeIdRef.current;
      setSuppressAutoId(activeIdRef.current);
    }
    activeIdRef.current = null;
    setActiveId(null);
    setSheet("closed");
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("violations-lock");
    return () => document.documentElement.classList.remove("violations-lock");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panel) setPanel(null);
      else closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSheet, panel]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/violations/data", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setDataError("Cloudflare Access did not authorize this browser. Sign in and try again.");
          } else if (response.status === 404) {
            setDataError("No violations data has been loaded yet.");
          } else {
            setDataError("Could not load violations data.");
          }
          return;
        }
        const body: unknown = await response.json();
        if (!isViolationsData(body)) {
          setDataError("Violations data is not in the expected shape.");
          return;
        }
        setData(body);
        const requestedHome = localSearchParam("home");
        if (requestedHome && body.homes.some((home) => home.id === requestedHome)) {
          setActiveId(requestedHome);
          setSheet("peek");
        }
        if (localSearchParam("follow") === "1") setFollow(true);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setDataError("Could not load violations data.");
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = resolveLeaflet(await import("leaflet"));
        if (cancelled || !mapElement.current || mapRef.current) return;
        const map = L.map(mapElement.current, {
          zoomControl: false,
          attributionControl: true,
          maxZoom: 19,
        }).setView(CENTER, 16);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.createPane("accuracy");
        map.createPane("you");
        const accuracyPane = map.getPane("accuracy");
        const youPane = map.getPane("you");
        if (accuracyPane) {
          accuracyPane.style.zIndex = "450";
          accuracyPane.style.pointerEvents = "none";
        }
        if (youPane) {
          youPane.style.zIndex = "650";
          youPane.style.pointerEvents = "none";
        }
        map.createPane("heading");
        const headingPane = map.getPane("heading");
        if (headingPane) {
          headingPane.style.zIndex = "680";
          headingPane.style.pointerEvents = "none";
        }
        bearingRef.current = attachMapBearing(map, L);
        imageryRef.current = L.tileLayer(ESRI, { attribution: ESRI_ATTR, maxZoom: 19 });
        streetRef.current = L.tileLayer(OSM, { attribution: OSM_ATTR, maxZoom: 19 });
        markersRef.current = L.layerGroup().addTo(map);
        map.on("dragstart", () => {
          if (!followRef.current) return;
          followRef.current = false;
          bearingRef.current?.setHeading(null);
          setFollow(false);
        });
        if (cancelled) {
          map.remove();
          return;
        }
        leafletRef.current = L;
        mapRef.current = map;
        setMapReady(true);
        requestAnimationFrame(() => map.invalidateSize());
      } catch (err) {
        console.error(err);
        if (!cancelled) setMapError("The map could not start in this browser.");
      }
    })();
    return () => {
      cancelled = true;
      youArrow.current?.remove();
      youArrow.current = null;
      bearingRef.current?.destroy();
      bearingRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = null;
      imageryRef.current = null;
      streetRef.current = null;
      youDot.current = null;
      youAcc.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const show = basemap === "satellite" ? imageryRef.current : streetRef.current;
    const hide = basemap === "satellite" ? streetRef.current : imageryRef.current;
    hide?.remove();
    show?.addTo(map);
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const layer = markersRef.current;
    if (!map || !L || !layer || !mapReady) return;
    layer.clearLayers();
    const visible = homes.filter((home) => matchesFilter(home, filter) || home.id === activeId);
    for (const home of visible) {
      const marker = L.marker([home.lat, home.lon], {
        icon: L.divIcon({
          className: "pv-divicon",
          html: markerHtml(home.address, home.status, home.id === activeId, clearedIds.includes(home.id)),
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: true,
        title: home.address,
      });
      marker.on("click", () => selectRef.current(home.id, "map"));
      marker.addTo(layer);
    }
    if (!fitted.current && homes.length > 0) {
      const bounds = L.latLngBounds(homes.map((home) => [home.lat, home.lon] as [number, number]));
      map.fitBounds(bounds, {
        paddingTopLeft: [24, 72],
        paddingBottomRight: [24, 80],
        maxZoom: 17,
        animate: false,
      });
      fitted.current = true;
    }
    youDot.current?.bringToFront();
  }, [homes, filter, activeId, mapReady, clearedIds]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady || !activeHome || follow) return;
    const zoom = Math.max(map.getZoom(), 17);
    const point = map.project([activeHome.lat, activeHome.lon], zoom);
    point.y += 90;
    map.setView(map.unproject(point, zoom), zoom, { animate: true });
  }, [activeId, activeHome, follow, mapReady]);

  const showHeading = useCallback((degrees: number | null) => {
    bearingRef.current?.setHeading(degrees);
    if (needleRef.current) needleRef.current.style.transform = `rotate(${-(degrees ?? 0)}deg)`;
    const map = mapRef.current;
    const L = leafletRef.current;
    const fix = geoRef.current;
    if (!map || !L || degrees == null || !fix) {
      youArrow.current?.remove();
      youArrow.current = null;
      return;
    }
    const latlng: [number, number] = [fix.lat, fix.lon];
    if (!youArrow.current) {
      youArrow.current = L.marker(latlng, {
        pane: "heading",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "pv-you-icon",
          html: '<div class="pv-you-arrow"></div>',
          iconSize: [28, 40],
          iconAnchor: [14, 40],
        }),
      }).addTo(map);
    } else {
      youArrow.current.setLatLng(latlng);
    }
    bearingRef.current?.refresh();
  }, []);

  const publishHeading = useCallback(() => {
    if (!followRef.current) {
      smoothedRef.current = null;
      displayedHeading.current = null;
      showHeading(null);
      return;
    }
    const demo = readDemoHeading();
    const target = chooseHeading({
      demo,
      course: courseRef.current,
      speed: speedRef.current,
      compass: compassRef.current,
    });
    if (target == null) {
      smoothedRef.current = null;
      displayedHeading.current = null;
      showHeading(null);
      return;
    }
    const next = demo == null ? smoothHeading(smoothedRef.current, target, 0.45) : target;
    smoothedRef.current = next;
    if (displayedHeading.current != null && Math.abs(angularDelta(displayedHeading.current, next)) < 0.8) return;
    displayedHeading.current = next;
    showHeading(next);
  }, [showHeading]);

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!follow) {
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      lastPan.current = null;
      courseRef.current = null;
      speedRef.current = null;
      compassRef.current = null;
      smoothedRef.current = null;
      displayedHeading.current = null;
      showHeading(null);
      return;
    }
    followRef.current = true;

    let stopWatch = () => {};
    const demo = readDemoGeo();
    if (demo) {
      const emit = () => {
        const fix = { lat: demo.lat, lon: demo.lon, accuracy: 18 };
        geoRef.current = fix;
        setGeo(fix);
        considerAutoOpen(fix);
        publishHeading();
      };
      emit();
      const id = window.setInterval(emit, 2000);
      stopWatch = () => window.clearInterval(id);
    } else if (!navigator.geolocation) {
      queueMicrotask(() => {
        setGeoError("This browser does not share location. Search or tap a home instead.");
        setFollow(false);
      });
    } else {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const fix = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          const course = position.coords.heading;
          const speed = position.coords.speed;
          courseRef.current = typeof course === "number" && Number.isFinite(course) ? course : null;
          speedRef.current = typeof speed === "number" && Number.isFinite(speed) ? speed : null;
          geoRef.current = fix;
          setGeo(fix);
          setGeoError(null);
          considerAutoOpen(fix);
          publishHeading();
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeoError("Location permission denied. You can still search and tap homes.");
          } else if (err.code === err.TIMEOUT) {
            setGeoError("Location timed out. Try Follow me again.");
          } else {
            setGeoError("Could not read your location.");
          }
          setFollow(false);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
      );
      stopWatch = () => navigator.geolocation.clearWatch(id);
    }

    void requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible" && followRef.current) void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopWatch();
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [follow, mapReady, requestWakeLock, considerAutoOpen, publishHeading, showHeading]);

  useEffect(() => {
    if (!follow || !compassAllowed) return;
    let sawAbsolute = false;
    const apply = (event: DeviceOrientationEvent, absoluteEvent: boolean) => {
      const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const next = headingFromOrientation({
        alpha: event.alpha,
        absolute: Boolean(event.absolute || absoluteEvent),
        webkitCompassHeading: webkit,
      });
      if (next == null) return;
      if (absoluteEvent) sawAbsolute = true;
      if (!absoluteEvent && sawAbsolute) return;
      compassRef.current = next;
      publishHeading();
    };
    const onAbsolute = (event: Event) => apply(event as DeviceOrientationEvent, true);
    const onDevice = (event: Event) => apply(event as DeviceOrientationEvent, false);
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    window.addEventListener("deviceorientation", onDevice);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
      window.removeEventListener("deviceorientation", onDevice);
    };
  }, [follow, compassAllowed, publishHeading]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady || !geo || !follow) return;
    const moved = !lastPan.current || haversineMeters(lastPan.current, geo) > 2;
    if (!lastPan.current) {
      map.setView([geo.lat, geo.lon], Math.max(map.getZoom(), 18), { animate: true });
      lastPan.current = geo;
    } else if (moved) {
      map.panTo([geo.lat, geo.lon], { animate: true, duration: 0.5 });
      lastPan.current = geo;
    }
    const radius = Math.min(120, Math.max(8, geo.accuracy || 20));
    if (!youAcc.current) {
      youAcc.current = L.circle([geo.lat, geo.lon], {
        radius,
        pane: "accuracy",
        interactive: false,
        color: "#2563eb",
        weight: 1,
        fillColor: "#2563eb",
        fillOpacity: 0.15,
      }).addTo(map);
    } else {
      youAcc.current.setLatLng([geo.lat, geo.lon]);
      youAcc.current.setRadius(radius);
    }
    if (!youDot.current) {
      youDot.current = L.circleMarker([geo.lat, geo.lon], {
        radius: 8,
        pane: "you",
        interactive: false,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      youDot.current.setLatLng([geo.lat, geo.lon]);
    }
    youDot.current.bringToFront();
  }, [geo, follow, mapReady]);

  const nearest = useMemo(() => {
    if (!geo) return [];
    return homes
      .filter((home) => home.status === "red" || home.status === "orange")
      .map((home) => ({ home, meters: haversineMeters(geo, home) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, 3);
  }, [geo, homes]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return homes.filter((home) => home.address.toLowerCase().includes(q)).slice(0, 8);
  }, [homes, query]);

  const counts = useMemo(
    () => ({
      all: homes.length,
      red: homes.filter((home) => home.status === "red").length,
      orange: homes.filter((home) => home.status === "orange").length,
      owes: homes.filter(owesMoney).length,
    }),
    [homes],
  );

  function onHeadPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHeadPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = null;
    if (dy <= -40) setSheet("expanded");
    else if (dy >= 40) closeSheet();
    else if (Math.abs(dy) < 12) setSheet((current) => (current === "expanded" ? "peek" : "expanded"));
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const ids: string[] = [];
      for (const home of homes) {
        if (await homeFieldCleared(home, field.entries)) ids.push(home.id);
      }
      if (!cancel) setClearedIds(ids);
    })();
    return () => {
      cancel = true;
    };
  }, [homes, field.entries]);

  async function exportReport(scope: "home" | "drive" | "week" | "all") {
    try {
      const from =
        scope === "drive"
          ? driveSessionStart()
          : scope === "week"
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : undefined;
      const message = await shareFieldReport({
        homes,
        entries: field.entries,
        homeId: scope === "home" ? activeId ?? undefined : undefined,
        from,
      });
      setExportMessage(message);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setExportMessage(err instanceof Error ? err.message : "Could not export.");
    }
  }

  const sheetState: SheetState = activeHome ? sheet : "closed";
  const owed = activeHome?.arrears?.total ?? 0;
  const fieldLine = activeHome ? latestHomeFieldLine(activeHome.id, field.entries) : null;

  return (
    <div
      className="violations-root"
      data-sheet={sheetState}
      data-follow={follow ? "on" : "off"}
    >
      <div ref={mapElement} className="violations-map" />

      <h1 className="sr-only">Violations map</h1>
      {follow && (
        <div className="north-chip" role="img" aria-label="North. The map turns so ahead is up.">
          <div ref={needleRef} className="north-needle" aria-hidden="true">
            <span>N</span>
          </div>
        </div>
      )}

      <TopChrome
        panel={panel}
        setPanel={setPanel}
        query={query}
        setQuery={setQuery}
        results={results}
        onSelect={(id) => selectHome(id, "search")}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        data={data}
        pendingCount={field.pendingCount}
        onExportDrive={() => void exportReport("drive")}
        onExportWeek={() => void exportReport("week")}
        onExportAll={() => void exportReport("all")}
        searchId={searchId}
        listId={listId}
      />

      {(dataError || mapError || geoError || field.storageError || exportMessage) && (
        <div className="banner alert-banner" role="alert">
          <p>{dataError || mapError || geoError || field.storageError || exportMessage}</p>
          <button
            type="button"
            onClick={() => {
              setDataError(null);
              setMapError(null);
              setGeoError(null);
              field.clearStorageError();
              setExportMessage(null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="dock">
        {follow && (
          <div className="nearest" aria-label="Nearest homes with open items">
            {nearest.length === 0 && (
              <div className="nearest-card">
                <strong>No open homes nearby</strong>
                <em>Waiting for location</em>
              </div>
            )}
            {nearest.map(({ home, meters }) => (
              <button
                key={home.id}
                type="button"
                className="nearest-card"
                onClick={() => selectHome(home.id, "nearest")}
              >
                <strong>
                  <i className={`dot dot-${home.status}`} /> {home.address}
                </strong>
                <em>
                  {formatDistance(meters)} · {statusLabel(home.status)}
                </em>
              </button>
            ))}
          </div>
        )}
        <div className="dock-row">
          {follow && (
            <button
              type="button"
              className="tool-button"
              aria-pressed={autoOpen}
              onClick={() => {
                const next = !autoOpen;
                autoOpenRef.current = next;
                setAutoOpen(next);
                if (next && geo) considerAutoOpen(geo);
              }}
            >
              Auto 30 m
            </button>
          )}
          <button
            type="button"
            className="tool-button"
            onClick={() => setBasemap((current) => (current === "satellite" ? "street" : "satellite"))}
            aria-label={basemap === "satellite" ? "Switch to street map" : "Switch to satellite"}
          >
            {basemap === "satellite" ? "Street" : "Satellite"}
          </button>
          <button
            type="button"
            className="follow-button"
            aria-pressed={follow}
            aria-label={follow ? "Following. The map is turned to your direction." : "Follow me"}
            onClick={() => {
              if (follow) {
                setFollow(false);
                return;
              }
              setGeoError(null);
              void requestCompassAccess().then((allowed) => setCompassAllowed(allowed));
              setFollow(true);
              void requestWakeLock();
            }}
          >
            {follow ? "Following" : "Follow me"}
          </button>
        </div>
      </div>

      {activeHome && (
        <section
          className="sheet"
          data-state={sheet === "closed" ? "peek" : sheet}
          role="dialog"
          aria-modal="false"
          aria-labelledby="violation-sheet-title"
          onPointerDown={() => mapRef.current?.dragging.disable()}
          onPointerUp={() => mapRef.current?.dragging.enable()}
          onPointerCancel={() => mapRef.current?.dragging.enable()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div
            className="sheet-head"
            onPointerDown={onHeadPointerDown}
            onPointerUp={onHeadPointerUp}
          >
            <div className="grabber" aria-hidden="true" />
            <div className="sheet-title">
              <h2 id="violation-sheet-title">{activeHome.address}</h2>
              <button
                type="button"
                className="close-button"
                aria-label="Close"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={closeSheet}
              >
                ×
              </button>
            </div>
            <p className="status-line">
              <i className={`dot dot-${activeHome.status}`} />
              {statusLabel(activeHome.status)}
              {activeHome.arrears?.collection ? ` · ${activeHome.arrears.collection}` : ""}
            </p>
            <p className="counts-line">
              {activeHome.violations.length} violations · {activeHome.architectural.length} architectural · {formatMoney(owed)} owed
            </p>
            {fieldLine && <p className="field-line peek-field">{fieldLine}</p>}
            <button
              type="button"
              className="details-button"
              aria-expanded={sheet === "expanded"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setSheet((current) => (current === "expanded" ? "peek" : "expanded"))}
            >
              {sheet === "expanded" ? "Show less" : "Details"}
            </button>
          </div>
          {sheet === "expanded" && (
            <div className="sheet-scroll">
              <FieldPanel
                home={activeHome}
                entries={field.entries}
                viewerEmail={field.viewerEmail}
                position={geo}
                busy={field.flushing}
                onCreate={field.create}
                onPatch={field.patch}
                onDelete={field.remove}
                onExport={() => exportReport("home")}
              />
              <h3>Arrears</h3>
              {activeHome.arrears ? (
                <div className="arrears-card">
                  <p>Total {formatMoney(activeHome.arrears.total)}</p>
                  <p>Past due {formatMoney(activeHome.arrears.pastDue)}</p>
                  <p>{activeHome.arrears.collection ?? "Not in collection"}</p>
                </div>
              ) : (
                <p className="empty-copy">No balance on file</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
