/* hcx-app.js — router + wallet wiring + mount. Vanilla port of app.jsx.
 * The whole route (and nav chrome) re-renders on route or wallet change. */
(function () {
  "use strict";
  var h = window.h;

  var ROUTES = {
    home: function () { return window.Landing(); },
    packs: function () { return window.PacksPage(); },
    collection: function () { return window.CollectionPage(); },
    roster: function () { return window.RosterPage(); },
    play: function () { return window.PlayHub(); },
    timeline: function () { return window.TimelinePage(); },
    battle: function () { return window.BattlePage(); },
    draft: function () { return window.DraftPage(); },
    assassination: function () { return window.AssassinationPage(); },
    components: function () { return window.ComponentsPage(); },
    mobile: function () { return window.MobilePage(); }
  };

  function mount() {
    var router = window.useRouter(), wallet = window.useWallet();
    var root = document.getElementById("root");
    root.innerHTML = "";

    var navHost = h("div", null);
    var mainHost = h("main", { style: { minHeight: "70vh", paddingBottom: "20px" } });
    var footHost = h("div", null);

    function renderChrome() {
      navHost.innerHTML = ""; navHost.appendChild(window.Nav());
      footHost.innerHTML = ""; footHost.appendChild(window.Footer());
    }
    function renderPage() {
      var fn = ROUTES[router.route] || ROUTES.home;
      mainHost.innerHTML = "";
      mainHost.appendChild(fn());
    }
    function renderAll() { renderChrome(); renderPage(); }

    router.subscribe(renderAll);
    wallet.subscribe(renderAll);

    root.appendChild(navHost);
    root.appendChild(mainHost);
    root.appendChild(footHost);
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
