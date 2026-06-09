/* Card renderer. Produces an SVG string visually faithful to the on-chain
 * CardRenderer: 500x700, near-black ground, monospace type, a generative
 * geometric "portrait" mesh, and a rarity-encoded accent color.
 *
 * This is a client-side homage (not a byte-for-byte copy of the on-chain art)
 * so the games stay fast and work offline. The palette + layout match the real
 * cards in humanity-card-samples/. */
(function () {
  "use strict";
  var HC = window.HC, HC_CONFIG = window.HC_CONFIG;

  var BG = "#0c0d0f", INK = "#ece7d8", MUTE = "#7c7668", LINE = "#33312b";
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ESC[c]; }); }
  function MONO(size) {
    return "font-family=\"ui-monospace,'DejaVu Sans Mono','Courier New',monospace\" font-size=\"" + size + "\"";
  }

  // Fit a name into the title band by shrinking font size for long names.
  function titleSize(name) {
    var n = name.length;
    if (n <= 7) return 64;
    if (n <= 10) return 50;
    if (n <= 14) return 38;
    if (n <= 20) return 28;
    return 22;
  }

  // Generative portrait: a radial mesh of struts seeded by humanId, echoing the
  // noise-driven line art on the real cards.
  function portrait(h, accent) {
    var rand = HC.rng(HC.hashStr("hc-portrait-" + h.id + "-" + h.name));
    var cx = 250, cy = 222, parts = [];
    var rings = 3, spokes = 11 + Math.floor(rand() * 5);
    var pts = [];
    for (var r = 0; r < rings; r++) {
      var rad = 38 + r * 26;
      var ringPts = [];
      for (var s = 0; s < spokes; s++) {
        var ang = (s / spokes) * Math.PI * 2 + rand() * 0.5;
        var jitter = 1 + (rand() - 0.5) * 0.5;
        ringPts.push([
          cx + Math.cos(ang) * rad * jitter,
          cy + Math.sin(ang) * rad * jitter * 0.92
        ]);
      }
      pts.push(ringPts);
    }
    // Connect within rings and across rings -> woven look.
    for (var ri = 0; ri < pts.length; ri++) {
      var ring = pts[ri];
      var d = "M" + ring[0][0].toFixed(1) + "," + ring[0][1].toFixed(1);
      for (var i = 1; i < ring.length; i++) d += "L" + ring[i][0].toFixed(1) + "," + ring[i][1].toFixed(1);
      d += "Z";
      parts.push('<path d="' + d + '" fill="none" stroke="' + accent +
        '" stroke-width="' + (1.4 - ri * 0.3).toFixed(2) + '" opacity="' + (0.5 - ri * 0.1).toFixed(2) + '"/>');
      if (ri < pts.length - 1) {
        var outer = pts[ri + 1];
        for (var k = 0; k < ring.length; k++) {
          var o = outer[k % outer.length];
          parts.push('<line x1="' + ring[k][0].toFixed(1) + '" y1="' + ring[k][1].toFixed(1) +
            '" x2="' + o[0].toFixed(1) + '" y2="' + o[1].toFixed(1) +
            '" stroke="' + accent + '" stroke-width="0.5" opacity="0.28"/>');
        }
      }
    }
    // Bright nodes for sparkle.
    pts[0].forEach(function (p) {
      parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
        '" r="1.6" fill="' + accent + '" opacity="0.9"/>');
    });
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + INK + '" opacity="0.85"/>');
    return '<g>' + parts.join("") + '</g>';
  }

  function svg(h, opts) {
    opts = opts || {};
    var accent = h.accent;
    var cardNo = opts.cardNumber != null ? opts.cardNumber : "--";
    var ts = titleSize(h.name);
    var noiseSeed = (HC.hashStr(h.name) % 90) / 100 + 0.4; // 0.4-1.3 baseFrequency

    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700" class="hc-card-svg" preserveAspectRatio="xMidYMid meet">';
    out += '<defs><filter id="n' + h.id + '" x="0" y="0" width="100%" height="100%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="' + noiseSeed.toFixed(2) +
      '" numOctaves="2" stitchTiles="stitch" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/></filter></defs>';
    out += '<rect width="500" height="700" fill="' + BG + '"/>';
    out += '<rect width="500" height="700" fill="' + accent + '" filter="url(#n' + h.id + ')" opacity="0.05"/>';
    out += '<rect x="20" y="20" width="460" height="660" fill="none" stroke="' + LINE + '" stroke-width="1.2"/>';
    // Header
    out += '<text x="250" y="56" ' + MONO(16) + ' fill="' + INK + '" letter-spacing="6" font-weight="700" text-anchor="middle">HumanityCards</text>';
    out += '<line x1="40" y1="72" x2="460" y2="72" stroke="' + LINE + '" stroke-width="1"/>';
    // Portrait
    out += portrait(h, accent);
    // Tier tag
    out += '<text x="250" y="338" ' + MONO(13) + ' fill="' + accent + '" letter-spacing="4" text-anchor="middle" font-weight="700">' +
      esc(h.tierLabel.toUpperCase()) + '</text>';
    // Name
    out += '<text x="250" y="392" ' + MONO(ts) + ' fill="' + INK + '" font-weight="700" letter-spacing="1" text-anchor="middle">' +
      esc(h.name.toUpperCase()) + '</text>';
    // Stat rows
    function row(y, k, v, valColor) {
      out += '<text x="58" y="' + y + '" ' + MONO(15) + ' fill="' + MUTE + '" letter-spacing="1">' + k + '</text>';
      out += '<text x="442" y="' + y + '" ' + MONO(15) + ' fill="' + (valColor || INK) + '" letter-spacing="1" text-anchor="end">' + esc(v) + '</text>';
      out += '<line x1="58" y1="' + (y + 9) + '" x2="442" y2="' + (y + 9) + '" stroke="' + LINE + '" stroke-width="0.6" stroke-dasharray="1 4"/>';
    }
    row(444, "HUMAN NUMBER", String(h.id));
    row(484, "CARD NUMBER", String(cardNo));
    row(524, "MAX SUPPLY", "1 of " + h.max, accent);
    row(564, "MINED", h.mined + " / " + h.max);
    // Footer
    out += '<line x1="40" y1="600" x2="460" y2="600" stroke="' + LINE + '" stroke-width="0.6"/>';
    out += '<text x="40" y="628" ' + MONO(12) + ' fill="' + MUTE + '" letter-spacing="1">ORIGINAL CONTRACT · DEPLOYED ' + HC_CONFIG.deployed + '</text>';
    out += '<text x="40" y="652" ' + MONO(13) + ' fill="' + INK + '" opacity="0.85">' + HC_CONFIG.contracts.original + '</text>';
    out += '<line x1="40" y1="668" x2="460" y2="668" stroke="' + LINE + '" stroke-width="0.6"/>';
    out += '</svg>';
    return out;
  }

  // The face-down card back used during pack reveals.
  function backSvg() {
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700" class="hc-card-svg" preserveAspectRatio="xMidYMid meet">';
    out += '<rect width="500" height="700" fill="' + BG + '"/>';
    out += '<rect x="20" y="20" width="460" height="660" fill="none" stroke="' + LINE + '" stroke-width="1.2"/>';
    var rand = HC.rng(7);
    var mesh = "";
    for (var i = 0; i < 60; i++) {
      var x = 40 + rand() * 420, y = 40 + rand() * 620;
      mesh += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.6 + rand() * 1.6).toFixed(1) + '" fill="' + MUTE + '" opacity="0.4"/>';
    }
    out += mesh;
    out += '<text x="250" y="350" ' + MONO(20) + ' fill="' + INK + '" letter-spacing="8" font-weight="700" text-anchor="middle">HCX</text>';
    out += '<text x="250" y="384" ' + MONO(11) + ' fill="' + MUTE + '" letter-spacing="3" text-anchor="middle">EST. 2018</text>';
    out += '</svg>';
    return out;
  }

  // Build a full card node: framed SVG + optional ownership badge.
  function node(h, opts) {
    opts = opts || {};
    var wrap = HC.el("div", { class: "hc-card tier-" + h.tier });
    wrap.style.setProperty("--accent", h.accent);
    wrap.style.setProperty("--glow", h.accentGlow);
    wrap.innerHTML = svg(h, opts);
    if (opts.owned) wrap.appendChild(HC.el("div", { class: "hc-owned-badge", text: "OWNED" }));
    if (opts.onClick) {
      wrap.classList.add("clickable");
      wrap.addEventListener("click", function () { opts.onClick(h, wrap); });
    }
    return wrap;
  }

  HC.card = { svg: svg, backSvg: backSvg, node: node, titleSize: titleSize };
})();
