// Service worker: la app corre mejor con red fresca; el cache es el respaldo
// para que funcione offline. Las navegaciones (nesting, pocketcad, raiz) SIEMPRE
// van a la red: asi atras/recargar nunca muestran una version vieja.
var CACHE = "sparrow-nesting-v5";
var ARCHIVOS = [
  "./",
  "nesting.html",
  "app.js",
  "worker.js",
  "sparrow_app.js",
  "engine_base64.js",
  "sample.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ARCHIVOS).then(function () { return self.skipWaiting(); });
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (e.request.mode === "navigate") {
    // red primero; cache solo si hay error (offline)
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request, { ignoreSearch: true }).then(function (r) {
          return r || caches.match("./nesting.html");
        });
      })
    );
    return;
  }
  // assets de la app: cache primero
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (r) {
      if (r) return r;
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match("./nesting.html");
      });
    })
  );
});