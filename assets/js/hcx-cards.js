/* hcx-cards.js — vanilla port of cards.jsx. Cards render the on-chain Ledger
 * SVG (window.CARD_VARIANTS.ledger). Scarcity is supply counts only. */
(function () {
  "use strict";
  var h = window.h;

  function rarityAccent(f) { return window.CARD.rarity(f.maxSupply, "dark").accent; }
  function rarityWeight(f) { return window.CARD.rarity(f.maxSupply, "dark").weight; }
  function scarcityLabel(f) { return f.maxSupply <= 1 ? "1 OF 1" : "1 OF " + f.maxSupply; }

  function ledgerHTML(f) {
    return window.CARD_VARIANTS.ledger.fn(Object.assign({}, f, { figure: f.figure || f.name }));
  }
  function LedgerSVG(f) {
    return h("div", { className: "ledger-svg", style: { width: "100%", height: "100%" },
      dangerouslySetInnerHTML: { __html: ledgerHTML(f) } });
  }

  function backSVG(accent) {
    var C = window.CARD, MONO = window.MONO;
    var bg = "#0c0d0f", rule = "#33312b", bone = "#ece7d8";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700" style="width:100%;height:100%;display:block">' +
      '<defs>' + C.grainFilter("gb", 0.85, 0.55) + '</defs>' +
      '<rect width="500" height="700" fill="' + bg + '"/>' +
      '<rect width="500" height="700" fill="' + accent + '" filter="url(#gb)" opacity="0.05"/>' +
      '<rect x="20" y="20" width="460" height="660" fill="none" stroke="' + rule + '" stroke-width="1.2"/>' +
      '<rect x="30" y="30" width="440" height="640" fill="none" stroke="' + rule + '" stroke-width="0.6"/>' +
      '<g opacity="0.85">' + C.rosette(250, 350, 196, accent, 0.5, 0.22) + '</g>' +
      '<g opacity="0.5">' + C.rosette(250, 350, 120, bone, 0.4, 0.14) + '</g>' +
      '<circle cx="250" cy="350" r="62" fill="' + bg + '" opacity="0.86"/>' +
      '<circle cx="250" cy="350" r="62" fill="none" stroke="' + accent + '" stroke-width="1"/>' +
      '<text x="250" y="366" font-family="' + MONO + '" font-size="42" font-weight="700" letter-spacing="4" fill="' + bone + '" text-anchor="middle">HCX</text>' +
      '<text x="250" y="58" font-family="' + MONO + '" font-size="15" letter-spacing="6" font-weight="700" fill="' + bone + '" text-anchor="middle">HUMANITYCARDS</text>' +
      '<line x1="40" y1="74" x2="460" y2="74" stroke="' + rule + '" stroke-width="1"/>' +
      '<line x1="40" y1="626" x2="460" y2="626" stroke="' + rule + '" stroke-width="1"/>' +
      '<text x="250" y="652" font-family="' + MONO + '" font-size="11" letter-spacing="1" fill="#7c7668" text-anchor="middle">ORIGINAL CONTRACT · 2018 GENESIS</text>' +
      '</svg>';
  }
  function CardBack(accent) {
    return h("div", { style: { width: "100%", height: "100%" },
      dangerouslySetInnerHTML: { __html: backSVG(accent || "#5a5346") } });
  }

  function ScarcityBadge(f) {
    var accent = rarityAccent(f);
    var unique = f.maxSupply <= 1;
    return h("div", { style: {
      position: "absolute", bottom: "12px", right: "12px",
      font: "600 10px/1 " + window.MONO, letterSpacing: ".12em",
      color: unique ? "#0c0d0f" : accent,
      background: unique ? accent : "#0c0d0fcc",
      border: "1px solid " + accent + (unique ? "" : "66"),
      padding: "4px 7px", borderRadius: "3px", backdropFilter: "blur(4px)",
      textShadow: unique ? "none" : "0 1px 2px #000", zIndex: 3
    } }, scarcityLabel(f));
  }

  // props: { figure, variant:'front'|'back', badge, glow, dim, hoverInfo, onClick, style }
  function Card(props) {
    var f = props.figure;
    if (!f) return h("div", { style: Object.assign({ aspectRatio: "5 / 7", width: "100%", borderRadius: "6px",
      background: "#0c0d0f", boxShadow: "0 0 0 1px #ffffff10" }, props.style || {}) });
    var accent = rarityAccent(f);
    var w = rarityWeight(f);
    var glow = props.glow !== false && w > 0.45;
    var dim = props.dim;
    var baseShadow = glow
      ? "0 14px 40px -18px rgba(0,0,0,.9), 0 0 0 1px " + accent + "44, 0 0 34px -10px " + accent + "66"
      : "0 14px 40px -22px rgba(0,0,0,.85), 0 0 0 1px #ffffff10";
    var style = Object.assign({
      position: "relative", aspectRatio: "5 / 7", width: "100%",
      borderRadius: "6px", overflow: "hidden", cursor: props.onClick ? "pointer" : "default",
      background: "#0c0d0f", boxShadow: baseShadow,
      transition: "transform .26s cubic-bezier(.2,.7,.2,1), box-shadow .26s",
      opacity: dim ? 0.36 : 1, filter: dim ? "saturate(.4)" : "none"
    }, props.style || {});
    var node = h("div", { className: "hc-card", style: style,
      onClick: props.onClick ? function () { props.onClick(f); } : null,
      onMouseEnter: function (e) { if (!props.onClick) return; e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = glow ? "0 26px 56px -20px rgba(0,0,0,.95), 0 0 0 1px " + accent + "66, 0 0 50px -8px " + accent + "88" : "0 26px 56px -22px rgba(0,0,0,.9), 0 0 0 1px #ffffff20"; },
      onMouseLeave: function (e) { if (!props.onClick) return; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = baseShadow; } },
      props.variant === "back" ? CardBack(accent) : LedgerSVG(f),
      props.badge !== false ? ScarcityBadge(f) : null,
      // owned-but-unwrapped: still sits on the 2018 contract, not yet wHCX
      (f.owned && !f.wrapped) ? h("div", { style: { position: "absolute", top: "8px", left: "8px", zIndex: 2,
        font: "700 8.5px/1 " + window.MONO, letterSpacing: ".12em", color: "#13101f",
        background: "#e0a566", borderRadius: "3px", padding: "4px 6px" } }, "UNWRAPPED") : null,
      (props.hoverInfo && f.role) ? h("div", { className: "hc-hover", style: {
        position: "absolute", left: 0, right: 0, bottom: 0, padding: "26px 12px 11px", zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(transparent, #07070acc 55%, #07070af2)", opacity: 0, transition: "opacity .22s" } },
        h("div", { style: { font: "600 9.5px/1.3 " + window.MONO, letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: "3px" } }, f.role),
        h("div", { style: { font: "400 10.5px/1.2 " + window.SANS, color: window.DIM } }, "Born " + window.HCX.eraLabel(f.born))
      ) : null
    );
    return node;
  }

  function SkeletonCard(props) {
    props = props || {};
    return h("div", { className: "hc-skeleton", style: Object.assign({ aspectRatio: "5 / 7", width: "100%", borderRadius: "6px",
      background: "linear-gradient(110deg,#141318 8%,#1d1c22 18%,#141318 33%)", backgroundSize: "200% 100%", boxShadow: "0 0 0 1px #ffffff0d" }, props.style || {}) });
  }

  // props: { figures, min, gap, style, dimUnminted, hoverInfo, onSelect }
  function CardGrid(props) {
    var figs = props.figures || [];
    return h("div", { style: Object.assign({
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(" + (props.min || 188) + "px, 1fr))",
      gap: props.gap || "26px" }, props.style || {}) },
      figs.map(function (f) {
        return Card({ figure: f, dim: props.dimUnminted && f.minted === 0, hoverInfo: props.hoverInfo,
          onClick: props.onSelect ? function () { props.onSelect(f); } : null });
      }));
  }

  Object.assign(window, {
    rarityAccent: rarityAccent, rarityWeight: rarityWeight, scarcityLabel: scarcityLabel,
    Card: Card, CardBack: CardBack, LedgerSVG: LedgerSVG, ScarcityBadge: ScarcityBadge,
    SkeletonCard: SkeletonCard, CardGrid: CardGrid, backSVG: backSVG, ledgerHTML: ledgerHTML
  });
})();
