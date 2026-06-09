/* Draft Battles. A daily category sets the scoring rule. Draft a council from a
 * shared pool; the AI drafts greedily from whatever you leave behind. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("draft.html");

  var COUNCIL = 4, POOL_SIZE = 12;

  // Each category scores a human using the derived stats (honest + well-defined).
  var CATS = [
    { title: "Most Influential", desc: "The figures who bent history hardest.", score: function (h) { return h.stats.influence; } },
    { title: "Most Controversial", desc: "Draft the council history argues about.", score: function (h) { return h.stats.controversy; } },
    { title: "Oldest Civilizations", desc: "The deeper into antiquity, the better.", score: function (h) { return h.stats.era; } },
    { title: "Greatest Legacy", desc: "Whose shadow stretches longest.", score: function (h) { return h.stats.legacy; } },
    { title: "Rarest Council", desc: "Lowest supply wins. Genesis cards rule.", score: function (h) { return h.stats.rarity; } },
    { title: "Modern Titans", desc: "Born 1900 or later. Recency is everything.", score: function (h) { return h.born >= 1900 ? h.stats.influence : Math.round(h.stats.influence * 0.25); } }
  ];

  var dayIdx = HC.hashStr(HC.todayKey()) % CATS.length;
  var cat = CATS[dayIdx];
  document.getElementById("cat-title").textContent = cat.title;
  document.getElementById("cat-desc").textContent = cat.desc;

  // Shared daily pool (same for everyone).
  var rand = HC.rng(HC.hashStr("draft:" + HC.todayKey()));
  var pool = HC.sample(HC.ROSTER.filter(function (h) { return h.inf >= 52; }), POOL_SIZE, rand);

  var council = [];   // chosen humans
  var locked = false;

  var poolBox = document.getElementById("pool");
  var councilBox = document.getElementById("council");
  var resultBox = document.getElementById("draft-result");

  function score(h) { return cat.score(h); }

  function renderPool() {
    poolBox.innerHTML = "";
    pool.forEach(function (h) {
      var picked = council.indexOf(h) !== -1;
      var card = el("div", { class: "pool-card" + (picked ? " picked" : "") }, [
        el("div", { class: "pc-score", style: "color:" + h.accentGlow, text: score(h) }),
        el("div", { class: "pc-name", text: h.name }),
        el("div", { class: "pc-meta", text: h.tierLabel + " · " + HC.yearLabel(h.born) })
      ]);
      card.style.setProperty("--accent", h.accent);
      if (!locked && !picked) card.addEventListener("click", function () { pick(h); });
      poolBox.appendChild(card);
    });
  }

  function renderCouncil() {
    councilBox.innerHTML = "";
    for (var i = 0; i < COUNCIL; i++) {
      var h = council[i];
      if (h) {
        var slot = el("div", { class: "council-slot filled" }, [
          el("div", { class: "mono", style: "font-weight:700;font-size:12px", text: h.name }),
          el("div", { class: "mono mute", style: "font-size:11px", text: score(h) + " pts" })
        ]);
        slot.style.setProperty("--accent", h.accent);
        (function (hh) { if (!locked) slot.addEventListener("click", function () { unpick(hh); }); })(h);
        councilBox.appendChild(slot);
      } else {
        councilBox.appendChild(el("div", { class: "council-slot", text: "empty" }));
      }
    }
    var total = council.reduce(function (s, h) { return s + score(h); }, 0);
    document.getElementById("council-count").textContent = "(" + council.length + "/" + COUNCIL + ")";
    document.getElementById("council-score").textContent = "Score " + total;
    document.getElementById("lock-btn").disabled = council.length !== COUNCIL || locked;
  }

  function pick(h) {
    if (locked || council.length >= COUNCIL || council.indexOf(h) !== -1) return;
    council.push(h); renderPool(); renderCouncil();
  }
  function unpick(h) {
    if (locked) return;
    council = council.filter(function (x) { return x !== h; });
    renderPool(); renderCouncil();
  }

  document.getElementById("lock-btn").addEventListener("click", function () {
    if (council.length !== COUNCIL || locked) return;
    locked = true;
    // AI drafts greedily from the remainder.
    var remaining = pool.filter(function (h) { return council.indexOf(h) === -1; });
    var ai = remaining.sort(function (a, b) { return score(b) - score(a); }).slice(0, COUNCIL);
    var you = council.reduce(function (s, h) { return s + score(h); }, 0);
    var aiTot = ai.reduce(function (s, h) { return s + score(h); }, 0);
    var win = you > aiTot, tie = you === aiTot;

    renderPool(); renderCouncil();
    resultBox.innerHTML = "";
    resultBox.appendChild(el("div", { class: "mono", style: "font-size:18px;color:" + (win ? "var(--good)" : tie ? "var(--warn)" : "var(--bad)"),
      text: win ? "Your council wins, " + you + " to " + aiTot : tie ? "Dead heat at " + you : "AI council wins, " + aiTot + " to " + you }));
    resultBox.appendChild(el("div", { class: "mono mute", style: "font-size:12px;margin-top:8px", text: "AI drafted: " + ai.map(function (h) { return h.name; }).join(", ") }));

    var rec = HC.load("dr:record", { w: 0, l: 0, t: 0 });
    if (win) rec.w++; else if (tie) rec.t++; else rec.l++;
    HC.save("dr:record", rec);
    resultBox.appendChild(el("div", { class: "mono mute", style: "font-size:12px;margin-top:4px", text: "Record " + rec.w + "W " + rec.l + "L " + rec.t + "T" }));
    resultBox.appendChild(el("div", { style: "margin-top:12px" }, [
      el("button", { class: "btn", text: "Try a different council", onclick: function () { reset(); } })
    ]));
  });

  function reset() {
    council = []; locked = false; resultBox.innerHTML = "";
    renderPool(); renderCouncil();
  }

  renderPool();
  renderCouncil();
})();
