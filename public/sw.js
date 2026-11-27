// Hand-written service worker. Lesson must work in airplane mode after the first visit.
const VERSION = "man-v1";
const SHELL = ["/", "/teacher", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

// Pull every /_next/static asset referenced by a shell page, so chunks loaded
// before the worker took control are cached too.
async function precachePage(cache, url) {
  const res = await fetch(url, { cache: "reload" });
  if (!res.ok) return;
  await cache.put(url, res.clone());
  const html = await res.text();
  const assets = new Set();
  for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s\\]+)/g)) assets.add(m[1]);
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(SHELL.map((u) => (u === "/" || u === "/teacher" ? precachePage(cache, u) : cache.add(u).catch(() => undefined))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// The page sends the list of resources it already loaded (performance entries).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        data.urls
          .filter((u) => typeof u === "string" && u.startsWith(self.location.origin) && !u.includes("/api/"))
          .map(async (u) => {
            if (await cache.match(u)) return;
            await cache.add(u).catch(() => undefined);
          }),
      ),
    ),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|woff2|webmanifest|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    const key = url.pathname.startsWith("/teacher") ? "/teacher" : "/";
    event.respondWith(
      (async () => {
        try {
          const res = await withTimeout(fetch(req), 4000);
          if (res.ok) {
            const cache = await caches.open(VERSION);
            await cache.put(key, res.clone());
          }
          return res;
        } catch {
          const hit = (await caches.match(key)) || (await caches.match("/"));
          return hit || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  // Anything else same-origin (e.g. RSC payloads): network, then cache.
  event.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((h) => h || Response.error())));
});
