/* hcx-landing.js — vanilla port of landing.jsx. Hero, provenance band, stat
 * bar, COLLECT + PLAY sections. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, BG = window.BG,
      RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  function HeroCards() {
    var H = window.HCX;
    // The fan position lives on an OUTER wrapper and the idle bob on an INNER
    // one: the old single-element version let the floaty keyframes overwrite
    // the inline translateX, collapsing the fan into one stacked pile a beat
    // after load (the "Da Vinci flashes behind Cleopatra" glitch).
    // Swipe (or tap) throws the centre card and cycles the deck.
    var deck = ["Cleopatra", "Napoleon", "Da Vinci", "Gengis Khan", "Einstein", "Caesar", "Joan of Arc"]
      .map(H.byName).filter(Boolean);
    var SLOTS = [
      { x: -168, y: 26, r: -9, z: 1 },
      { x: 0,    y: -8, r: 0,  z: 3 },
      { x: 168,  y: 26, r: 9,  z: 1 }
    ];
    var box = h("div", { className: "hero-cards", title: "Swipe to shuffle",
      style: { position: "relative", height: "440px", display: "flex", justifyContent: "center", alignItems: "center",
        touchAction: "pan-y", cursor: "grab", userSelect: "none", WebkitUserSelect: "none" },
      onPointerdown: function (e) { downX = e.clientX; downY = e.clientY; },
      onPointerup: function (e) {
        if (downX == null) return;
        var dx = e.clientX - downX, dy = e.clientY - downY;
        downX = downY = null;
        if (Math.abs(dy) > 60) return;                       // vertical scroll, not a swipe
        if (Math.abs(dx) > 36) throwCard(dx < 0 ? -1 : 1);   // swipe
        else if (Math.abs(dx) < 8) throwCard(-1);            // tap cycles too
      } });
    var downX = null, downY = null, throwing = false;

    function shown() { return [deck[deck.length - 1], deck[0], deck[1]]; }
    function render() {
      box.innerHTML = "";
      shown().forEach(function (f, i) {
        if (!f) return;
        var s = SLOTS[i];
        box.appendChild(h("div", { style: { position: "absolute", width: "232px", zIndex: s.z,
          transform: "translateX(" + s.x + "px) translateY(" + s.y + "px) rotate(" + s.r + "deg)",
          transition: "transform .45s cubic-bezier(.2,.7,.2,1), opacity .45s",
          animation: i === 1 ? "fadeUp .35s ease both" : "none" } },
          h("div", { style: { animation: "floatybob " + (5.5 + i) + "s ease-in-out infinite", animationDelay: (i * 0.4) + "s" } },
            window.Card({ figure: f, badge: i === 1 }))));
      });
    }
    function throwCard(dir) {
      if (throwing || deck.length < 3) return;
      throwing = true;
      var center = box.children[1];
      if (center) {
        center.style.zIndex = 6;
        center.style.transform = "translateX(" + (dir * 430) + "px) translateY(-46px) rotate(" + (dir * 26) + "deg)";
        center.style.opacity = "0";
      }
      setTimeout(function () {
        if (dir < 0) deck.push(deck.shift());   // thrown left → next card steps up
        else deck.unshift(deck.pop());          // thrown right → previous card returns
        render();
        throwing = false;
      }, 380);
    }
    render();
    return box;
  }

  function ProvenanceBand() {
    var H = window.HCX;
    var items = [["Deployed", "13 March 2018"], ["Standard", "Pre–ERC-721"], ["Artwork", "Fully on-chain"]];
    return h("div", { className: "prov-band", style: { display: "flex", flexWrap: "wrap", alignItems: "stretch",
      border: "1px solid " + RULE, borderRadius: "10px", background: "#0e0e12", overflow: "hidden" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderRight: "1px solid " + RULE, flex: "1 1 auto" } },
        h("span", { style: { color: COPPER, font: "400 13px/1 " + MONO } }, "◆"),
        h("span", { style: { font: "600 10.5px/1.3 " + MONO, letterSpacing: ".16em", textTransform: "uppercase", color: INK } }, "Verified Provenance")),
      items.map(function (it) {
        return h("div", { style: { flex: "1 1 130px", padding: "13px 20px", borderRight: "1px solid " + RULE } },
          h("div", { style: { font: "600 9px/1 " + MONO, letterSpacing: ".16em", color: DIM, marginBottom: "7px" } }, it[0].toUpperCase()),
          h("div", { style: { font: "600 12.5px/1 " + MONO, color: INK } }, it[1]));
      }),
      h("a", { href: "https://etherscan.io/address/" + H.CA, target: "_blank", rel: "noopener noreferrer", title: "View on Etherscan",
        style: { padding: "13px 20px", textDecoration: "none", flex: "1 1 150px", borderRight: "1px solid " + RULE } },
        h("div", { style: { font: "600 9px/1 " + MONO, letterSpacing: ".16em", color: DIM, marginBottom: "7px" } }, "ORIGINAL CONTRACT"),
        h("div", { style: { font: "600 12.5px/1 " + MONO, color: COPPER } }, window.CARD.shortAddr(H.CA) + " ↗")),
      h("a", { href: H.OPENSEA, target: "_blank", rel: "noopener noreferrer", title: "Wrapped HumanityCards on OpenSea",
        style: { padding: "13px 20px", textDecoration: "none", flex: "1 1 130px" } },
        h("div", { style: { font: "600 9px/1 " + MONO, letterSpacing: ".16em", color: DIM, marginBottom: "7px" } }, "MARKETPLACE"),
        h("div", { style: { font: "600 12.5px/1 " + MONO, color: COPPER } }, "OpenSea ↗")));
  }

  function StatBar() {
    var s = window.HCX.stats;
    // exact once live counts are read from the contract; "~" while on snapshot
    var live = !!(window.HCX_CHAIN && window.HCX_CHAIN.mintedLive());
    var items = [{ v: s.humans, l: "Humans" }, { v: (live ? "" : "~") + s.cardsMinted, l: "Cards Minted" },
      { v: s.uniques, l: "1-of-1 Mythics" }, { v: s.genesis, l: "Genesis" }];
    return h("div", { className: "stat-bar", style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px",
      background: RULE, border: "1px solid " + RULE, borderRadius: "10px", overflow: "hidden" } },
      items.map(function (it) {
        return h("div", { style: { background: BG, padding: "26px 22px", textAlign: "center" } },
          window.Stat({ value: it.v, label: it.l, gradient: true, big: 38, style: { textAlign: "center" } }));
      }));
  }

  function HubTile(props) {
    return window.Tile({ onClick: props.onClick, href: "#" + props.go },
      h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" } },
        window.Kicker({ color: props.accent || COPPER }, props.kicker),
        h("span", { style: { font: "400 18px/1 " + MONO, color: DIM } }, "→")),
      h("h3", { style: { margin: "14px 0 8px", font: "700 21px/1.15 " + MONO, letterSpacing: ".01em", color: INK } }, props.title),
      h("p", { style: { margin: 0, font: "400 13.5px/1.6 " + SANS, color: DIM } }, props.body));
  }

  function sectionHead(kicker, title, body, accent) {
    return h("div", { style: { maxWidth: "640px" } },
      window.Kicker({ color: accent || COPPER }, kicker),
      h("h2", { style: { margin: "14px 0 10px", font: "700 clamp(28px,4vw,40px)/1.05 " + MONO, letterSpacing: "-.01em", color: INK } }, title),
      h("p", { style: { margin: 0, font: "400 15px/1.6 " + SANS, color: DIM } }, body));
  }

  function Landing() {
    var r = window.useRouter();
    return h("div", null,
      window.Section({ style: { paddingTop: "clamp(40px,7vw,84px)", paddingBottom: "20px", textAlign: "center" } },
        h("div", { style: { display: "inline-flex", alignItems: "center", gap: "9px", marginBottom: "26px",
          border: "1px solid " + RULE, padding: "7px 14px 7px 11px", borderRadius: "30px" } },
          h("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: COPPER, boxShadow: "0 0 8px " + COPPER } }),
          h("span", { style: { font: "600 11px/1.5 " + MONO, letterSpacing: ".18em", textTransform: "uppercase", color: DIM, textAlign: "center" } },
            h("span", { style: { whiteSpace: "nowrap" } }, "Ethereum Pre-ERC721"),
            h("span", { className: "eyebrow-sep" }, " · "),
            h("span", { className: "eyebrow-line", style: { whiteSpace: "nowrap" } }, "Deployed March 2018"))),
        h("div", { style: { margin: "0 0 16px", font: "700 clamp(19px,3.2vw,28px)/1 " + MONO, letterSpacing: ".16em", textTransform: "uppercase", color: INK } },
          "Humanity", h("span", { style: { color: COPPER } }, "Cards")),
        // paddingBottom: with background-clip:text the gradient only paints the
        // padding box — without it, tight line-height crops the "y" descender.
        h("h1", { style: { margin: "0 auto", padding: "0 0 .12em", font: "700 clamp(54px,10vw,128px)/0.95 " + MONO, letterSpacing: "-.02em",
          background: "linear-gradient(176deg,#f5ddb6 8%,#d39a5b 52%,#9c6326 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", maxWidth: "12ch" } }, "Play history."),
        h("p", { style: { margin: "26px auto 0", maxWidth: "600px", font: "400 16.5px/1.65 " + SANS, color: "#b8b2a4" } },
          "Among the oldest NFT collections on Ethereum — 239 historical figures minted to a single contract in March 2018, before the ERC-721 standard existed. Every card's art is generated and stored fully on-chain. Now you can collect it, and play it."),
        h("div", { style: { display: "flex", gap: "14px", justifyContent: "center", marginTop: "34px", flexWrap: "wrap" } },
          window.Btn({ onClick: function () { r.go("timeline"); } }, "Play Now"),
          window.Btn({ variant: "ghost", onClick: function () { r.go("packs"); } }, "Open Packs"))),
      HeroCards(),
      window.Section({ style: { marginTop: "30px" } },
        ProvenanceBand(),
        h("div", { style: { height: "14px" } }),
        StatBar()),

      window.Section({ style: { marginTop: "100px" } },
        sectionHead("01 — Collect", "Acquire the catalogue", "Mine cards from the 2018 contract. Every pull is an on-chain mint."),
        h("div", { className: "tile-grid-3", style: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "18px", marginTop: "30px" } },
          HubTile({ kicker: "Pack Opening", title: "Open a Pack", go: "packs", onClick: function () { r.go("packs"); },
            body: "The star. Tear a sealed pack and reveal a random figure — suspense scaled to its scarcity." }),
          HubTile({ kicker: "My Collection", title: "Your Cards", go: "collection", onClick: function () { r.go("collection"); },
            body: "Everything your wallet holds, rendered in the on-chain register style." }),
          HubTile({ kicker: "Roster", title: "All 239 Humans", go: "roster", onClick: function () { r.go("roster"); },
            body: "Browse the full catalogue. See what's minted out and how scarce each human runs." }))),

      window.Section({ style: { marginTop: "92px" } },
        sectionHead("02 — Play", "Put figures in play", "Four games. They run on random cards, or your real deck when your wallet's connected.", "#9c8cf0"),
        h("div", { className: "tile-grid-4", style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "18px", marginTop: "30px" } },
          HubTile({ kicker: "Daily Puzzle", accent: "#9c8cf0", title: "Timeline", go: "timeline", onClick: function () { r.go("timeline"); },
            body: "Order five figures by birth year. One puzzle a day." }),
          HubTile({ kicker: "1v1", accent: "#9c8cf0", title: "Battle", go: "battle", onClick: function () { r.go("battle"); },
            body: "Pick a stat. Higher figure wins the trick." }),
          HubTile({ kicker: "Council", accent: "#9c8cf0", title: "Draft", go: "draft", onClick: function () { r.go("draft"); },
            body: "Build a five-figure council for the day's category." }),
          HubTile({ kicker: "Connections", accent: "#9c8cf0", title: "Assassination", go: "assassination", onClick: function () { r.go("assassination"); },
            body: "Play figures linked by history to take out rivals." }))));
  }

  Object.assign(window, { Landing: Landing, StatBar: StatBar, ProvenanceBand: ProvenanceBand, sectionHead: sectionHead, HeroCards: HeroCards });
})();
