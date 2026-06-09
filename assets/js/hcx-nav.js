/* hcx-nav.js — vanilla port of nav.jsx. Fixed top nav, wallet connect, footer. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  var NAV_LINKS = [
    { id: "packs", label: "Packs" },
    { id: "collection", label: "Collection" },
    { id: "roster", label: "Roster" },
    { id: "play", label: "Play" }
  ];

  function Logo() {
    var r = window.useRouter();
    return h("a", { href: "#home", onClick: function (e) { e.preventDefault(); r.go("home"); },
      style: { display: "inline-flex", alignItems: "baseline", gap: "10px", textDecoration: "none", color: INK } },
      h("span", { className: "logo-word", style: { font: "700 17px/1 " + MONO, letterSpacing: ".02em" } }, "Humanity"),
      h("span", { className: "logo-word", style: { font: "700 17px/1 " + MONO, letterSpacing: ".02em",
        background: "linear-gradient(180deg,#f0d2a6,#c98a4b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, "Cards"),
      h("span", { className: "logo-hcx", style: { marginLeft: "4px", font: "600 9.5px/1 " + MONO, letterSpacing: ".22em", color: FAINT,
        border: "1px solid " + RULE, padding: "3px 5px", borderRadius: "3px", transform: "translateY(-1px)" } }, "HCX"));
  }

  function WalletButton() {
    var w = window.useWallet();
    if (!w.connected) return window.Btn({ size: "sm", disabled: w.connecting, onClick: w.toggle }, w.connecting ? "Connecting…" : "Connect Wallet");
    var wrongNet = w.chainId != null && w.chainId !== 1;
    return h("button", { onClick: w.toggle, title: wrongNet ? "Wrong network — switch to Ethereum Mainnet" : "Click to disconnect",
      style: { display: "inline-flex", alignItems: "center", gap: "9px", cursor: "pointer",
        background: PANEL, border: "1px solid " + (wrongNet ? "#d0563a" : RULE), borderRadius: "4px", padding: "8px 13px",
        font: "600 12px/1 " + MONO, letterSpacing: ".08em", color: wrongNet ? "#d0563a" : INK } },
      h("span", { style: { width: "7px", height: "7px", borderRadius: "50%", background: wrongNet ? "#d0563a" : "#5fae6e", boxShadow: "0 0 8px " + (wrongNet ? "#d0563a" : "#5fae6e") } }),
      wrongNet ? "Wrong Network" : window.shortAddr(w.address));
  }

  function Nav() {
    var r = window.useRouter();
    var routeBase = r.route;
    var playRoutes = ["play", "timeline", "battle", "draft", "assassination"];
    var menuOpen = false;
    function linkActive(l) { return routeBase === l.id || (l.id === "play" && playRoutes.indexOf(routeBase) >= 0); }

    var burgerBars = ["0", "5px", "10px"].map(function (top, i) {
      return h("span", { "data-i": i, style: { position: "absolute", left: 0, top: top, width: "16px", height: "1.6px", background: INK, transition: "transform .2s" } });
    });
    var mobileDrop = h("div", { className: "nav-mobile", style: {
      maxHeight: "0", overflow: "hidden", transition: "max-height .28s ease",
      borderTop: "1px solid transparent", background: "rgba(11,11,14,.96)" } },
      h("div", { style: { padding: "10px clamp(16px,4vw,40px) 18px", display: "flex", flexDirection: "column" } },
        NAV_LINKS.map(function (l) {
          var active = linkActive(l);
          return h("a", { href: "#" + l.id, onClick: function (e) { e.preventDefault(); r.go(l.id); },
            style: { font: "600 14px/1 " + MONO, letterSpacing: ".1em", textTransform: "uppercase",
              color: active ? COPPER : INK, textDecoration: "none", padding: "15px 4px", borderBottom: "1px solid " + RULE } }, l.label);
        })));

    function setMenu(open) {
      menuOpen = open;
      mobileDrop.style.maxHeight = open ? "340px" : "0";
      mobileDrop.style.borderTop = "1px solid " + (open ? RULE : "transparent");
      burgerBars.forEach(function (b, i) {
        b.style.transform = open ? (i === 0 ? "translateY(5px) rotate(45deg)" : i === 2 ? "translateY(-5px) rotate(-45deg)" : "scaleX(0)") : "none";
      });
    }

    var burger = h("button", { className: "nav-burger", "aria-label": "Menu", onClick: function () { setMenu(!menuOpen); },
      style: { display: "none", width: "38px", height: "34px", alignItems: "center", justifyContent: "center",
        background: PANEL, border: "1px solid " + RULE, borderRadius: "5px", cursor: "pointer", padding: 0 } },
      h("span", { style: { position: "relative", width: "16px", height: "11px", display: "block" } }, burgerBars));

    return h("header", { style: { position: "sticky", top: 0, zIndex: 60,
      background: "rgba(11,11,14,.78)", backdropFilter: "blur(14px) saturate(1.2)", borderBottom: "1px solid " + RULE } },
      h("div", { style: { maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(16px,4vw,40px)",
        height: "62px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" } },
        Logo(),
        h("nav", { className: "nav-links", style: { display: "flex", gap: "4px", alignItems: "center" } },
          NAV_LINKS.map(function (l) {
            var active = linkActive(l);
            return h("a", { href: "#" + l.id, onClick: function (e) { e.preventDefault(); r.go(l.id); },
              style: { font: "600 12.5px/1 " + MONO, letterSpacing: ".1em", textTransform: "uppercase",
                color: active ? INK : DIM, textDecoration: "none", padding: "9px 13px", borderRadius: "4px",
                background: active ? "#ffffff0a" : "transparent", transition: "color .18s, background .18s" },
              onMouseEnter: function (e) { e.currentTarget.style.color = INK; },
              onMouseLeave: function (e) { e.currentTarget.style.color = active ? INK : DIM; } }, l.label);
          })),
        h("div", { className: "nav-right", style: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 } },
          h("span", { className: "nav-wallet" }, WalletButton()), burger)),
      mobileDrop);
  }

  function navCol(title, links, r) {
    return h("div", null,
      window.Kicker({ color: DIM, style: { marginBottom: "16px" } }, title),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "11px" } },
        links.map(function (l) {
          return h("a", { href: "#" + l[1], onClick: function (e) { e.preventDefault(); r.go(l[1]); },
            style: { font: "400 13px/1 " + SANS, color: INK, textDecoration: "none", opacity: 0.82 },
            onMouseEnter: function (e) { e.currentTarget.style.color = COPPER; },
            onMouseLeave: function (e) { e.currentTarget.style.color = INK; } }, l[0]);
        })));
  }

  // ---- "How scores work" — concise methodology, full details in
  // pipeline/report.md (shipped with the site source). ----
  var SCORE_ROWS = [
    ["Influence", "#e0a566", "How loudly history still talks about them: the size of their Wikipedia article, weighted by how many of the world's languages it exists in."],
    ["Legacy", "#5fae6e", "How long they've endured: years since death — the longer their name has lasted, the higher. Living figures sit mid-range; their story isn't finished."],
    ["Dominion", "#d0563a", "How far their power reached: the territory they ruled or the sweep of their work, judged by role and era — conquerors high, court painters low."],
    ["Intellect", "#9c8cf0", "The weight of the ideas: mathematicians, scientists and philosophers rank highest, rulers and generals on their statecraft."],
    ["Controversy", "#c98a4b", "How much the world still argues about them: the size of the debate archived on their Wikipedia talk pages."]
  ];
  function openScoresInfo() {
    var overlay;
    function close() { if (overlay) overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay = h("div", { onClick: close, className: "detail-overlay", style: { position: "fixed", inset: 0, zIndex: 130, background: "rgba(6,6,9,.84)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "fadeUp .22s ease" } },
      h("div", { onClick: function (e) { e.stopPropagation(); }, style: { maxWidth: "560px", width: "100%", margin: "0 auto",
        maxHeight: "min(88vh, 760px)", overflowY: "auto", WebkitOverflowScrolling: "touch",
        background: PANEL, border: "1px solid " + RULE, borderRadius: "12px", padding: "26px 28px", boxShadow: "0 40px 100px -30px #000" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" } },
          window.Kicker({ color: COPPER }, "Real data, same yardstick"),
          h("button", { onClick: close, style: { background: "none", border: "none", color: DIM, cursor: "pointer", font: "400 22px/1 " + MONO } }, "×")),
        h("h2", { style: { margin: "10px 0 10px", font: "700 26px/1.1 " + MONO, color: INK } }, "How the scores work"),
        h("p", { style: { margin: "0 0 20px", font: "400 13.5px/1.6 " + SANS, color: DIM } },
          "Every figure's stats are computed from public Wikipedia and Wikidata data and normalised 1–100 across all 239 humans — no favourites, no hand-tuning."),
        h("div", { style: { display: "grid", gap: "14px" } },
          SCORE_ROWS.map(function (s) {
            return h("div", { style: { paddingLeft: "14px", borderLeft: "2px solid " + s[1] } },
              h("div", { style: { font: "700 12px/1 " + MONO, letterSpacing: ".14em", textTransform: "uppercase", color: s[1], marginBottom: "5px" } }, s[0]),
              h("div", { style: { font: "400 13px/1.55 " + SANS, color: "#c3bdae" } }, s[2]));
          })),
        h("p", { style: { margin: "20px 0 0", font: "400 11.5px/1.6 " + MONO, color: FAINT } },
          "Full methodology and the per-figure source table ship with the site source (pipeline/report.md).")));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  function addrLink(label, addr) {
    return h("div", null,
      h("div", { style: { font: "600 9.5px/1 " + MONO, letterSpacing: ".14em", color: DIM, textTransform: "uppercase", marginBottom: "4px" } }, label),
      h("a", { href: "https://etherscan.io/address/" + addr, target: "_blank", rel: "noopener noreferrer",
        style: { font: "400 11px/1.5 " + MONO, color: FAINT, wordBreak: "break-all", textDecoration: "none" },
        onMouseEnter: function (e) { e.currentTarget.style.color = COPPER; },
        onMouseLeave: function (e) { e.currentTarget.style.color = FAINT; } },
        addr + " ↗"));
  }

  function Footer() {
    var r = window.useRouter();
    return h("footer", { style: { borderTop: "1px solid " + RULE, marginTop: "120px", padding: "44px 0 60px", background: "#08080b" } },
      window.Section({ style: { display: "flex", flexWrap: "wrap", gap: "30px", justifyContent: "space-between", alignItems: "flex-start" } },
        h("div", { style: { maxWidth: "360px" } },
          Logo(),
          h("p", { style: { marginTop: "16px", font: "400 13px/1.7 " + SANS, color: DIM } },
            "239 historical figures, minted as on-chain cards on a 2018 Ethereum contract. Collect them. Play history."),
          h("div", { style: { marginTop: "16px", display: "grid", gap: "10px" } },
            addrLink("Original contract", window.HCX.CA),
            addrLink("ERC-721 wrapper", window.HCX.WRAPPER),
            h("a", { href: "https://ethereumhistory.com/contract/" + window.HCX.CA, target: "_blank", rel: "noopener noreferrer",
              style: { font: "600 11px/1 " + MONO, letterSpacing: ".08em", color: DIM, textDecoration: "none" },
              onMouseEnter: function (e) { e.currentTarget.style.color = COPPER; },
              onMouseLeave: function (e) { e.currentTarget.style.color = DIM; } },
              "ETHEREUM HISTORY ↗"),
            h("a", { href: window.HCX.OPENSEA, target: "_blank", rel: "noopener noreferrer",
              style: { font: "600 11px/1 " + MONO, letterSpacing: ".08em", color: DIM, textDecoration: "none" },
              onMouseEnter: function (e) { e.currentTarget.style.color = COPPER; },
              onMouseLeave: function (e) { e.currentTarget.style.color = DIM; } },
              "VIEW ON OPENSEA ↗"),
            h("a", { href: "#", onClick: function (e) { e.preventDefault(); openScoresInfo(); },
              style: { font: "600 11px/1 " + MONO, letterSpacing: ".08em", color: DIM, textDecoration: "none" },
              onMouseEnter: function (e) { e.currentTarget.style.color = COPPER; },
              onMouseLeave: function (e) { e.currentTarget.style.color = DIM; } },
              "HOW SCORES WORK"))),
        h("div", { style: { display: "flex", gap: "56px", flexWrap: "wrap" } },
          navCol("Collect", [["Open a Pack", "packs"], ["My Collection", "collection"], ["Roster", "roster"]], r),
          navCol("Play", [["Timeline", "timeline"], ["Battle", "battle"], ["Draft", "draft"], ["Assassination", "assassination"]], r))));
  }

  Object.assign(window, { Nav: Nav, Footer: Footer, Logo: Logo, openScoresInfo: openScoresInfo });
})();
