/* Service worker de Bitácora (solo se registra en https, ver 99-arranque.js).
   Navegación y HTML: red primero, caché de respaldo (para abrir la app sin conexión).
   Iconos y manifest: caché primero. Las llamadas al backend (otro origen) no se tocan. */
var CACHE = "bitacora-v1";
var ESTATICOS = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./icon-192.png", "./icon-512.png", "./icon-180.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.all(ESTATICOS.map(function (u) { return c.add(u).catch(function () { }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function esEstatico(url) { return /\.(png|svg|webmanifest|ico)$/.test(url.pathname); }

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // backend y terceros: sin intervenir

  if (esEstatico(url)) {
    e.respondWith(
      caches.match(req).then(function (r) {
        return r || fetch(req).then(function (res) {
          var copia = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
          return res;
        });
      })
    );
    return;
  }

  // navegación / HTML / resto: red primero, caché si falla
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && (req.mode === "navigate" || /\.html$/.test(url.pathname) || url.pathname.endsWith("/"))) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || (req.mode === "navigate" ? caches.match("./index.html") : undefined); });
    })
  );
});
