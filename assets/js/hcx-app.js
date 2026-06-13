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
    assassination: function () { return window.AssassinationPage(); }
  };

  // Cross-page pending-mint banner. Edge case: the user navigated off /#packs
  // before a hash-less mint (Coinbase Wallet) resolved. The packs page resolves
  // inline; everywhere else we confirm the Mined event landed, then float a
  // banner linking back to packs (which then runs the reveal). Lives on <body>
  // so it survives the route re-renders that wipe #root. Never clears the
  // pending record — the packs page owns the reveal and the cleanup.
  function pendingBanner() {
    var C = window.HCX_CHAIN;
    if (!C || !C.pendingMint) return;
    var existing = document.getElementById("hcx-mint-banner");
    var rec = C.pendingMint();
    var route = window.useRouter().route;
    // Suppress on packs (resolved inline), for the hash path, and after the
    // 10-min window the packs page uses to give up.
    if (!rec || !rec.wallet || rec.hash || route === "packs" || (Date.now() - rec.t) > 600000) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;                 // already shown — don't re-query each tick
    C.findRecentMint(rec.wallet, rec.fromBlock).then(function (m) {
      if (!m) return;
      if (document.getElementById("hcx-mint-banner")) return;
      if (window.useRouter().route === "packs") return;
      var bar = h("div", { id: "hcx-mint-banner", role: "button", tabIndex: 0,
        onClick: function () { window.useRouter().go("packs"); },
        style: { position: "fixed", left: "50%", top: "16px", transform: "translateX(-50%)", zIndex: 250,
          display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", maxWidth: "92vw",
          background: "linear-gradient(180deg,#1b1812,#141117)", color: "#ece7d8",
          border: "1px solid #d49a59", borderRadius: "9px", padding: "12px 18px",
          font: "600 12.5px/1.3 ui-monospace,monospace", letterSpacing: ".02em",
          boxShadow: "0 18px 50px -18px #000, 0 0 0 1px #ffffff10" } },
        h("span", { style: { color: "#c98a4b" } }, "◆"),
        h("span", null, "Your mint arrived! "),
        h("span", { style: { color: "#c98a4b", textDecoration: "underline" } }, "View your card →"));
      document.body.appendChild(bar);
    }).catch(function () {});
  }

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
    var renderedRoute = null;
    function renderPage() {
      // Don't tear down an in-progress pack reveal / mint on a same-route
      // re-render. wallet.notify() (fired by refreshMinted/loadOwned) lands
      // right in the middle of the reveal animation and would otherwise destroy
      // the PackOpener mid-flight — the root cause of the mint never showing.
      // A real route change always rebuilds (and clears the flag below).
      if (router.route === renderedRoute && window.__hcxPackBusy) return;   // chrome already refreshed by renderAll
      renderedRoute = router.route;
      window.__hcxPackBusy = false;   // cleared on every real rebuild; PackOpener re-asserts it if needed
      var fn = ROUTES[router.route] || ROUTES.home;
      mainHost.innerHTML = "";
      mainHost.appendChild(fn());
      // After paint (non-blocking), pull live minted counts — one batched
      // Multicall3 call, TTL-cached so navigation doesn't refetch.
      setTimeout(function () { if (window.HCX_CHAIN) window.HCX_CHAIN.ensureMinted(); }, 0);
    }
    function renderAll() { renderChrome(); renderPage(); pendingBanner(); }

    router.subscribe(renderAll);
    wallet.subscribe(renderAll);
    if (window.useAuth) window.useAuth().subscribe(renderAll);

    root.appendChild(navHost);
    root.appendChild(mainHost);
    root.appendChild(footHost);
    renderAll();
    setInterval(pendingBanner, 12000);   // catch a mint that lands while off the packs page
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
