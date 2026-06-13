/* sw-register.js — register the offline service worker.
 * Kept as an external file (not an inline <script>) because the site's CSP
 * script-src has no 'unsafe-inline'. Failures are harmless: the app works
 * the same without the SW, just without offline caching. */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
})();
