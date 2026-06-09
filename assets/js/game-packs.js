/* Pack opening. The mining loop dressed as a pack tear + card flip. Practice
 * packs use HC.weightedDraw (same remaining-supply odds as the contract). The
 * on-chain path calls mineCard() behind an explicit confirmation modal. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("packs.html");

  var stage = document.getElementById("pack-stage");
  var revealWrap = document.getElementById("reveal-wrap");
  var metaBox = document.getElementById("reveal-meta");
  var openBtn = document.getElementById("open-btn");
  var mintBtn = document.getElementById("mint-btn");
  var busy = false;

  // ---- collection persistence ----
  function coll() { return HC.load("pk:coll", []); }   // array of humanIds (with repeats)
  function addToColl(id) { var c = coll(); c.unshift(id); HC.save("pk:coll", c.slice(0, 200)); }

  function renderStats() {
    var c = coll();
    document.getElementById("sb-opened").textContent = HC.load("pk:opened", 0);
    var uniq = {}; c.forEach(function (id) { uniq[id] = 1; });
    document.getElementById("sb-dex").textContent = Object.keys(uniq).length;
    var best = null;
    c.forEach(function (id) { var h = HC.byId[id]; if (!best || h.tierRank > best.tierRank) best = h; });
    document.getElementById("sb-best").textContent = best ? best.tierLabel : "--";
  }

  function renderCollection() {
    var box = document.getElementById("collection");
    var c = coll();
    box.innerHTML = "";
    if (!c.length) { box.appendChild(el("div", { class: "empty", text: "No cards yet. Open a pack." })); return; }
    // de-dupe for display, show count
    var counts = {}; c.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).sort(function (a, b) { return HC.byId[b].tierRank - HC.byId[a].tierRank; }).forEach(function (id) {
      var h = HC.byId[id];
      var node = HC.card.node(h, { cardNumber: counts[id] > 1 ? "x" + counts[id] : 1 });
      node.style.maxWidth = "150px";
      box.appendChild(node);
    });
  }

  // ---- confetti / rays ----
  function confetti(colorSeed) {
    var c = el("div", { class: "confetti" });
    var cols = ["#ece7d8", colorSeed, "#e6b450", "#6fcf97", "#82aaff"];
    for (var i = 0; i < 90; i++) {
      var f = el("i");
      f.style.left = Math.random() * 100 + "vw";
      f.style.background = cols[i % cols.length];
      f.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      f.style.animationDelay = (Math.random() * 0.5) + "s";
      f.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
      c.appendChild(f);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 3600);
  }

  function raysSvg(accent) {
    var parts = "";
    for (var i = 0; i < 24; i++) {
      var a = (i / 24) * Math.PI * 2;
      parts += '<line x1="200" y1="200" x2="' + (200 + Math.cos(a) * 260).toFixed(0) + '" y2="' + (200 + Math.sin(a) * 260).toFixed(0) + '" stroke="' + accent + '" stroke-width="' + (i % 2 ? 6 : 14) + '" opacity="0.25"/>';
    }
    return '<svg viewBox="0 0 400 400" width="520" height="520">' + parts + '</svg>';
  }

  // ---- the reveal sequence ----
  function reveal(h, opts) {
    opts = opts || {};
    var rare = h.tierRank >= 4;   // legendary+
    var epic = h.tierRank >= 3;

    // 1. build reveal card (face down)
    revealWrap.innerHTML = "";
    revealWrap.classList.toggle("celebrate", rare);
    if (rare) {
      var rays = el("div", { class: "rays" });
      rays.innerHTML = raysSvg(h.accentGlow);
      revealWrap.appendChild(rays);
      setTimeout(function () { rays.classList.add("show"); }, 100);
    }
    var card = el("div", { class: "reveal-card" });
    var back = el("div", { class: "reveal-face back" }); back.innerHTML = HC.card.backSvg();
    var front = el("div", { class: "reveal-face front" }); front.innerHTML = HC.card.svg(h, { cardNumber: opts.cardNumber || 1 });
    card.appendChild(back); card.appendChild(front);
    revealWrap.appendChild(card);
    card.style.setProperty("--accent", h.accent);
    card.style.setProperty("--glow", h.accentGlow);

    metaBox.innerHTML = "";

    // 2. flip after a suspense beat
    setTimeout(function () { card.classList.add("flipped"); }, epic ? 900 : 550);

    // 3. announce
    setTimeout(function () {
      metaBox.appendChild(el("div", { class: "rtier", style: "color:" + h.accentGlow, text: h.tierLabel.toUpperCase() + (rare ? "  ✦" : "") }));
      metaBox.appendChild(el("div", { class: "rname", text: h.name }));
      var sub = "1 of " + h.max + " · human #" + h.id + (opts.onchain ? " · minted on-chain" : "");
      metaBox.appendChild(el("div", { class: "mono mute", style: "font-size:12px;margin-top:4px", text: sub }));
      if (opts.txHash) {
        metaBox.appendChild(el("a", { class: "mono", style: "font-size:11px;color:var(--accent)", href: "https://etherscan.io/tx/" + opts.txHash, target: "_blank", rel: "noopener", text: "View transaction ↗" }));
      }
      if (rare) { confetti(h.accentGlow); HC.toast("✦ " + h.tierLabel + "! " + h.name); }
      busy = false;
      setBtns(true);
    }, (epic ? 900 : 550) + 850);
  }

  function resetStage() {
    revealWrap.classList.remove("celebrate");
    revealWrap.innerHTML =
      '<div class="pack" id="pack" role="button" tabindex="0" aria-label="Open a pack">' +
      '<div class="pack-foil"></div><div style="text-align:center">' +
      '<div class="pack-logo">HCX</div><div class="pack-sub">HUMANITY PACK</div></div></div>';
    bindPack();
  }

  function setBtns(on) {
    openBtn.disabled = !on; mintBtn.disabled = !on;
    openBtn.textContent = on ? "Open another pack" : "Opening…";
  }

  // practice open: tear pack, then weighted draw
  function openPractice() {
    if (busy) return;
    busy = true; setBtns(false);
    var pack = document.getElementById("pack");
    var h = HC.weightedDraw();
    if (pack) {
      pack.classList.add("tearing");
      setTimeout(function () {
        HC.save("pk:opened", HC.load("pk:opened", 0) + 1);
        addToColl(h.id);
        reveal(h, {});
        renderStats(); renderCollection();
      }, 620);
    } else {
      HC.save("pk:opened", HC.load("pk:opened", 0) + 1);
      addToColl(h.id);
      reveal(h, {}); renderStats(); renderCollection();
    }
  }

  function bindPack() {
    var pack = document.getElementById("pack");
    if (!pack) return;
    pack.addEventListener("click", openPractice);
    pack.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPractice(); } });
  }

  openBtn.addEventListener("click", function () {
    // if a card is currently shown, reset to a fresh pack first
    if (!document.getElementById("pack")) { resetStage(); setTimeout(openPractice, 60); }
    else openPractice();
  });

  // ---- on-chain mint ----
  var modal = document.getElementById("mint-modal");
  var priceWei = null;

  mintBtn.addEventListener("click", async function () {
    if (!HC.wallet.isConnected()) { HC.toast("Connect a wallet first (top right)"); return; }
    document.getElementById("mint-price").textContent = "reading…";
    document.getElementById("mint-confirm").disabled = true;
    modal.classList.add("show");
    priceWei = await HC.wallet.getCardPrice();
    if (priceWei && window.ethers) {
      document.getElementById("mint-price").textContent = window.ethers.utils.formatEther(priceWei) + " ETH";
      document.getElementById("mint-confirm").disabled = false;
    } else {
      document.getElementById("mint-price").textContent = "unavailable";
    }
  });
  document.getElementById("mint-cancel").addEventListener("click", function () { modal.classList.remove("show"); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("show"); });

  document.getElementById("mint-confirm").addEventListener("click", async function () {
    modal.classList.remove("show");
    if (busy) return;
    busy = true; setBtns(false);
    if (!document.getElementById("pack")) resetStage();
    var pack = document.getElementById("pack");
    HC.toast("Confirm the transaction in your wallet…");
    try {
      if (pack) pack.classList.add("tearing");
      var res = await HC.wallet.mineCard(priceWei);
      var h = res.human || HC.weightedDraw();
      HC.save("pk:opened", HC.load("pk:opened", 0) + 1);
      addToColl(h.id);
      reveal(h, { onchain: true, txHash: res.txHash });
      renderStats(); renderCollection();
    } catch (e) {
      busy = false; setBtns(true);
      HC.toast(e && e.code === 4001 ? "Transaction rejected" : "Mint failed: " + (e.message || e).toString().slice(0, 60));
      resetStage();
    }
  });

  bindPack();
  renderStats();
  renderCollection();
})();
