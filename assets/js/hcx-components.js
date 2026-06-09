/* hcx-components.js — vanilla port of components.jsx. System (component
 * library) page + Mobile frame view. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, BG = window.BG,
      PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  function Swatch(color, name, hex) {
    return h("div", null,
      h("div", { style: { height: "64px", borderRadius: "7px", background: color, border: "1px solid #ffffff14", boxShadow: "inset 0 1px 0 #ffffff10" } }),
      h("div", { style: { marginTop: "10px", font: "600 11px/1.3 " + MONO, color: INK } }, name),
      h("div", { style: { font: "400 10.5px/1.3 " + MONO, color: DIM } }, hex));
  }
  function LibBlock(n, title, sub) {
    var children = Array.prototype.slice.call(arguments, 3);
    return h("div", { style: { marginBottom: "60px" } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "22px" } },
        h("span", { style: { font: "700 13px/1 " + MONO, color: COPPER, letterSpacing: ".1em" } }, n),
        h("h2", { style: { margin: 0, font: "700 24px/1 " + MONO, color: INK } }, title),
        h("span", { style: { font: "400 13px/1 " + SANS, color: DIM } }, sub)),
      children);
  }

  function ComponentsPage() {
    var H = window.HCX;
    var ramp = [1, 3, 7, 15, 25, 50].map(function (sup) {
      return { humanId: 900 + sup, name: "Specimen", born: 0, maxSupply: sup, minted: sup, cardId: 5000 + sup, contract: H.CA, deployed: H.DEP, stats: { influence: 60, intellect: 60, dominion: 60, legacy: 60 } };
    });
    return window.Section({ style: { paddingTop: "40px" } },
      window.Kicker(null, "Design System"),
      h("h1", { style: { margin: "14px 0 8px", font: "700 clamp(34px,5vw,52px)/1 " + MONO, color: INK } }, "The system"),
      h("p", { style: { margin: "0 0 50px", maxWidth: "560px", font: "400 14px/1.6 " + SANS, color: DIM } }, "Everything is built from the on-chain card's own vocabulary — security-print monospace, parchment ink on near-black, and a single accent that bleeds toward vermilion as a figure grows scarce."),

      LibBlock("01", "Colour", "near-black canvas · parchment ink · copper accent",
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: "16px" } },
          Swatch(BG, "Canvas", "#0b0b0e"), Swatch(PANEL, "Panel", "#101015"), Swatch(RULE, "Rule", "#2a2925"),
          Swatch(INK, "Ink", "#ece7d8"), Swatch(DIM, "Muted", "#8a8475"), Swatch("linear-gradient(180deg,#e0a566,#b9772f)", "Copper", "gradient"))),

      LibBlock("02", "Type", "monospace leads · sans for prose",
        h("div", { style: { display: "grid", gap: "18px", maxWidth: "640px" } },
          h("div", { style: { font: "700 44px/1 " + MONO, color: INK } }, "Play history."),
          h("div", { style: { font: "600 13px/1 " + MONO, letterSpacing: ".22em", color: COPPER } }, "MONOSPACE · ALL CAPS · TRACKED LABELS"),
          h("div", { style: { font: "400 16px/1.6 " + SANS, color: "#b8b2a4" } }, "Body copy is set in a clean humanist sans for readability, kept calm and low-contrast so the monospace headers and the cards carry the gravitas."))),

      LibBlock("03", "The Card", "front · back · the on-chain register",
        h("div", { style: { display: "grid", gridTemplateColumns: "200px 200px 1fr", gap: "26px", alignItems: "start" } },
          h("div", null, window.Card({ figure: H.byName("Napoleon"), glow: true }),
            h("div", { style: { textAlign: "center", marginTop: "10px", font: "600 10px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, "FRONT")),
          h("div", null, window.Card({ figure: H.byName("Napoleon"), variant: "back", badge: false }),
            h("div", { style: { textAlign: "center", marginTop: "10px", font: "600 10px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, "BACK")),
          h("div", null,
            h("p", { style: { margin: "0 0 16px", font: "400 13px/1.6 " + SANS, color: DIM } }, "The name leads; Human Number, Card Number and supply sit quiet beneath; the contract and 2018 deploy date are grouped in the footer. The guilloche rosette is generated per card."),
            window.DottedRule()))),

      LibBlock("04", "Scarcity", "a continuum, never tiers",
        h("p", { style: { margin: "-8px 0 22px", maxWidth: "560px", font: "400 13px/1.6 " + SANS, color: DIM } }, "There are no rarity tiers on the contract — only supply counts. The accent ink interpolates continuously: sepia at 1-of-50, bleeding to vermilion at 1-of-1."),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "16px" } },
          ramp.map(function (f) {
            return h("div", null, window.Card({ figure: f, glow: false }),
              h("div", { style: { textAlign: "center", marginTop: "9px", font: "600 11px/1 " + MONO, color: window.rarityAccent(f) } }, window.scarcityLabel(f)));
          }))),

      LibBlock("05", "Buttons", "copper fill · ghost outline",
        h("div", { style: { display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" } },
          window.Btn(null, "Open a Pack"), window.Btn({ variant: "ghost" }, "Browse Roster"),
          window.Btn({ size: "sm" }, "Connect Wallet"), window.Btn({ size: "sm", variant: "ghost" }, "Filter"),
          window.Btn({ disabled: true }, "Minted Out"))),

      LibBlock("06", "Badges & Counters", "scarcity pills · stat readouts",
        h("div", { style: { display: "flex", gap: "40px", flexWrap: "wrap", alignItems: "center" } },
          h("div", { style: { display: "flex", gap: "12px" } },
            [1, 7, 50].map(function (sup) {
              var f = ramp.filter(function (x) { return x.maxSupply === sup; })[0] || ramp[0];
              return h("span", { style: { position: "relative", display: "inline-block" } }, window.ScarcityBadge(f));
            })),
          h("div", { style: { display: "flex", gap: "36px" } },
            window.Stat({ value: "239", label: "Humans", gradient: true }),
            window.Stat({ value: "~" + H.stats.cardsMinted, label: "Cards Minted", gradient: true }),
            window.Stat({ value: "7", label: "1-of-1", gradient: true })))),

      LibBlock("07", "Navigation", "fixed, blurred, monospace",
        h("div", { style: { border: "1px solid " + RULE, borderRadius: "8px", overflow: "hidden" } }, window.Nav())));
  }

  function PhoneFrame(label, content) {
    return h("div", { style: { width: "390px", maxWidth: "100%", flex: "0 0 auto" } },
      h("div", { style: { position: "relative", borderRadius: "44px", padding: "11px", background: "linear-gradient(160deg,#222024,#0c0b0e)", boxShadow: "0 40px 90px -30px #000, inset 0 0 0 1px #ffffff12" } },
        h("div", { style: { position: "relative", borderRadius: "34px", overflow: "hidden", background: BG, height: "780px" } },
          h("div", { style: { position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", width: "120px", height: "26px", background: "#000", borderRadius: "16px", zIndex: 50 } }),
          h("div", { className: "phone-scroll", style: { position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" } }, content))),
      h("div", { style: { textAlign: "center", marginTop: "16px", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, label));
  }
  function MobilePage() {
    return window.Section({ style: { paddingTop: "40px" } },
      window.Kicker(null, "Responsive"),
      h("h1", { style: { margin: "14px 0 8px", font: "700 clamp(34px,5vw,52px)/1 " + MONO, color: INK } }, "On a phone"),
      h("p", { style: { margin: "0 0 40px", maxWidth: "560px", font: "400 14px/1.6 " + SANS, color: DIM } }, "Cards stack to a single column, the pack opening works on touch, and the nav collapses. Scroll inside each device."),
      h("div", { className: "phone-row", style: { display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center" } },
        PhoneFrame("Landing", h("div", { className: "mobile-ctx" }, window.Landing(), window.Footer())),
        PhoneFrame("Pack Opening", h("div", { className: "mobile-ctx", style: { padding: "20px 16px" } }, window.PackOpener()))));
  }

  Object.assign(window, { ComponentsPage: ComponentsPage, MobilePage: MobilePage, PhoneFrame: PhoneFrame });
})();
