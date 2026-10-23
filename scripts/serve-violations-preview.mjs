// Local preview of the static export plus the fake violations fixture.
// Binds to localhost only. Does not check Cloudflare Access and never reads KV.

import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = resolve("out");
const fixturePath = resolve("fixtures/violations.sample.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".pdf": "application/pdf",
};

function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  if (decoded.includes("\0")) return null;
  const relative = normalize(decoded).replace(/^[/\\]+/, "").replace(/^(\.\.(\/|\\|$))+/, "");
  const candidates = [
    join(root, relative),
    join(root, `${relative}.html`),
    join(root, relative, "index.html"),
  ];
  for (const candidate of candidates) {
    const full = resolve(candidate);
    if (!full.startsWith(root)) continue;
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

if (!existsSync(root)) {
  console.error("Missing out/. Run npm run build first.");
  process.exit(1);
}

const fixture = readFileSync(fixturePath, "utf8");
const sample = JSON.parse(fixture);
const openHome = sample.homes.find((home) => home.status === "red" || home.status === "orange");
const demoLat = openHome ? (openHome.lat + 50 / 111320).toFixed(6) : "28.501000";
const demoLon = openHome ? openHome.lon.toFixed(6) : "-81.459000";

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/violations/data" || url.pathname === "/violations/data/") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    });
    res.end(fixture);
    return;
  }

  const file = fileFor(url.pathname === "/" ? "/index.html" : url.pathname);
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  res.end(readFileSync(file));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Violations preview at http://127.0.0.1:${port}/violations`);
  console.log(`Map with sheet: http://127.0.0.1:${port}/violations?home=${openHome?.id ?? ""}`);
  console.log(
    `Follow-me strip: http://127.0.0.1:${port}/violations?demoGeo=${demoLat},${demoLon}&follow=1`,
  );
});
