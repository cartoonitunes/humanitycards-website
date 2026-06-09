/* hcx-pack.js — vanilla port of pack.jsx. The Pack Opening: a 6-stage reveal
 * (sealed -> tear -> suspense -> flip -> celebrate -> details). Suspense scales
 * continuously with scarcity. The reveal card is built once and kept mounted so
 * the CSS rotateY flip transitions instead of snapping. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  function weightedPull() {
    var F = window.HCX.FIGURES, pool = [];
    F.forEach(function (f) { var w = Math.max(1, Math.round(f.maxSupply * 1.4)); for (var i = 0; i < w; i++) pool.push(f); });
    var f = pool[Math.floor(Math.random() * pool.length)];
    var serial = 1 + Math.floor(Math.random() * f.maxSupply);
    return Object.assign({}, f, { cardId: f.cardId, pulledSerial: serial });
  }
  function intensityOf(f) {
    var w = window.CARD.rarity(f.maxSupply, "dark").weight;
    return { w: w, glow: w, shimmer: w > 0.25, rays: w > 0.55, shower: w > 0.55,
      spotlight: w > 0.72, flash: w > 0.86, confetti: f.maxSupply <= 1, big: f.maxSupply <= 3 };
  }
  function txHash() { var s = "0x", c = "0123456789abcdef"; for (var i = 0; i < 64; i++) s += c[Math.floor(Math.random() * 16)]; return s; }
  function stageLabel(stage) {
    return ({ idle: "Stage 1 · Sealed", tearing: "Stage 2 · The Tear", suspense: "Stage 3 · Suspense",
      flip: "Stage 4 · The Flip", celebrate: "Stage 5 · Reveal", details: "Stage 6 · Minted" })[stage];
  }
  function faceStyle(front, accent, glowing) {
    return { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
      borderRadius: "7px", overflow: "hidden", transform: front ? "rotateY(180deg)" : "rotateY(0deg)",
      boxShadow: glowing ? "0 0 0 1px " + accent + "88, 0 0 40px -6px " + accent + "aa" : "0 0 0 1px #ffffff14" };
  }

  function packTxt(x, y, size, fill, str, opts) {
    opts = opts || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="' + size + '"' +
      (opts.w ? ' font-weight="' + opts.w + '"' : "") + (opts.ls != null ? ' letter-spacing="' + opts.ls + '"' : "") +
      ' fill="' + fill + '"' + (opts.anchor ? ' text-anchor="' + opts.anchor + '"' : "") +
      (opts.op != null ? ' opacity="' + opts.op + '"' : "") + ">" +
      String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
  }
  function packFaceSVG(accent) {
    var C = window.CARD, H = window.HCX;
    var bone = "#ece0c6", dim = "#9b8f72", rule = "#4d4536";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 735" preserveAspectRatio="none" style="width:100%;height:100%;display:block">' +
      '<defs>' + C.grainFilter("pg", 0.8, 0.5) +
      '<linearGradient id="foilbase" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#241f17"/><stop offset="34%" stop-color="#2c2517"/><stop offset="62%" stop-color="#16130d"/><stop offset="100%" stop-color="#262016"/></linearGradient>' +
      '<radialGradient id="med" cx="50%" cy="44%" r="62%"><stop offset="0%" stop-color="#2e2718"/><stop offset="100%" stop-color="#13100a"/></radialGradient></defs>' +
      '<rect width="500" height="735" fill="url(#foilbase)"/>' +
      '<rect width="500" height="735" fill="' + accent + '" filter="url(#pg)" opacity="0.06"/>' +
      '<g opacity="0.85">' + C.rosette(250, 330, 252, accent, 0.5, 0.08) + '</g>' +
      '<rect x="18" y="18" width="464" height="699" fill="none" stroke="' + rule + '" stroke-width="1.4"/>' +
      '<rect x="27" y="27" width="446" height="681" fill="none" stroke="' + rule + '" stroke-width="0.6"/>' +
      packTxt(250, 78, 11, dim, "GENESIS SERIES", { ls: 6, anchor: "middle" }) +
      '<line x1="150" y1="92" x2="350" y2="92" stroke="' + rule + '" stroke-width="0.7"/>' +
      '<circle cx="250" cy="222" r="96" fill="url(#med)" stroke="' + accent + '" stroke-width="1.4"/>' +
      '<circle cx="250" cy="222" r="96" fill="none" stroke="' + rule + '" stroke-width="0.5"/>' +
      '<g opacity="0.9">' + C.rosette(250, 222, 86, accent, 0.5, 0.5) + '</g>' +
      '<circle cx="250" cy="222" r="58" fill="#13100a" opacity="0.9"/>' +
      '<circle cx="250" cy="222" r="58" fill="none" stroke="' + accent + '" stroke-width="0.8" opacity="0.6"/>' +
      packTxt(250, 232, 52, bone, "HCX", { w: 700, ls: 3, anchor: "middle" }) +
      packTxt(250, 260, 8, accent, "· EST 2018 ·", { ls: 3, anchor: "middle", op: 0.85 }) +
      packTxt(250, 412, 56, bone, "HUMANITY", { w: 700, ls: 1, anchor: "middle" }) +
      packTxt(250, 470, 56, bone, "CARDS", { w: 700, ls: 8, anchor: "middle" }) +
      '<line x1="212" y1="506" x2="288" y2="506" stroke="' + accent + '" stroke-width="1.6"/>' +
      '<line x1="44" y1="640" x2="456" y2="640" stroke="' + rule + '" stroke-width="0.6"/>' +
      packTxt(250, 666, 11, dim, "SEALED BOOSTER · ONE OF 239 HUMANS", { ls: 2, anchor: "middle" }) +
      packTxt(250, 690, 9.5, dim, H.CA, { anchor: "middle", op: 0.6 }) +
      '<rect width="500" height="735" filter="url(#pg)" opacity="0.35"/></svg>';
  }

  function PackWrapper(tearing) {
    return h("div", { className: "pack-wrap " + (tearing ? "is-tearing" : ""),
      style: { position: "relative", width: "262px", aspectRatio: "5 / 7.35", filter: "drop-shadow(0 34px 60px rgba(0,0,0,.7))" } },
      h("div", { className: "pack-cap" }, h("div", { className: "pack-crimp" }), h("div", { className: "pack-weld" })),
      h("div", { className: "pack-body" },
        h("div", { className: "pack-face", dangerouslySetInnerHTML: { __html: packFaceSVG("#cf9a57") } }),
        h("div", { className: "pack-foil" }), h("div", { className: "pack-crinkle" }), h("div", { className: "pack-sheen" })));
  }

  function AmbientParticles() {
    var box = h("div", { style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } });
    for (var i = 0; i < 16; i++) {
      var s = 6 + Math.random() * 8, d = Math.random() * 8, o = 0.15 + Math.random() * 0.4, sz = 1 + Math.random() * 2.5;
      box.appendChild(h("span", { style: { position: "absolute", left: (Math.random() * 100) + "%", bottom: "-10px",
        width: sz + "px", height: sz + "px", borderRadius: "50%", background: COPPER, opacity: o, filter: "blur(.5px)",
        boxShadow: "0 0 6px " + COPPER, animation: "rise " + s + "s linear " + d + "s infinite" } }));
    }
    return box;
  }
  function Confetti(accent) {
    var cols = [accent, "#f0d2a6", "#e8e0d4", COPPER, "#d39a5b"];
    var box = h("div", { style: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 80, overflow: "hidden" } });
    for (var i = 0; i < 90; i++) {
      var d = Math.random() * 0.6, s = 1.6 + Math.random() * 1.6, c = cols[Math.floor(Math.random() * cols.length)],
          r = Math.random() * 360, w = 4 + Math.random() * 5, ht = 8 + Math.random() * 8, x = (Math.random() - 0.5) * 60;
      box.appendChild(h("span", { style: { position: "absolute", left: (Math.random() * 100) + "%", top: "-20px",
        width: w + "px", height: ht + "px", background: c, transform: "rotate(" + r + "deg)", borderRadius: "1px",
        animation: "confetti " + s + "s cubic-bezier(.3,.6,.5,1) " + d + "s forwards", "--cx": x + "px" } }));
    }
    return box;
  }
  function GoldShower(accent) {
    var box = h("div", { style: { position: "absolute", inset: "-40% 0 0 0", pointerEvents: "none", zIndex: 6, overflow: "hidden" } });
    for (var i = 0; i < 36; i++) {
      var d = Math.random() * 1.2, s = 1.4 + Math.random() * 1.4, sz = 1.5 + Math.random() * 2.5;
      box.appendChild(h("span", { style: { position: "absolute", left: (Math.random() * 100) + "%", top: "0",
        width: sz + "px", height: (sz * 4) + "px", background: "linear-gradient(" + accent + ",transparent)", opacity: 0.8,
        animation: "shower " + s + "s linear " + d + "s infinite" } }));
    }
    return box;
  }

  function RevealDetails(f, hash, onAgain, onReset) {
    var rows = [["Human Number", f.humanId], ["Card Number", f.pulledSerial + " / " + f.maxSupply], ["Max Supply", f.maxSupply], ["Minted To Date", f.minted]];
    return h("div", { style: { maxWidth: "380px", margin: "0 auto", animation: "fadeUp .5s ease both" } },
      (f.role || f.bio) ? h("div", { style: { marginBottom: "20px", textAlign: "center" } },
        f.role ? h("div", { style: { font: "600 11px/1 " + MONO, letterSpacing: ".14em", textTransform: "uppercase", color: window.rarityAccent(f), marginBottom: "8px" } }, f.role + " · Born " + window.HCX.eraLabel(f.born)) : null,
        f.bio ? h("p", { style: { margin: 0, font: "400 13px/1.6 " + SANS, color: "#b8b2a4" } }, f.bio) : null) : null,
      h("div", { style: { display: "grid", gap: "0", marginBottom: "20px" } },
        rows.map(function (r, i) {
          return h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px dotted " + RULE } },
            h("span", { style: { font: "600 10.5px/1 " + MONO, letterSpacing: ".16em", color: DIM } }, r[0].toUpperCase()),
            h("span", { style: { font: "600 13px/1 " + MONO, color: i === 2 ? window.rarityAccent(f) : INK } }, String(r[1])));
        })),
      h("div", { style: { display: "flex", gap: "10px", justifyContent: "center" } },
        window.Btn({ onClick: onAgain }, "Open Another"),
        window.Btn({ variant: "ghost", onClick: onReset }, "Done")),
      h("a", { href: "#", onClick: function (e) { e.preventDefault(); }, title: "View on Etherscan (demo)",
        style: { display: "block", marginTop: "16px", font: "400 10.5px/1.4 " + MONO, color: FAINT, textDecoration: "none", wordBreak: "break-all" } },
        "TX " + hash.slice(0, 22) + "…"));
  }

  function PackOpener() {
    var wallet = window.useWallet();
    var stage = "idle", pull = null, fx = null, accent = COPPER, hash = "";
    var timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

    // --- persistent skeleton ---
    var labelWrap = h("div", { style: { position: "absolute", top: "18px", left: "20px", zIndex: 10 } });
    var headline = h("div", { style: { minHeight: "34px", marginBottom: "18px", textAlign: "center",
      font: "700 clamp(20px,3vw,30px)/1 " + MONO, letterSpacing: ".04em", color: INK, display: "none" } });
    var headlineText = document.createTextNode("");
    var caret = h("span", { className: "caret", style: { color: accent } }, "▌");
    headline.appendChild(headlineText); headline.appendChild(caret);

    var packArea = h("div", { style: { position: "relative", width: "248px", display: "flex", justifyContent: "center" } });
    var controls = h("div", { style: { marginTop: "30px", textAlign: "center", minHeight: "60px" } });
    var center = h("div", { style: { position: "relative", zIndex: 7, display: "flex", flexDirection: "column", alignItems: "center" } },
      headline, packArea, controls);

    var ambient = AmbientParticles();
    var container = h("div", { style: { position: "relative", borderRadius: "14px", overflow: "hidden",
      background: "radial-gradient(120% 90% at 50% 8%, #141319 0%, #0b0b0e 60%)", border: "1px solid " + RULE,
      minHeight: "640px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" } },
      ambient, labelWrap, center);

    // dynamic overlay refs
    var packEl = null, revealCard = null, flipInner = null, frontFace = null, backFace = null;
    var spotlightEl = null, raysEl = null, flashEl = null, confettiEl = null, showerEl = null;

    function setLabel() { labelWrap.innerHTML = ""; labelWrap.appendChild(window.Kicker({ color: DIM, size: 10 }, stageLabel(stage))); }

    function showPack(tearing) {
      if (packEl) packEl.remove();
      packEl = h("div", { style: { animation: tearing ? "none" : "floaty 5s ease-in-out infinite" } }, PackWrapper(tearing));
      packArea.appendChild(packEl);
    }
    function burst() {
      var b = h("div", { className: "burst", style: { position: "absolute", left: "50%", top: "50%", width: "260px", height: "260px",
        transform: "translate(-50%,-50%)", borderRadius: "50%", zIndex: 9, pointerEvents: "none",
        background: "radial-gradient(circle, #fff 0%, " + accent + " 40%, transparent 70%)" } });
      packArea.appendChild(b); setTimeout(function () { b.remove(); }, 1000);
    }
    function buildReveal() {
      backFace = h("div", { style: faceStyle(false, accent, true) }, window.CardBack(accent),
        h("div", { className: "shimmer-sweep" }));
      frontFace = h("div", { style: faceStyle(true, accent, false) }, window.LedgerSVG(pull));
      flipInner = h("div", { className: "flip-inner", style: { position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d", transition: "transform .85s cubic-bezier(.4,.05,.2,1)", transform: "rotateY(0deg)" } },
        backFace, frontFace);
      revealCard = h("div", { className: "reveal-card", style: { width: "248px", aspectRatio: "5 / 7", perspective: "1400px",
        filter: "drop-shadow(0 22px 48px rgba(0,0,0,.6))", animation: "riseIn .7s cubic-bezier(.2,.8,.2,1) both" } }, flipInner);
      packArea.appendChild(revealCard);
    }
    function celebrationOverlays() {
      if (fx.spotlight) { spotlightEl = h("div", { style: { position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none",
        background: "radial-gradient(40% 50% at 50% 46%, transparent 0%, rgba(0,0,0,.78) 100%)" } }); container.insertBefore(spotlightEl, labelWrap); }
      if (fx.rays) { raysEl = h("div", { className: "rays", style: { position: "absolute", left: "50%", top: "44%",
        width: "900px", height: "900px", transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none", opacity: 0.5,
        background: "repeating-conic-gradient(from 0deg, " + accent + "22 0deg 6deg, transparent 6deg 16deg)",
        maskImage: "radial-gradient(closest-side, #000 18%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(closest-side, #000 18%, transparent 70%)" } }); container.insertBefore(raysEl, labelWrap); }
      if (fx.shower) { showerEl = GoldShower(accent); packArea.insertBefore(showerEl, packArea.firstChild); }
      if (fx.flash) { flashEl = h("div", { className: "flash", style: { position: "fixed", inset: 0, background: "#fff", zIndex: 90, pointerEvents: "none" } }); container.appendChild(flashEl); setTimeout(function () { if (flashEl) { flashEl.remove(); flashEl = null; } }, 1000); }
      if (fx.confetti) { confettiEl = Confetti(accent); container.appendChild(confettiEl); }
    }
    function clearOverlays() {
      [spotlightEl, raysEl, flashEl, confettiEl, showerEl].forEach(function (e) { if (e) e.remove(); });
      spotlightEl = raysEl = flashEl = confettiEl = showerEl = null;
    }

    function idleControls() {
      controls.innerHTML = "";
      controls.appendChild(h("div", null,
        window.Btn({ onClick: open, style: { fontSize: "14px", padding: "16px 34px",
          boxShadow: "0 10px 30px -10px " + COPPER + ", 0 0 0 1px #d49a59, 0 0 40px -16px " + COPPER } }, "Open Pack"),
        h("div", { style: { marginTop: "16px", font: "400 12px/1.5 " + SANS, color: DIM } },
          wallet.connected ? "Mints to your wallet · gas estimate 0.004 Ξ" : "Connect a wallet to mint on-chain — or open in demo mode")));
    }

    function setStage(ns) {
      stage = ns; setLabel();
      if (ns === "idle") {
        ambient.style.display = "block";
        headline.style.display = "none";
        clearOverlays();
        if (revealCard) { revealCard.remove(); revealCard = null; }
        showPack(false);
        idleControls();
      } else if (ns === "tearing") {
        ambient.style.display = "none";
        controls.innerHTML = "";
        showPack(true);     // re-mount with is-tearing class to trigger peel/fade
        burst();
      } else if (ns === "suspense") {
        if (packEl) { packEl.remove(); packEl = null; }
        buildReveal();
      } else if (ns === "flip") {
        headline.style.display = "block";
        headlineText.nodeValue = "";
        caret.style.color = accent; caret.style.opacity = 1;
        flipInner.style.transform = "rotateY(180deg)";
        if (revealCard) revealCard.style.animation = "none";
        burst();
        typeName(pull.name);
      } else if (ns === "celebrate") {
        if (fx.big && revealCard) revealCard.classList.add("is-big");
        // shimmer no longer relevant; add scarcity badge to front
        if (frontFace) frontFace.appendChild(window.ScarcityBadge(pull));
        celebrationOverlays();
      } else if (ns === "details") {
        controls.innerHTML = "";
        controls.appendChild(RevealDetails(pull, hash, open, reset));
      }
    }

    function typeName(name) {
      var up = name.toUpperCase();
      up.split("").forEach(function (ch, i) {
        after(900 + i * 55, function () {
          headlineText.nodeValue = up.slice(0, i + 1);
          if (up.slice(0, i + 1).length >= up.length) caret.style.opacity = 0;
        });
      });
    }

    function open() {
      clearTimers(); clearOverlays();
      if (revealCard) { revealCard.remove(); revealCard = null; }
      pull = weightedPull(); fx = intensityOf(pull); accent = window.rarityAccent(pull); hash = txHash();
      headlineText.nodeValue = "";
      setStage("tearing");
      after(1150, function () { setStage("suspense"); });
      after(2850, function () { setStage("flip"); });
      after(3650, function () { setStage("celebrate"); });
      after(5350, function () { setStage("details"); });
    }
    function reset() { clearTimers(); clearOverlays(); pull = null; setStage("idle"); }

    setStage("idle");
    return container;
  }

  function PacksPage() {
    return h("div", null,
      window.Section({ style: { paddingTop: "40px" } },
        h("div", { style: { maxWidth: "560px", marginBottom: "28px" } },
          window.Kicker(null, "Pack Opening"),
          h("h1", { style: { margin: "14px 0 10px", font: "700 clamp(34px,5vw,52px)/1 " + MONO, letterSpacing: "-.01em", color: INK } }, "Mine a card"),
          h("p", { style: { margin: 0, font: "400 15px/1.65 " + SANS, color: DIM } }, "Each pack mines one random figure straight from the 2018 contract. You won't know the scarcity until it turns.")),
        PackOpener()));
  }

  Object.assign(window, { PacksPage: PacksPage, PackOpener: PackOpener, weightedPull: weightedPull, intensityOf: intensityOf });
})();
