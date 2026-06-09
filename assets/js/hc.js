/* HumanityCards shared core: rarity model, on-chain-faithful colors, derived
 * stats, seeded RNG, and small DOM/util helpers. Loaded on every page before
 * the per-game scripts. Depends on HC_ROSTER + HC_CONFIG. */
(function () {
  "use strict";

  var ROSTER = window.HC_ROSTER || [];

  // --- Rarity tiers --------------------------------------------------------
  // Driven purely by maxSupply (lower supply = rarer), matching the contract.
  var TIERS = [
    { key: "genesis",  label: "Genesis 1-of-1", maxLE: 1,   rank: 6 },
    { key: "mythic",   label: "Mythic",         maxLE: 3,   rank: 5 },
    { key: "legendary",label: "Legendary",      maxLE: 5,   rank: 4 },
    { key: "epic",     label: "Epic",           maxLE: 20,  rank: 3 },
    { key: "rare",     label: "Rare",           maxLE: 30,  rank: 2 },
    { key: "uncommon", label: "Uncommon",       maxLE: 50,  rank: 1 },
    { key: "common",   label: "Common",         maxLE: 1e9, rank: 0 }
  ];

  function tierOf(max) {
    for (var i = 0; i < TIERS.length; i++) {
      if (max <= TIERS[i].maxLE) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  // Accent color reproduces the on-chain CardRenderer rarity scale:
  //   supply 1   -> hsl(14,78%)  (hot red, rarest)
  //   supply 3   -> hsl(21,61%)
  //   supply 5   -> hsl(25,52%)
  //   supply 50+ -> hsl(40,16%)  (dull gold, common)
  // Fitted log curve, clamped at both ends; lightness fixed at 60% like the art.
  function accent(max) {
    var l = Math.log(Math.max(1, max));
    var h = Math.min(40, 14 + 6.67 * l);
    var s = Math.max(16, 78 - 15.9 * l);
    return "hsl(" + h.toFixed(1) + "," + s.toFixed(1) + "%,60%)";
  }
  // A brighter variant for glows / UI accents on dark backgrounds.
  function accentGlow(max) {
    var l = Math.log(Math.max(1, max));
    var h = Math.min(40, 14 + 6.67 * l);
    var s = Math.max(40, 92 - 15.9 * l);
    return "hsl(" + h.toFixed(1) + "," + s.toFixed(1) + "%,66%)";
  }

  // --- Derived gameplay stats ---------------------------------------------
  // Kept here (not in the data file) so they stay consistent with supply.
  var YEAR_NOW = 2024;

  function eraScore(born) {
    // Older = higher, smoothly. 3100 BCE -> ~100, 2000 CE -> ~5.
    var age = YEAR_NOW - born;             // years before "now"
    return clamp(Math.round((Math.log(age + 50) / Math.log(5150)) * 100), 4, 100);
  }
  function rarityScore(max) {
    // Map tier rank 0..6 onto a 1-100 stat for Battle.
    var t = tierOf(max);
    return [22, 40, 55, 70, 84, 94, 100][t.rank];
  }
  function legacyScore(h) {
    // Longevity of legacy: influence weighted by how long it has endured.
    var endured = clamp((YEAR_NOW - h.born) / 35, 0, 100); // ~35 yrs per point
    return clamp(Math.round(h.inf * 0.6 + endured * 0.4), 1, 100);
  }

  // Attach everything derived to each human once, in place.
  ROSTER.forEach(function (h) {
    h.name = h.name.trim();
    var t = tierOf(h.max);
    h.tier = t.key;
    h.tierLabel = t.label;
    h.tierRank = t.rank;
    h.accent = accent(h.max);
    h.accentGlow = accentGlow(h.max);
    h.remaining = Math.max(0, h.max - h.mined);
    h.stats = {
      influence: h.inf,
      controversy: h.con,
      era: eraScore(h.born),
      rarity: rarityScore(h.max),
      legacy: legacyScore(h)
    };
  });

  // --- Lookups -------------------------------------------------------------
  var byId = {};
  ROSTER.forEach(function (h) { byId[h.id] = h; });

  // --- Utility -------------------------------------------------------------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Deterministic string hash -> 32-bit int.
  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  // Mulberry32 seeded PRNG -> function returning [0,1).
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    rand = rand || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n, rand) { return shuffle(arr, rand).slice(0, n); }

  // Today's UTC date as a stable daily seed string, e.g. "2026-06-09".
  function todayKey() {
    var d = new Date();
    return d.getUTCFullYear() + "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(d.getUTCDate()).padStart(2, "0");
  }

  // Pretty-print a birth year as "356 BCE" / "1452 CE".
  function yearLabel(y) {
    return y < 0 ? (-y) + " BCE" : y + " CE";
  }

  // Weighted random human by REMAINING supply, mirroring mineCard() odds.
  // Cards with 0 remaining cannot be drawn (just like the real contract).
  function weightedDraw(rand) {
    rand = rand || Math.random;
    var pool = ROSTER.filter(function (h) { return h.remaining > 0; });
    var total = pool.reduce(function (s, h) { return s + h.remaining; }, 0);
    var roll = rand() * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= pool[i].remaining;
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // localStorage JSON helpers (namespaced, fail-safe).
  function load(key, fallback) {
    try {
      var v = localStorage.getItem("hc:" + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem("hc:" + key, JSON.stringify(val)); } catch (e) {}
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") {
        n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  // Lightweight toast.
  function toast(msg, ms) {
    var t = document.getElementById("hc-toast");
    if (!t) {
      t = el("div", { id: "hc-toast", class: "hc-toast" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, ms || 2600);
  }

  // Shared top navigation, grouped into Collect and Play sections.
  var NAV_GROUPS = [
    { label: null, links: [["index.html", "Home"]] },
    { label: "Collect", links: [["packs.html", "Packs"], ["collection.html", "Collection"], ["roster.html", "Roster"]] },
    { label: "Play", links: [["timeline.html", "Timeline"], ["battle.html", "Battle"], ["draft.html", "Draft"], ["assassin.html", "Assassin"]] }
  ];
  function mountNav(active) {
    var host = document.querySelector("[data-hc-nav]");
    if (!host) return;
    var brand = el("a", { href: "index.html", class: "hc-brand" }, [
      el("span", { class: "hc-brand-mark", text: "H" }), "HumanityCards"
    ]);
    var nav = el("nav", { class: "hc-nav" });
    NAV_GROUPS.forEach(function (g) {
      var grp = el("div", { class: "hc-nav-group" });
      if (g.label) grp.appendChild(el("span", { class: "hc-nav-group-label", text: g.label }));
      g.links.forEach(function (n) {
        grp.appendChild(el("a", { href: n[0], class: "hc-nav-link" + (n[0] === active ? " active" : "") }, [n[1]]));
      });
      nav.appendChild(grp);
    });
    var walletBtn = el("button", { id: "hc-wallet-btn", class: "hc-wallet-btn", type: "button" }, ["Connect Wallet"]);
    host.className = "hc-header";
    host.appendChild(el("div", { class: "hc-header-inner" }, [brand, nav, walletBtn]));
  }

  // ---- Ownership-aware dealing -------------------------------------------
  // The connected wallet's owned humans, de-duplicated (empty when no wallet).
  function ownedHumans() {
    var ids = (window.HC.wallet && window.HC.wallet.state.owned) || [];
    var seen = {}, out = [];
    ids.forEach(function (id) { if (!seen[id] && byId[id]) { seen[id] = 1; out.push(byId[id]); } });
    return out;
  }
  // Deal a hand of n cards. Uses the player's collection first, padding with
  // random loaners. Returns { hand, ownedCount, isCollection }.
  function dealHand(n, opts) {
    opts = opts || {};
    var owned = ownedHumans();
    var hand = [];
    owned.slice(0, n).forEach(function (h) { hand.push(h); });
    var ownedCount = hand.length;
    var pool = shuffle((opts.pool || ROSTER).filter(function (h) { return hand.indexOf(h) === -1; }), opts.rand);
    var i = 0;
    while (hand.length < n && i < pool.length) hand.push(pool[i++]);
    return { hand: hand, ownedCount: ownedCount, isCollection: ownedCount > 0 };
  }
  // Render a "Playing with your collection / random cards" badge into host.
  function modeBadge(host, info) {
    if (!host) return;
    host.innerHTML = "";
    var coll = info && info.isCollection;
    var txt = coll
      ? "Playing with your collection · " + info.ownedCount + " card" + (info.ownedCount > 1 ? "s" : "")
      : "Playing with random loaner cards";
    host.appendChild(el("div", { class: "mode-badge " + (coll ? "coll" : "rand") }, [
      el("span", { class: "mode-dot" }), txt
    ]));
  }

  window.HC = {
    ROSTER: ROSTER, byId: byId, TIERS: TIERS,
    tierOf: tierOf, accent: accent, accentGlow: accentGlow,
    clamp: clamp, hashStr: hashStr, rng: rng, shuffle: shuffle, sample: sample,
    todayKey: todayKey, yearLabel: yearLabel, weightedDraw: weightedDraw,
    load: load, save: save, el: el, toast: toast, mountNav: mountNav,
    ownedHumans: ownedHumans, dealHand: dealHand, modeBadge: modeBadge,
    YEAR_NOW: YEAR_NOW
  };
})();
