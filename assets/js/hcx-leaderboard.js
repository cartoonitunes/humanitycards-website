/* hcx-leaderboard.js — the Historian Score leaderboard page.
 *
 * Reads the ranked board from /api/leaderboard-hc and renders it: a top-3 trophy
 * podium, a compact table for the rest, tab filters (All-Time / This Week /
 * Collection / Games), and the viewer's own rank pinned at the bottom. If a
 * wallet is connected (or ?wallet=), it computes that player's Historian Score
 * on the fly (chain + hcx-score) and publishes it so the board stays warm. */
(function () {
  "use strict";
  var h = window.h, HCX = window.HCX, SETS = window.HCX_SETS, SCORE = window.HCX_SCORE, CH = window.HCX_CHAIN;
  if (!h || !HCX || !SCORE) return;
  var SITE = "https://humanitycards.vercel.app";

  function apiBase() {
    var onIpfs = /\.eth(\.limo)?$/.test(location.hostname) || location.hostname.indexOf(".ipfs.") >= 0;
    return onIpfs ? "https://humanitycards.vercel.app/api/leaderboard-hc" : "/api/leaderboard-hc";
  }
  function fmt(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function shortAddr(a) { return a && a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : (a || ""); }
  function token() { var a = window.useAuth ? window.useAuth() : null; return (a && a.signedIn && a.token) ? a.token : null; }

  var TABS = [
    { id: "alltime", label: "All-Time", metric: "total" },
    { id: "week", label: "This Week", metric: "weekly" },
    { id: "collection", label: "Collection", metric: "collection_score" },
    { id: "games", label: "Games", metric: "game_points" }
  ];

  var S = { tab: "alltime", address: null, top: [], you: null, loading: true, error: false, published: false };
  var root;

  // ---- small visual helpers -----------------------------------------------
  function rankInfo(total) { return SCORE.rankFor(total).rank; }
  function crest(rank, size) {
    return h("span", { className: "lb-crest" + (size ? " " + size : "") + (rank.prismatic ? " prismatic" : ""), style: { "--crest": rank.color } }, "★");
  }
  // deterministic avatar from a string (wallet/name)
  function avatar(seed, label, cls) {
    var s = String(seed || "x"), n = 0; for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    var hue = n % 360, hue2 = (hue + 40) % 360;
    var initials = (label || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "0x";
    return h("span", { className: "lb-av" + (cls ? " " + cls : ""),
      style: { background: "linear-gradient(135deg,hsl(" + hue + ",55%,42%),hsl(" + hue2 + ",55%,28%))" } }, initials);
  }
  function metricValue(row, tab) {
    if (tab === "week") return row.weekly || 0;
    if (tab === "collection") return row.collection_score || 0;
    if (tab === "games") return row.game_points || 0;
    return row.total || 0;
  }
  function metricLabel(tab) {
    if (tab === "week") return "this week";
    if (tab === "collection") return "collection";
    if (tab === "games") return "games";
    return "Historian Score";
  }
  function nameOf(row) { return row.name || shortAddr(row.wallet) || "Anonymous"; }

  // ============================================================ RENDER
  function render() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(Header());
    root.appendChild(Tabs());
    if (S.loading) { root.appendChild(stateBox("Loading the board…")); return; }
    if (S.error) { root.appendChild(stateBox("Couldn’t load the leaderboard. Try again shortly.")); return; }
    if (!S.top.length) { root.appendChild(EmptyBoard()); }
    else {
      root.appendChild(Podium(S.top.slice(0, 3)));
      if (S.top.length > 3) root.appendChild(Table(S.top.slice(3)));
    }
    if (S.you) root.appendChild(YouPin(S.you));
  }

  function Header() {
    return h("div", { className: "lb-head" },
      h("div", { className: "lb-kicker" }, "Leaderboard"),
      h("h1", null, "Historian Score"),
      h("p", { className: "lb-sub" },
        "Collection + games + achievements, ranked. A dedicated player can out-score a whale — but a whale who plays always pulls ahead."));
  }

  function Tabs() {
    var wrap = h("div", { className: "lb-tabs" });
    TABS.forEach(function (t) {
      wrap.appendChild(h("button", { className: "lb-tab" + (S.tab === t.id ? " active" : ""),
        onClick: function () { if (S.tab !== t.id) { S.tab = t.id; load(); } } }, t.label));
    });
    return wrap;
  }

  function Podium(top3) {
    // order visually: 2nd, 1st, 3rd (1st centered + tallest)
    var order = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    var wrap = h("div", { className: "lb-podium" });
    order.forEach(function (row) {
      if (!row) return;
      var place = top3.indexOf(row) + 1;
      var rk = rankInfo(row.total);
      var bd = row.breakdown ? safeJson(row.breakdown) : null;
      wrap.appendChild(h("div", { className: "lb-trophy p" + place + " " + rk.key + (rk.prismatic ? " prismatic" : ""), style: { "--accent": rk.color } },
        h("div", { className: "lb-place" }, "#" + place),
        avatar(row.wallet || row.name, nameOf(row), "big"),
        h("div", { className: "lb-tname" }, nameOf(row)),
        h("div", { className: "lb-trank" }, crest(rk), h("span", { style: { color: rk.color } }, rk.title)),
        h("div", { className: "lb-tscore" }, fmt(metricValue(row, S.tab))),
        h("div", { className: "lb-tscore-lbl" }, metricLabel(S.tab)),
        miniBreakdown(row),
        h("a", { className: "lb-tlink", href: "/collection?wallet=" + encodeURIComponent(row.wallet || "") }, "View collection ↗")));
    });
    return wrap;
  }

  function miniBreakdown(row) {
    return h("div", { className: "lb-mini" },
      miniStat("Collection", row.collection_score, "#C98A4B"),
      miniStat("Games", row.game_points, "#3B82F6"),
      miniStat("Badges", row.achievement_points, "#A855F7"),
      miniStat("Figures", row.unique_count, "#ECE7D8", true));
  }
  function miniStat(label, val, color, raw) {
    return h("div", { className: "lb-mini-i" },
      h("div", { className: "lb-mini-v", style: { color: color } }, raw ? (val || 0) : fmt(val)),
      h("div", { className: "lb-mini-l" }, label));
  }

  function Table(rest) {
    var rows = rest.map(function (row, i) {
      var place = i + 4;
      var rk = rankInfo(row.total);
      var me = S.address && row.wallet && row.wallet.toLowerCase() === S.address.toLowerCase();
      return h("a", { className: "lb-row" + (me ? " me" : ""), style: { "--accent": rk.color },
          href: "/collection?wallet=" + encodeURIComponent(row.wallet || "") },
        h("span", { className: "lb-r-place" }, place),
        avatar(row.wallet || row.name, nameOf(row)),
        h("span", { className: "lb-r-name" }, nameOf(row),
          h("span", { className: "lb-r-rank", style: { color: rk.color } }, rk.title)),
        h("span", { className: "lb-r-fig" }, (row.unique_count || 0) + "/" + SETS.TOTAL),
        h("span", { className: "lb-r-score" }, fmt(metricValue(row, S.tab))));
    });
    return h("div", { className: "lb-table" },
      h("div", { className: "lb-table-head" },
        h("span", null, "#"), h("span", null, "Collector"), h("span", { className: "lb-th-fig" }, "Figures"), h("span", null, metricLabel(S.tab))),
      rows);
  }

  function YouPin(you) {
    if (!you) return null;
    var rk = rankInfo(you.total);
    var onBoard = S.top.some(function (r) { return r.wallet && you.wallet && r.wallet.toLowerCase() === you.wallet.toLowerCase(); });
    return h("div", { className: "lb-youpin", style: { "--accent": rk.color } },
      h("span", { className: "lb-yp-tag" }, "You"),
      h("span", { className: "lb-yp-place" }, you.rank ? "#" + you.rank : "—"),
      avatar(you.wallet || you.name, nameOf(you)),
      h("span", { className: "lb-yp-name" }, nameOf(you), h("span", { className: "lb-yp-rank", style: { color: rk.color } }, rk.title)),
      h("span", { className: "lb-yp-score" }, fmt(metricValue(you, S.tab))),
      onBoard ? null : h("a", { className: "lb-yp-link", href: "/collection" + (S.address ? "?wallet=" + encodeURIComponent(S.address) : "") }, "Your collection ↗"));
  }

  function EmptyBoard() {
    return h("div", { className: "lb-empty" },
      h("div", { className: "lb-empty-ico" }, "🏛️"),
      h("h3", null, "The board is warming up"),
      h("p", null, "Be among the first ranked Historians. Connect your wallet to publish your Historian Score, or open a collection to compute one."),
      h("div", { className: "lb-empty-cta" },
        h("button", { className: "lb-btn primary", onClick: connect }, "Connect wallet"),
        h("a", { className: "lb-btn", href: "/collection" }, "Open Collection")));
  }

  function stateBox(msg) { return h("div", { className: "lb-state" }, msg); }
  function safeJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  // ============================================================ DATA
  function load() {
    S.loading = true; S.error = false; render();
    var t = token();
    var url = apiBase() + "?tab=" + S.tab + "&limit=50" + ((!t && S.address) ? "&wallet=" + encodeURIComponent(S.address) : "");
    var headers = {}; if (t) headers["Authorization"] = "Bearer " + t;
    fetch(url, { headers: headers }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { S.top = j.top || []; S.you = j.you || null; S.loading = false; render(); })
      .catch(function () { S.loading = false; S.error = true; render(); });
  }

  // Compute the connected/queried wallet's Historian Score from chain + publish,
  // so the viewer immediately appears on the board. Best-effort and async.
  function publishMyScore(addr) {
    if (!addr || S.published || !CH || !CH.loadOwned) return;
    S.published = true;
    var run = CH.refreshMinted ? CH.refreshMinted() : Promise.resolve();
    run.then(function () { return CH.loadOwned(addr); }).then(function (owned) {
      owned = owned || [];
      var id = {}; var t = token();
      if (t) id.token = t; else id.wallet = addr;
      return SCORE.gamePointsFor(id).then(function (gp) {
        var sc = SCORE.compute(owned, { gamePoints: gp.points, gameStats: gp.stats, now: Date.now() });
        var headers = { "content-type": "application/json" };
        if (t) headers["Authorization"] = "Bearer " + t;
        var body = { wallet: addr, collection_score: sc.collectionScore, game_points: sc.gamePoints,
          achievement_points: sc.achievementPoints, total: sc.total, unique_count: sc.uniques,
          breakdown: { m: sc.tiers.mythic, l: sc.tiers.legendary, e: sc.tiers.epic, r: sc.tiers.rare,
            un: sc.tiers.uncommon, c: sc.tiers.common, rank: sc.rank.title, ri: sc.rankIndex,
            sets: Object.keys(sc.completedSetIds).length } };
        return fetch(apiBase(), { method: "POST", headers: headers, body: JSON.stringify(body) });
      });
    }).then(function () { load(); }).catch(function () {});
  }

  function connect() {
    if (CH && CH.connect) CH.connect().then(function () {
      var w = window.useWallet();
      if (w.connected && w.address) { S.address = w.address; load(); publishMyScore(w.address); }
    });
  }

  // ============================================================ BOOT
  function boot() {
    root = document.getElementById("lb-root");
    if (!root) return;
    wireNav();
    var params = new URLSearchParams(location.search);
    var tab = params.get("tab");
    if (tab && TABS.some(function (t) { return t.id === tab; })) S.tab = tab;
    var walletParam = params.get("wallet");
    var w = window.useWallet ? window.useWallet() : { connected: false };

    if (walletParam && /^0x[0-9a-fA-F]{40}$/.test(walletParam)) S.address = walletParam;
    else if (w.connected && w.address) S.address = w.address;

    load();
    if (S.address) publishMyScore(S.address);

    // if a wallet connects (or auth lands) after load, refresh + publish
    if (window.useWallet) window.useWallet().subscribe(function () {
      var ww = window.useWallet();
      if (ww.connected && ww.address && ww.address !== S.address) { S.address = ww.address; load(); publishMyScore(ww.address); }
    });
    if (window.useAuth) window.useAuth().subscribe(function () { load(); });
  }

  // wallet chip in the static nav slot
  function wireNav() {
    var slot = document.getElementById("lb-wallet");
    if (!slot || !window.useWallet) return;
    var w = window.useWallet();
    function paint() {
      slot.innerHTML = "";
      if (w.connected && w.address) {
        slot.appendChild(h("button", { className: "lb-btn", onClick: function () { CH && CH.disconnect && CH.disconnect(); } }, shortAddr(w.address)));
      } else {
        slot.appendChild(h("button", { className: "lb-btn primary", onClick: connect }, "Connect"));
      }
    }
    w.subscribe(paint); paint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
