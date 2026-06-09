/* card-variants.js — HumanityCards card directions.
   Hierarchy: the FIGURE NAME leads. Max supply is a quiet data point.
   Two numbers, named as on the original contract:
     humanId : "Human Number" — which of the 155 figures
     cardId  : "Card Number"  — the token number (cards of one figure differ only by this)
   Deploy date + contract address are contract-level → footer, not per-token rows.
   Data model: { figure, humanId, maxSupply, cardId, contract, deployed }
   Returns a full <svg viewBox="0 0 500 700"> (5:7 ≈ 2.5×3.5).
   Only on-chain-safe primitives from card-helpers.js (window.CARD). */
(function () {
  var C = window.CARD;
  var W = 500, H = 700;
  var MONO = "ui-monospace,'DejaVu Sans Mono','Courier New',monospace";
  var CA = "0xbc9b96e7aa6afea664f9d5fdda168518ee20f2cc";
  var DEP = "13 MAR 2018";

  function fitMono(chars, maxWidth, base) { return Math.min(base, maxWidth / (0.60 * Math.max(1, chars))); }
  function maxLen(a) { return Math.max.apply(null, a.map(function (s) { return s.length; })); }
  function nameLines(name) {
    var toks = String(name).trim().split(/\s+/);
    if (toks.length <= 2) return toks;
    var best = 1, bestDiff = 1e9;
    for (var i = 1; i < toks.length; i++) {
      var a = toks.slice(0, i).join(" ").length, b = toks.slice(i).join(" ").length;
      if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = i; }
    }
    return [toks.slice(0, best).join(" "), toks.slice(best).join(" ")];
  }
  function svg(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">' + inner + "</svg>"; }
  function defaults(d) {
    return { figure: d.figure, humanId: d.humanId, maxSupply: d.maxSupply, cardId: d.cardId,
      contract: d.contract || CA, deployed: d.deployed || DEP };
  }
  function txt(x, y, size, fill, str, opts) {
    opts = opts || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="' + size + '"' +
      (opts.w ? ' font-weight="' + opts.w + '"' : "") +
      (opts.ls != null ? ' letter-spacing="' + opts.ls + '"' : "") +
      ' fill="' + fill + '"' + (opts.anchor ? ' text-anchor="' + opts.anchor + '"' : "") +
      (opts.op != null ? ' opacity="' + opts.op + '"' : "") + ">" + C.esc(str) + "</text>";
  }
  function reserveE(cx, cy, rx, ry, paper, op) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + paper + '" opacity="' + (op == null ? 0.86 : op) + '"/>';
  }

  // ======================================================================
  // B · LEDGER  — recommended. Dark register, NAME-led, scarcity quiet.
  // ======================================================================
  function ledger(d) {
    d = defaults(d);
    var r = C.rarity(d.maxSupply, "dark");
    var bg = "#0c0d0f", bone = "#ece7d8", dim = "#7c7668", rule = "#33312b", accent = r.accent;
    var lines = nameLines(d.figure).map(function (s) { return s.toUpperCase(); });
    var nameSize = fitMono(maxLen(lines), 416, lines.length > 1 ? 76 : 104);
    var ny = lines.length > 1 ? 232 : 276;
    var lastY = ny + (lines.length - 1) * (nameSize + 8);
    var nameSvg = lines.map(function (s, i) {
      return txt(250, ny + i * (nameSize + 8), nameSize.toFixed(0), bone, s, { w: 700, ls: 1, anchor: "middle" });
    }).join("");
    var dataRow = function (y, k, v, tint) {
      return txt(58, y, 15, dim, k, { ls: 1 }) +
        txt(442, y, 15, tint || bone, v, { ls: 1, anchor: "end" }) +
        '<line x1="58" y1="' + (y + 9) + '" x2="442" y2="' + (y + 9) + '" stroke="' + rule + '" stroke-width="0.6" stroke-dasharray="1 4"/>';
    };

    var inner =
      '<defs>' + C.grainFilter("g2", 0.85, 0.55) + "</defs>" +
      '<rect width="500" height="700" fill="' + bg + '"/>' +
      '<rect width="500" height="700" fill="' + accent + '" filter="url(#g2)" opacity="0.05"/>' +
      '<rect x="20" y="20" width="460" height="660" fill="none" stroke="' + rule + '" stroke-width="1.2"/>' +
      // header — collection only
      txt(250, 56, 16, bone, "HUMANITYCARDS", { ls: 6, w: 700, anchor: "middle" }) +
      '<line x1="40" y1="72" x2="460" y2="72" stroke="' + rule + '" stroke-width="1"/>' +
      // NAME — the lead
      '<g opacity="0.5">' + C.rosette(250, 230, 150, accent, 0.5, 0.10) + "</g>" +
      nameSvg +
      '<line x1="200" y1="' + (lastY + 30) + '" x2="300" y2="' + (lastY + 30) + '" stroke="' + accent + '" stroke-width="2"/>' +
      // quiet token data
      dataRow(424, "HUMAN NUMBER", String(d.humanId)) +
      dataRow(464, "CARD NUMBER", String(d.cardId)) +
      dataRow(504, "MAX SUPPLY", String(d.maxSupply), accent) +
      // footer — contract-level metadata (same for every token)
      '<line x1="40" y1="586" x2="460" y2="586" stroke="' + rule + '" stroke-width="0.6"/>' +
      txt(40, 614, 12, dim, "ORIGINAL CONTRACT \u00b7 DEPLOYED " + d.deployed, { ls: 1 }) +
      txt(40, 638, 13, bone, d.contract, { ls: 0, op: 0.85 }) +
      '<line x1="40" y1="658" x2="460" y2="658" stroke="' + rule + '" stroke-width="0.6"/>';
    return svg(inner);
  }

  // ======================================================================
  // A · SPECIMEN — intaglio banknote, name in the medallion (leads).
  // ======================================================================
  function specimen(d) {
    d = defaults(d);
    var r = C.rarity(d.maxSupply, "ink");
    var ink = "#2b2317", paper = "#f1e6cb", accent = r.accent;
    var lines = nameLines(d.figure).map(function (s) { return s.toUpperCase(); });
    var nameSize = fitMono(maxLen(lines), 380, lines.length > 1 ? 60 : 76);
    var ny = lines.length > 1 ? 280 : 308;
    var lastY = ny + (lines.length - 1) * (nameSize + 8);
    var nameSvg = lines.map(function (s, i) {
      return txt(250, ny + i * (nameSize + 8), nameSize.toFixed(0), ink, s, { w: 700, ls: 1, anchor: "middle" });
    }).join("");

    var inner =
      '<defs>' + C.grainFilter("g1", 0.9, 0.05) + "</defs>" +
      '<rect width="500" height="700" fill="' + paper + '"/>' +
      '<rect x="16" y="16" width="468" height="668" fill="none" stroke="' + ink + '" stroke-width="2.5"/>' +
      '<rect x="27" y="27" width="446" height="646" fill="none" stroke="' + ink + '" stroke-width="0.8"/>' +
      '<g opacity="0.45">' + C.rosette(250, 300, 176, accent, 0.5, 0.6) + "</g>" +
      '<g>' + C.waveBand(40, 92, 420, 4.5, 9, 4, ink, 0.4, 0.45) + "</g>" +
      txt(250, 64, 20, ink, "HUMANITYCARDS", { ls: 7, w: 700, anchor: "middle" }) +
      '<line x1="40" y1="76" x2="460" y2="76" stroke="' + ink + '" stroke-width="0.8"/>' +
      // name on a cleared reserve (leads)
      reserveE(250, lastY - nameSize * 0.32, 200, (lines.length > 1 ? 92 : 60), paper, 0.78) +
      nameSvg +
      '<line x1="150" y1="' + (lastY + 30) + '" x2="350" y2="' + (lastY + 30) + '" stroke="' + ink + '" stroke-width="0.8"/>' +
      txt(250, lastY + 54, 14, accent, "HUMAN NUMBER " + d.humanId, { ls: 2, anchor: "middle" }) +
      // reversed plate holds the card number (the per-token serial)
      '<rect x="120" y="556" width="260" height="58" rx="2" fill="' + ink + '"/>' +
      '<rect x="125" y="561" width="250" height="48" fill="none" stroke="' + accent + '" stroke-width="0.8"/>' +
      txt(250, 580, 11, paper, "CARD NUMBER", { ls: 4, anchor: "middle", op: 0.7 }) +
      txt(250, 600, 20, paper, String(d.cardId), { w: 700, ls: 1, anchor: "middle" }) +
      // max supply (per-figure, quiet)
      txt(250, 636, 12, ink, "MAX SUPPLY " + d.maxSupply, { ls: 2, anchor: "middle", op: 0.7 }) +
      // contract-level footer
      txt(250, 658, 10, ink, d.contract + "  \u00b7  " + d.deployed, { anchor: "middle", op: 0.55 }) +
      '<rect width="500" height="700" filter="url(#g1)" opacity="0.5"/>';
    return svg(inner);
  }

  // ======================================================================
  // C · CERTIFICATE — engraved register. Seal = human number.
  // ======================================================================
  function certificate(d) {
    d = defaults(d);
    var r = C.rarity(d.maxSupply, "ink");
    var ink = "#26303a", paper = "#f6efdc", accent = r.accent;
    var lines = nameLines(d.figure).map(function (s) { return s.toUpperCase(); });
    var nameSize = fitMono(maxLen(lines), 360, lines.length > 1 ? 50 : 62);
    var ny = lines.length > 1 ? 282 : 304;
    var lastY = ny + (lines.length - 1) * (nameSize + 6);
    var nameSvg = lines.map(function (s, i) {
      return txt(250, ny + i * (nameSize + 6), nameSize.toFixed(0), ink, s, { w: 700, ls: 2, anchor: "middle" });
    }).join("");

    var inner =
      '<defs>' + C.grainFilter("g3", 0.9, 0.04) + "</defs>" +
      '<rect width="500" height="700" fill="' + paper + '"/>' +
      '<rect x="22" y="22" width="456" height="656" fill="none" stroke="' + ink + '" stroke-width="1.5"/>' +
      '<g opacity="0.7">' +
        C.waveBand(34, 44, 432, 6, 22, 3, ink, 0.35, 0.55) +
        C.waveBand(34, 656, 432, 6, 22, 3, ink, 0.35, 0.55) +
        C.waveBandV(44, 34, 632, 6, 30, 3, ink, 0.35, 0.55) +
        C.waveBandV(456, 34, 632, 6, 30, 3, ink, 0.35, 0.55) +
      "</g>" +
      '<rect x="58" y="68" width="384" height="564" fill="none" stroke="' + ink + '" stroke-width="0.6"/>' +
      txt(250, 120, 21, ink, "HUMANITYCARDS", { ls: 6, w: 700, anchor: "middle" }) +
      '<line x1="150" y1="140" x2="350" y2="140" stroke="' + ink + '" stroke-width="0.6"/>' +
      '<g opacity="0.3">' + C.rosette(250, 300, 150, ink, 0.4, 0.6) + "</g>" +
      reserveE(250, lastY - nameSize * 0.3, 190, (lines.length > 1 ? 78 : 52), paper, 0.8) +
      nameSvg +
      '<line x1="130" y1="' + (lastY + 24) + '" x2="370" y2="' + (lastY + 24) + '" stroke="' + ink + '" stroke-width="1.4"/>' +
      '<line x1="150" y1="' + (lastY + 30) + '" x2="350" y2="' + (lastY + 30) + '" stroke="' + ink + '" stroke-width="0.6"/>' +
      // seal = human number
      '<circle cx="250" cy="488" r="66" fill="none" stroke="' + accent + '" stroke-width="1.4"/>' +
      '<g opacity="0.7">' + C.rosette(250, 488, 60, accent, 0.5, 0.6) + "</g>" +
      reserveE(250, 488, 48, 48, paper, 0.94) +
      txt(250, 480, 10, accent, "HUMAN NUMBER", { ls: 1, anchor: "middle" }) +
      txt(250, 508, 26, ink, String(d.humanId), { w: 700, anchor: "middle" }) +
      // card number + contract-level footer
      txt(250, 580, 12, ink, "CARD NUMBER " + d.cardId, { ls: 2, anchor: "middle", op: 0.8 }) +
      txt(250, 602, 11, ink, "MAX SUPPLY " + d.maxSupply, { ls: 2, anchor: "middle", op: 0.6 }) +
      txt(250, 622, 10, ink, d.contract + "  \u00b7  " + d.deployed, { anchor: "middle", op: 0.55 }) +
      '<rect width="500" height="700" filter="url(#g3)" opacity="0.5"/>';
    return svg(inner);
  }

  // ======================================================================
  // D · MINIMAL — the NAME set huge as the hero. Cleanest thumbnail.
  // ======================================================================
  function minimal(d) {
    d = defaults(d);
    var r = C.rarity(d.maxSupply, "ink");
    var ink = "#1c1a16", paper = "#f4f1ea", accent = r.accent;
    var lines = nameLines(d.figure).map(function (s) { return s.toUpperCase(); });
    var nameSize = fitMono(maxLen(lines), 412, lines.length > 1 ? 80 : 106);
    var ny = lines.length > 1 ? 332 : 368;
    var lastY = ny + (lines.length - 1) * (nameSize + 8);
    var nameSvg = lines.map(function (s, i) {
      return txt(250, ny + i * (nameSize + 8), nameSize.toFixed(0), ink, s, { w: 700, ls: 2, anchor: "middle" });
    }).join("");

    var inner =
      '<defs>' + C.grainFilter("g4", 0.9, 0.035) + "</defs>" +
      '<rect width="500" height="700" fill="' + paper + '"/>' +
      '<rect x="18" y="18" width="464" height="664" fill="none" stroke="' + ink + '" stroke-width="1"/>' +
      txt(40, 56, 13, ink, "HUMANITYCARDS", { ls: 3, w: 700 }) +
      txt(460, 56, 12, ink, "HUMAN NUMBER " + d.humanId, { anchor: "end", op: 0.75 }) +
      '<line x1="40" y1="70" x2="460" y2="70" stroke="' + ink + '" stroke-width="0.7"/>' +
      '<g opacity="0.7">' + C.waveBand(40, 120, 420, 7, 14, 5, accent, 0.4, 0.55) + "</g>" +
      // NAME hero
      nameSvg +
      '<line x1="210" y1="' + (lastY + 36) + '" x2="290" y2="' + (lastY + 36) + '" stroke="' + accent + '" stroke-width="2"/>' +
      // quiet token line + contract-level footer
      '<line x1="40" y1="612" x2="460" y2="612" stroke="' + ink + '" stroke-width="0.7"/>' +
      txt(40, 636, 12, ink, "CARD NUMBER " + d.cardId, { op: 0.75 }) +
      txt(460, 636, 12, ink, "MAX SUPPLY " + d.maxSupply, { anchor: "end", op: 0.75 }) +
      txt(250, 662, 10, ink, d.contract + "  \u00b7  " + d.deployed, { ls: 0, anchor: "middle", op: 0.55 }) +
      '<rect width="500" height="700" filter="url(#g4)" opacity="0.5"/>';
    return svg(inner);
  }

  // ======================================================================
  // E · NUMISMATIC — banknote; name in the "portrait" oval (leads),
  //     human number as the engraved figure, card number as the serial.
  // ======================================================================
  function numismatic(d) {
    d = defaults(d);
    var r = C.rarity(d.maxSupply, "ink");
    var ink = "#243018", paper = "#efe6c9", accent = r.accent;
    var nlines = nameLines(d.figure).map(function (s) { return s.toUpperCase(); });
    var nmSize = fitMono(maxLen(nlines), 132, nlines.length > 1 ? 23 : 27);
    var nameSvg = nlines.map(function (s, i) {
      return txt(158, 256 + i * (nmSize + 4) - (nlines.length - 1) * (nmSize / 2), nmSize.toFixed(0), ink, s, { w: 700, ls: 1, anchor: "middle" });
    }).join("");
    var cornerNum = function (x, y, a) { return txt(x, y, 15, ink, "MAX " + d.maxSupply, { anchor: a, op: 0.6 }); };

    var inner =
      '<defs>' + C.grainFilter("g5", 0.9, 0.05) +
      '<radialGradient id="ov5" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#f7efd6"/><stop offset="100%" stop-color="#e4d4a8"/></radialGradient></defs>' +
      '<rect width="500" height="700" fill="' + paper + '"/>' +
      '<rect x="16" y="16" width="468" height="668" fill="none" stroke="' + ink + '" stroke-width="2"/>' +
      '<rect x="26" y="26" width="448" height="648" fill="none" stroke="' + ink + '" stroke-width="0.6"/>' +
      '<g opacity="0.4">' + C.waveBand(40, 150, 420, 4, 9, 1, ink, 0.35, 0.5) + C.waveBand(40, 372, 420, 4, 9, 1, ink, 0.35, 0.5) + "</g>" +
      txt(250, 62, 18, ink, "HUMANITYCARDS", { ls: 6, w: 700, anchor: "middle" }) +
      '<line x1="40" y1="74" x2="460" y2="74" stroke="' + ink + '" stroke-width="0.7"/>' +
      cornerNum(56, 112, "start") + cornerNum(444, 112, "end") +
      // portrait oval holding the NAME (no portrait exists — true to source)
      '<ellipse cx="158" cy="252" rx="104" ry="128" fill="url(#ov5)" stroke="' + ink + '" stroke-width="1.4"/>' +
      '<g opacity="0.5">' + C.rosette(158, 252, 94, accent, 0.45, 0.55) + "</g>" +
      reserveE(158, 252, 80, 98, paper, 0.9) +
      nameSvg +
      // right column: human number (engraved figure)
      txt(372, 210, 12, ink, "HUMAN NUMBER", { ls: 2, anchor: "middle", op: 0.7 }) +
      txt(372, 268, 58, ink, String(d.humanId), { w: 700, anchor: "middle" }) +
      '<line x1="300" y1="290" x2="444" y2="290" stroke="' + ink + '" stroke-width="0.8"/>' +
      // bottom: card number as the big serial
      txt(250, 470, 12, ink, "CARD NUMBER", { ls: 5, anchor: "middle", op: 0.7 }) +
      txt(250, 536, 52, ink, String(d.cardId), { w: 700, ls: 2, anchor: "middle" }) +
      '<line x1="120" y1="562" x2="380" y2="562" stroke="' + ink + '" stroke-width="0.7"/>' +
      // contract-level footer
      txt(250, 656, 10, ink, d.contract + "  \u00b7  " + d.deployed, { anchor: "middle", op: 0.55 }) +
      '<rect width="500" height="700" filter="url(#g5)" opacity="0.5"/>';
    return svg(inner);
  }

  window.CARD_VARIANTS = {
    ledger: { fn: ledger, label: "B · Ledger", note: "Recommended. Dark on-chain register — the name leads big; Human Number, Card Number and max supply sit quiet below; contract address + deploy date grouped in the footer as shared metadata." },
    minimal: { fn: minimal, label: "D · Minimal", note: "The name set huge as the hero. Human Number in the header, everything else whispered at the foot. Sharpest thumbnail." },
    specimen: { fn: specimen, label: "A · Specimen", note: "Intaglio banknote. Name in a cleared medallion, Human Number beneath it, Card Number struck on the reversed plate, max supply in fine print." },
    certificate: { fn: certificate, label: "C · Certificate", note: "Engraved register. Name leads; the seal carries the Human Number; Card Number, max supply and contract sit as quiet provenance." },
    numismatic: { fn: numismatic, label: "E · Numismatic", note: "Banknote metaphor. Name in the empty 'portrait' oval; Human Number engraved at right, Card Number as the big serial, max supply a small corner nod." },
  };
})();
