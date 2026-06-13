/* sw.js — HumanityCards offline cache.
 *
 * Strategy: cache-first for same-origin static GETs (the JS/CSS/data that make
 * up the app and games), so a repeat visit — or a flaky mobile / in-app browser
 * connection — still plays. Precache the app shell so the very first offline
 * load works; everything else is cached the first time it's fetched online.
 *
 * Bump CACHE_VERSION whenever shipping changed assets (kept in step with the
 * ?v= query on the <script> tags in index.html) so old caches are evicted.
 */
var CACHE_VERSION = "v22";
var CACHE = "hcx-" + CACHE_VERSION;

// Version-less shell: enough to boot the app offline. Versioned JS is picked up
// by the runtime cache-first handler below, so this list never has to track ?v=.
var SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // add() each entry so one 404 can't fail the whole install
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;                       // never cache POSTs (score submits)

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;        // skip the CDN + the cross-origin API
  if (url.pathname.indexOf("/api/") === 0) return;        // dynamic — always hit the network

  // Navigations: serve the cached shell when the network is unreachable, so the
  // standalone PWA opens offline instead of showing the browser error page.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match("./index.html"); });
      })
    );
    return;
  }

  // Static assets: cache-first, then fill the cache on first online fetch.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
