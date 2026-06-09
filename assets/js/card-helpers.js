/* card-helpers.js
   On-chain-safe SVG primitives for HumanityCards.
   Everything here emits only: <rect> <line> <text> <circle> <path>
   <linearGradient> <radialGradient> <filter feTurbulence> <pattern>.
   No rasters, no external fonts (system "monospace" only).
   These functions are the JS twin of what the Solidity generator would do
   with fixed-point math; floats here are fine for the preview. */
(function () {
  // --- XML escape for figure names ----------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- Hypotrochoid (spirograph / guilloche rosette) -----------------------
  // The signature security-print curve. One <path>, cheap on-chain.
  function spiro(cx, cy, R, r, d, opts) {
    opts = opts || {};
    var turns = opts.turns || 60;
    var step = opts.step || 0.10;
    var scale = opts.scale || 1;
    var pts = [];
    var k = (R - r) / r;
    for (var t = 0; t <= turns * Math.PI; t += step) {
      var x = cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(k * t));
      var y = cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(k * t));
      pts.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    return "M" + pts.join("L");
  }

  // A full rosette = one clean symmetric spiro + a concentric ring.
  // (Overlaying two different-frequency spiros beats into an off-center
  //  moiré void, so we keep a single frequency and add a plain circle.)
  function rosette(cx, cy, radius, stroke, sw, op) {
    sw = sw || 0.5; op = (op == null ? 0.8 : op);
    var R = 120, r = 29, d = 60;       // 29-petal hypotrochoid
    var maxr = (R - r) + d;            // 151 = outer reach before scaling
    var s = radius / maxr;
    var p1 = spiro(cx, cy, R, r, d, { turns: 58, scale: s });
    return (
      '<path d="' + p1 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" opacity="' + op + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * 0.40).toFixed(1) +
      '" fill="none" stroke="' + stroke + '" stroke-width="' + (sw * 0.8) + '" opacity="' + (op * 0.7) + '"/>'
    );
  }

  // --- Woven guilloche band (interlaced sine waves) ------------------------
  // Used for borders / security strips. Horizontal band along y..y, width w.
  function waveBand(x, y, w, amp, waves, lines, stroke, sw, op) {
    sw = sw || 0.4; op = (op == null ? 0.55 : op);
    var out = "";
    var seg = w / 120;
    for (var li = 0; li < lines; li++) {
      var ph = (li / lines) * Math.PI * 2;
      var yy = y + (li / Math.max(1, lines - 1) - 0.5) * 0; // centered set
      var d = "M" + x.toFixed(1) + "," + (y).toFixed(1);
      var pts = [];
      for (var i = 0; i <= 120; i++) {
        var px = x + i * seg;
        var py = y + Math.sin((i / 120) * waves * Math.PI * 2 + ph) * amp
                   + Math.sin((i / 120) * waves * 2 * Math.PI * 2 + ph * 1.7) * amp * 0.35;
        pts.push(px.toFixed(1) + "," + py.toFixed(1));
      }
      out += '<path d="M' + pts.join("L") + '" fill="none" stroke="' + stroke +
             '" stroke-width="' + sw + '" opacity="' + op + '"/>';
    }
    return out;
  }

  // Vertical version for left/right edges.
  function waveBandV(x, y, h, amp, waves, lines, stroke, sw, op) {
    sw = sw || 0.4; op = (op == null ? 0.55 : op);
    var out = "";
    var seg = h / 120;
    for (var li = 0; li < lines; li++) {
      var ph = (li / lines) * Math.PI * 2;
      var pts = [];
      for (var i = 0; i <= 120; i++) {
        var py = y + i * seg;
        var px = x + Math.sin((i / 120) * waves * Math.PI * 2 + ph) * amp
                   + Math.sin((i / 120) * waves * 2 * Math.PI * 2 + ph * 1.7) * amp * 0.35;
        pts.push(px.toFixed(1) + "," + py.toFixed(1));
      }
      out += '<path d="M' + pts.join("L") + '" fill="none" stroke="' + stroke +
             '" stroke-width="' + sw + '" opacity="' + op + '"/>';
    }
    return out;
  }

  // --- Microtext line (security feature) ----------------------------------
  function microline(str, n) {
    var out = "";
    for (var i = 0; i < n; i++) out += str;
    return esc(out);
  }

  // --- Grain / paper filter (one cheap feTurbulence) ----------------------
  function grainFilter(id, freq, op, mode) {
    return (
      '<filter id="' + id + '" x="0" y="0" width="100%" height="100%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="2" stitchTiles="stitch" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ' + op + ' 0"/>' +
      '</filter>'
    );
  }

  // --- Continuous rarity signal (NO hard tiers) ---------------------------
  // Maps maxSupply -> 0 (ultra rare) .. 1 (common) on a log scale, plus an
  // accent ink that interpolates rare->common. Lerp in HSL for cheap on-chain.
  function rarity(maxSupply, theme) {
    var t = Math.log(Math.max(1, maxSupply)) / Math.log(50);
    t = Math.max(0, Math.min(1, t));
    // rare end (t=0) -> common end (t=1)
    var palettes = {
      // [hue, sat%, light%] rare  ->  common
      ink:  [[2, 70, 38], [28, 18, 34]],   // vermilion -> sepia
      dark: [[14, 78, 60], [40, 16, 60]],  // ember -> bone
    };
    var p = palettes[theme] || palettes.ink;
    function lerp(a, b) { return a + (b - a) * t; }
    var h = lerp(p[0][0], p[1][0]);
    var s = lerp(p[0][1], p[1][1]);
    var l = lerp(p[0][2], p[1][2]);
    return {
      t: t,
      accent: "hsl(" + h.toFixed(0) + "," + s.toFixed(0) + "%," + l.toFixed(0) + "%)",
      // how "loud" the rarity treatment should be: 1 at 1-of-1, fading to ~0
      weight: 1 - t,
      unique: maxSupply <= 1,
    };
  }

  // Spell a small integer (for the numismatic denomination metaphor).
  function spellNumber(n) {
    var ones = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN",
      "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN",
      "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
    var tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY",
      "SEVENTY", "EIGHTY", "NINETY"];
    if (n < 20) return ones[n];
    if (n < 100) {
      var t = Math.floor(n / 10), o = n % 10;
      return tens[t] + (o ? "-" + ones[o] : "");
    }
    return String(n);
  }

  // Truncate an address: 0x1234…ABCD
  function shortAddr(a) {
    if (!a || a.length < 12) return a || "";
    return a.slice(0, 6) + "\u2026" + a.slice(-4);
  }

  // pad card number like 04512
  function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }

  window.CARD = {
    esc: esc, spiro: spiro, rosette: rosette, waveBand: waveBand,
    waveBandV: waveBandV, microline: microline, grainFilter: grainFilter,
    rarity: rarity, spellNumber: spellNumber, shortAddr: shortAddr, pad: pad,
  };
})();
