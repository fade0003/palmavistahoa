import type { LatLngExpression, Layer, Map as LeafletMap, Point, PointExpression } from "leaflet";
import { normalizeHeading, rotateScreenPoint } from "./heading";

type LeafletLib = typeof import("leaflet");

type InternalMap = LeafletMap & {
  _animatingZoom?: boolean;
  _getMapPanePos(): Point;
};

type IconLayer = Layer & {
  _icon?: HTMLElement;
  getLatLng?: () => { lat: number; lng: number };
  _setPos?: (pos: Point) => void;
  update?: () => void;
  eachLayer?: (fn: (layer: Layer) => void) => void;
};

export type MapBearing = {
  setHeading(degrees: number | null): void;
  refresh(): void;
  destroy(): void;
};

const ROTATED_PANES = ["tilePane", "overlayPane", "accuracy", "you"];

function isTileLayer(layer: Layer): layer is Layer & { redraw: () => void } {
  const candidate = layer as Layer & { redraw?: unknown; _url?: unknown };
  return typeof candidate.redraw === "function" && typeof candidate._url === "string";
}

/**
 * Turns the basemap around the view center while Follow me is on.
 * CSS angle is the opposite of the compass heading so the direction of
 * travel points to the top of the screen. Home markers stay upright and
 * are moved to the rotated screen position so taps still land on them.
 */
export function attachMapBearing(map: LeafletMap, L: LeafletLib): MapBearing {
  const internal = map as InternalMap;
  const panes = ROTATED_PANES.map((name) => map.getPane(name)).filter((pane): pane is HTMLElement => pane != null);
  const originalContainerToLayer = map.containerPointToLayerPoint.bind(map);
  const originalLayerToContainer = map.layerPointToContainerPoint.bind(map);

  let heading: number | null = null;
  let rotatedMode = false;
  let framing = false;

  function angle(): number {
    return heading == null ? 0 : -heading;
  }

  function center(): Point {
    const size = map.getSize();
    return L.point(size.x / 2, size.y / 2);
  }

  function pan(): Point {
    return internal._getMapPanePos();
  }

  function writeHeadingDataset() {
    const root = map.getContainer().closest(".violations-root");
    if (!(root instanceof HTMLElement)) return;
    if (heading == null) delete root.dataset.heading;
    else root.dataset.heading = String(Math.round(heading));
  }

  function applyTransforms() {
    const originPoint = center();
    const offset = pan();
    const origin = `${originPoint.x - offset.x}px ${originPoint.y - offset.y}px`;
    const transform = rotatedMode ? `rotate(${angle()}deg)` : "";
    for (const pane of panes) {
      pane.style.transformOrigin = rotatedMode ? origin : "";
      pane.style.transform = transform;
    }
    writeHeadingDataset();
  }

  function placeMarkers() {
    if (!rotatedMode || heading == null) return;
    const origin = center();
    const offset = pan();
    const cssAngle = angle();
    const visit = (layer: Layer) => {
      const iconLayer = layer as IconLayer;
      if (iconLayer.eachLayer && !iconLayer._icon) {
        iconLayer.eachLayer(visit);
        return;
      }
      if (!iconLayer._icon || !iconLayer.getLatLng || !iconLayer._setPos) return;
      const raw = map.latLngToLayerPoint(iconLayer.getLatLng());
      const rawContainer = originalLayerToContainer(raw);
      const rotated = rotateScreenPoint(rawContainer.x, rawContainer.y, cssAngle, origin.x, origin.y);
      iconLayer._setPos(L.point(rotated.x, rotated.y).subtract(offset));
    };
    map.eachLayer(visit);
  }

  function resetMarkers() {
    const visit = (layer: Layer) => {
      const iconLayer = layer as IconLayer;
      if (iconLayer.eachLayer && !iconLayer._icon) {
        iconLayer.eachLayer(visit);
        return;
      }
      iconLayer.update?.();
    };
    map.eachLayer(visit);
  }

  function expandTileCoverage(layer: Layer) {
    if (!isTileLayer(layer)) return;
    const tile = layer as unknown as {
      _pvExpanded?: boolean;
      _getTiledPixelBounds?: (center: LatLngExpression) => ReturnType<LeafletMap["getPixelBounds"]>;
    };
    if (tile._pvExpanded || typeof tile._getTiledPixelBounds !== "function") return;
    const original = tile._getTiledPixelBounds.bind(tile);
    tile._getTiledPixelBounds = (center) => {
      const bounds = original(center);
      if (!rotatedMode) return bounds;
      const middle = bounds.getCenter();
      const size = bounds.getSize();
      const half = Math.hypot(size.x, size.y) / 2;
      return L.bounds(L.point(middle.x - half, middle.y - half), L.point(middle.x + half, middle.y + half));
    };
    tile._pvExpanded = true;
  }

  function redrawTiles() {
    map.eachLayer((layer) => {
      expandTileCoverage(layer);
      if (isTileLayer(layer)) layer.redraw();
    });
  }

  function onMove() {
    if (!rotatedMode) return;
    applyTransforms();
    if (!internal._animatingZoom) placeMarkers();
  }

  function onSettled() {
    if (framing) return;
    framing = true;
    try {
      let expanded = false;
      map.eachLayer((layer) => {
        const tile = layer as Layer & { _pvExpanded?: boolean };
        const already = Boolean(tile._pvExpanded);
        expandTileCoverage(layer);
        if (!already && tile._pvExpanded) expanded = true;
      });
      if (!rotatedMode) return;
      if (expanded) redrawTiles();
      applyTransforms();
      placeMarkers();
    } finally {
      framing = false;
    }
  }

  map.containerPointToLayerPoint = ((point: PointExpression) => {
    if (!rotatedMode || heading == null) return originalContainerToLayer(point);
    const projected = L.point(point);
    const origin = center();
    const unrotated = rotateScreenPoint(projected.x, projected.y, -angle(), origin.x, origin.y);
    return originalContainerToLayer(L.point(unrotated.x, unrotated.y));
  }) as LeafletMap["containerPointToLayerPoint"];

  map.layerPointToContainerPoint = ((point: PointExpression) => {
    const container = originalLayerToContainer(point);
    if (!rotatedMode || heading == null) return container;
    const origin = center();
    const rotated = rotateScreenPoint(container.x, container.y, angle(), origin.x, origin.y);
    return L.point(rotated.x, rotated.y);
  }) as LeafletMap["layerPointToContainerPoint"];

  map.on("move", onMove);
  map.on("zoomend", onSettled);
  map.on("viewreset", onSettled);
  map.on("layeradd", onSettled);

  return {
    setHeading(degrees: number | null) {
      heading = degrees == null || !Number.isFinite(degrees) ? null : normalizeHeading(degrees);
      const want = heading != null && Math.min(heading, 360 - heading) >= 0.5;
      const entered = want && !rotatedMode;
      const left = !want && rotatedMode;
      rotatedMode = want;
      if (left) {
        applyTransforms();
        resetMarkers();
        redrawTiles();
        return;
      }
      if (entered) redrawTiles();
      applyTransforms();
      if (want) placeMarkers();
    },
    refresh() {
      if (!rotatedMode) return;
      applyTransforms();
      placeMarkers();
    },
    destroy() {
      map.off("move", onMove);
      map.off("zoomend", onSettled);
      map.off("viewreset", onSettled);
      map.off("layeradd", onSettled);
      rotatedMode = false;
      heading = null;
      applyTransforms();
      map.containerPointToLayerPoint = originalContainerToLayer;
      map.layerPointToContainerPoint = originalLayerToContainer;
    },
  };
}
