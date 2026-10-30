// Service worker: la app corre mejor con red fresca; el cache es el respaldo
// para que funcione offline. Las navegaciones (nesting, pocketcad, raiz) SIEMPRE
// van a la red: asi atras/recargar nunca muestran una version vieja.
var CACHE = "sparrow-nesting-v9";
var ARCHIVOS = [
  "./",
  "nesting.html",
  "nesting_app.js",
  "nesting_worker.js",
  "wasm/nesting.wasm.js",
  "wasm/nesting.wasm"
];

self.addEventListener("install", function (e) {
  // "cache: reload" obliga a traer los archivos de la red: si no, el navegador
  // puede devolver su copia vieja (GitHub Pages deja 10 min de cache HTTP) y
  // el cache del service worker quedaria con la version anterior.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ARCHIVOS.map(function (u) {
      return fetch(new Request(u, { cache: "reload" })).then(function (res) {
        if (res && res.ok) return c.put(u, res);
      });
    })).then(function () { return self.skipWaiting(); });
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