/* Timeline: order figures by birth year. Daily seed = same draw for everyone.
 * Streaks persist locally. Holding any card unlocks Hard / Insane. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("timeline.html");

  var MODES = {
    normal: { label: "Normal", n: 5, gated: false },
    hard:   { label: "Hard",   n: 6, gated: true },
    insane: { label: "Insane", n: 7, gated: true }
  };
  var mode = "normal";

  // Recognizable pool so puzzles are fair (skip the deep cuts for Normal).
  var FAMOUS = HC.ROSTER.filter(function (h) { return h.inf >= 58; });

  var track = document.getElementById("tl-track");
  var resultBox = document.getElementById("tl-result");
  var unlockSlot = document.getElementById("unlock-slot");
  var current = [];     // current on-screen order (array of humans)
  var solved = false;

  // ---- stats ----
  function stats() {
    return HC.load("tl:stats", { streak: 0, best: 0, played: 0, wins: 0, lastKey: null });
  }
  function renderStats() {
    var s = stats();
    document.getElementById("sb-streak").textContent = s.streak;
    document.getElementById("sb-best").textContent = s.best;
    document.getElementById("sb-played").textContent = s.played;
    document.getElementById("sb-rate").textContent = s.played ? Math.round(s.wins / s.played * 100) + "%" : "--";
  }

  // ---- puzzle generation ----
  function makePuzzle(practice) {
    var key = HC.todayKey() + ":" + mode + (practice ? ":p" + Date.now() : "");
    var rand = HC.rng(HC.hashStr("tl:" + key));
    var pool = MODES[mode].n > 5 ? HC.ROSTER.filter(function (h) { return h.inf >= 50; }) : FAMOUS;
    // sample with unique birth years for a clean ordering
    var picked = [], seenYears = {}, guard = 0;
    var shuffled = HC.shuffle(pool, rand);
    for (var i = 0; i < shuffled.length && picked.length < MODES[mode].n; i++) {
      var h = shuffled[i];
      if (seenYears[h.born]) continue;
      seenYears[h.born] = 1; picked.push(h);
    }
    return picked;
  }

  function sortedByBorn(arr) {
    return arr.slice().sort(function (a, b) { return a.born - b.born; });
  }

  function chip(h) {
    var c = el("div", { class: "tl-chip", "data-id": h.id });
    c.style.setProperty("--accent", h.accent);
    c.style.setProperty("--glow", h.accentGlow);
    c.appendChild(el("div", { class: "tier-dot" }));
    c.appendChild(el("div", { class: "nm", text: h.name }));
    c.appendChild(el("div", { class: "yr hidden", text: "????" }));
    return c;
  }

  function render(practice) {
    solved = false;
    resultBox.innerHTML = "";
    document.getElementById("lock-btn").disabled = false;
    current = makePuzzle(practice);
    track.innerHTML = "";
    current.forEach(function (h) { track.appendChild(chip(h)); });
    document.getElementById("puzzle-label").textContent =
      (practice ? "Practice · " : "Daily · ") + HC.todayKey() + " · " + MODES[mode].label + " (" + MODES[mode].n + ")";
  }

  // current DOM order -> humans
  function domOrder() {
    return Array.prototype.map.call(track.children, function (c) {
      return HC.byId[Number(c.getAttribute("data-id"))];
    });
  }

  // ---- pointer drag reordering (desktop + touch) ----
  function enableDrag() {
    var dragEl = null, offX = 0, offY = 0, sx = 0, sy = 0, moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (solved) return;
      var c = e.target.closest(".tl-chip");
      if (!c) return;
      dragEl = c; moved = false;
      var r = c.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top; sx = e.clientX; sy = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    track.addEventListener("pointermove", function (e) {
      if (!dragEl) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!moved) {
        moved = true;
        dragEl.classList.add("dragging");
        var r = dragEl.getBoundingClientRect();
        dragEl.style.width = r.width + "px";
        dragEl.style.height = r.height + "px";
        dragEl.style.position = "fixed";
        dragEl.style.zIndex = "999";
        dragEl.style.pointerEvents = "none";
      }
      dragEl.style.left = (e.clientX - offX) + "px";
      dragEl.style.top = (e.clientY - offY) + "px";
      dragEl.style.visibility = "hidden";
      var under = document.elementFromPoint(e.clientX, e.clientY);
      dragEl.style.visibility = "";
      var over = under && under.closest(".tl-chip");
      if (over && over !== dragEl && over.parentNode === track) {
        var rr = over.getBoundingClientRect();
        var before = e.clientX < rr.left + rr.width / 2;
        track.insertBefore(dragEl, before ? over : over.nextSibling);
      }
    });
    function end() {
      if (!dragEl) return;
      var d = dragEl; dragEl = null;
      d.classList.remove("dragging");
      d.style.position = d.style.left = d.style.top = d.style.width = d.style.height = d.style.zIndex = d.style.pointerEvents = "";
    }
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  }

  // ---- lock & score ----
  function lock(practice) {
    if (solved) return;
    solved = true;
    document.getElementById("lock-btn").disabled = true;
    var order = domOrder();
    var sorted = sortedByBorn(order);
    var correctPos = 0;
    Array.prototype.forEach.call(track.children, function (c, i) {
      var h = order[i];
      c.querySelector(".yr").textContent = HC.yearLabel(h.born);
      c.querySelector(".yr").classList.remove("hidden");
      var isRight = sorted[i].id === h.id;
      c.classList.add(isRight ? "correct" : "wrong");
      if (isRight) correctPos++;
    });
    var perfect = correctPos === order.length;

    // Score the daily once per day; practice never affects streak.
    if (!practice) {
      var s = stats();
      if (s.lastKey !== HC.todayKey()) {
        s.played++;
        if (perfect) { s.wins++; s.streak++; if (s.streak > s.best) s.best = s.streak; }
        else { s.streak = 0; }
        s.lastKey = HC.todayKey();
        HC.save("tl:stats", s);
        renderStats();
      }
    }

    var msg = perfect
      ? "Perfect order. " + (practice ? "" : "Streak " + stats().streak + " 🔥")
      : correctPos + " of " + order.length + " in the right spot.";
    resultBox.appendChild(el("div", { class: "mono", style: "font-size:16px;color:" + (perfect ? "var(--good)" : "var(--warn)"), text: msg }));
    resultBox.appendChild(el("div", { class: "row", style: "justify-content:center;margin-top:12px;gap:10px" }, [
      el("button", { class: "btn", onclick: function () { render(true); }, text: "Practice again" })
    ]));
  }

  // ---- mode switch + gating ----
  function buildModes() {
    var host = document.getElementById("mode-switch");
    host.innerHTML = "";
    Object.keys(MODES).forEach(function (k) {
      var m = MODES[k];
      var locked = m.gated && !HC.wallet.isConnected();
      var holder = m.gated && HC.wallet.state.owned && HC.wallet.state.owned.length > 0;
      var disabled = m.gated && !holder;
      var b = el("button", {
        class: "btn" + (k === mode ? " btn-primary" : " btn-ghost"),
        style: "padding:7px 12px;font-size:12px",
        text: m.label + (disabled ? " 🔒" : "")
      });
      b.addEventListener("click", function () {
        if (disabled) {
          HC.toast(HC.wallet.isConnected() ? "Hold a HumanityCard to unlock " + m.label : "Connect a wallet that holds a card to unlock " + m.label);
          return;
        }
        mode = k; buildModes(); render(false);
      });
      host.appendChild(b);
    });
    unlockSlot.innerHTML = "";
    if (!HC.wallet.isConnected()) {
      unlockSlot.appendChild(el("div", { class: "unlock-note", text: "Connect a wallet holding a card to unlock Hard & Insane modes" }));
    } else if (!(HC.wallet.state.owned && HC.wallet.state.owned.length)) {
      unlockSlot.appendChild(el("div", { class: "unlock-note", text: "No HumanityCards detected in this wallet yet" }));
    } else {
      unlockSlot.appendChild(el("div", { class: "unlock-note", style: "border-color:var(--good);color:var(--good)", text: "Holder verified · Hard & Insane unlocked" }));
    }
  }

  document.getElementById("lock-btn").addEventListener("click", function () {
    lock(document.getElementById("puzzle-label").textContent.indexOf("Practice") === 0);
  });
  document.getElementById("shuffle-btn").addEventListener("click", function () {
    if (solved) { render(false); return; }
    // visual shuffle of current chips
    var kids = HC.shuffle(Array.prototype.slice.call(track.children));
    kids.forEach(function (c) { track.appendChild(c); });
  });

  HC.wallet.onChange(function () { buildModes(); });
  enableDrag();
  renderStats();
  buildModes();
  render(false);
})();
