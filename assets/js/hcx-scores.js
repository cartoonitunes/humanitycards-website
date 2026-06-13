/* hcx-scores.js — Turso-backed scores + leaderboards through /api/scores.
 * Results save while signed in. Identity is Google Sign-In first (the JWT goes
 * up as a Bearer token; the server reads the `sub`), and a connected wallet is
 * the legacy fallback. Pre-existing localStorage Timeline stats sync up once per
 * identity. Everything here is fire-and-forget: a dead API never blocks or
 * breaks a game. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;
  // On Vercel the API is same-origin (/api/scores). Served from IPFS — the
  // eth.limo gateway (humanitycards.eth.limo) or any *.ipfs.* gateway host —
  // there is no same-origin backend, so point at the canonical Vercel API.
  var host = location.hostname;
  var ON_IPFS = host.indexOf("eth.limo") !== -1 || host.indexOf("ipfs") !== -1;
  var API = ON_IPFS ? "https://humanitycards.vercel.app/api/scores" : "/api/scores";
  var GAME_LABEL = { timeline: "Timeline", battle: "Battle", draft: "Draft", assassination: "Assassination" };
  var ADDR_RE = /^0x[0-9a-f]{40}$/i;

  function addr() { var w = window.useWallet(); return (w.connected && w.address) ? w.address : null; }
  function token() { var a = window.useAuth ? window.useAuth() : null; return (a && a.signedIn && a.token) ? a.token : null; }

  // The caller's identity for a request. Google wins; wallet is the fallback.
  //   { token } → Bearer auth (the server derives the uid from the JWT)
  //   { wallet } → legacy wallet auth (address in the body / query)
  function ident() {
    var t = token(); if (t) return { token: t };
    var a = addr(); if (a) return { wallet: a };
    return null;
  }
  // The caller's row key as the server stores it, for "you" highlighting in the
  // top list ("g:<sub>" for Google, lowercased address for wallet).
  function myUid() {
    var a = window.useAuth ? window.useAuth() : null;
    if (a && a.signedIn && a.sub) return "g:" + a.sub;
    var w = addr(); return w ? w.toLowerCase() : null;
  }
  function authHeaders(id, base) {
    var hd = base || {};
    if (id && id.token) hd["Authorization"] = "Bearer " + id.token;
    return hd;
  }

  var liveWidgets = [];   // mounted leaderboard panels; re-fetched after a submit

  function refresh(game) {
    liveWidgets = liveWidgets.filter(function (w) { return w.el.isConnected; });
    liveWidgets.forEach(function (w) { if (w.game === game) w.load(); });
  }
  function refreshAll() {
    liveWidgets = liveWidgets.filter(function (w) { return w.el.isConnected; });
    liveWidgets.forEach(function (w) { w.load(); });
  }

  function submit(game, score, win, meta) {
    var id = ident();
    if (!id) return Promise.resolve(null);
    var body = { game: game, score: Math.max(0, Math.round(score)), win: !!win, meta: meta || null };
    if (id.wallet) body.wallet = id.wallet;
    return fetch(API, {
      method: "POST",
      headers: authHeaders(id, { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) { refresh(game); return res; })
      .catch(function () { return null; });
  }

  function fetchBoard(game) {
    var id = ident();
    var url = API + "?game=" + encodeURIComponent(game) + ((id && id.wallet) ? "&wallet=" + id.wallet : "");
    return fetch(url, { headers: authHeaders(id) })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); });
  }

  // Ask the server whether the caller already finished the daily for `day` (the
  // caller's local date). Resolves to null when signed out or on any error —
  // callers fall back to localStorage. The server is authoritative so a cache
  // clear can't reset the daily. Returns { alreadyPlayed, solved, attempts,
  // score, att, streak, played, wins } when a result exists.
  function checkDaily(game, day) {
    var id = ident();
    if (!id) return Promise.resolve(null);
    var url = API + "?game=" + encodeURIComponent(game) + (id.wallet ? "&wallet=" + id.wallet : "") +
      "&checkDaily=1&day=" + encodeURIComponent(day);
    return fetch(url, { headers: authHeaders(id) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // How a board row is labelled: a chosen display name when present, otherwise a
  // shortened address (legacy wallet rows). Emails are never sent or shown.
  function rowLabel(r) {
    if (r.name) return r.name;
    if (ADDR_RE.test(r.wallet || "")) return window.shortAddr(r.wallet);
    return "Historian";   // a Google row without a name yet
  }

  function row(rank, r, mine, game) {
    return h("div", { style: { display: "flex", alignItems: "baseline", gap: "12px", padding: "9px 0",
        borderBottom: "1px dotted " + RULE, font: "600 12.5px/1 " + MONO, color: mine ? COPPER : INK } },
      h("span", { style: { width: "26px", color: mine ? COPPER : FAINT } }, String(rank)),
      h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
        rowLabel(r) + (mine ? " · you" : "")),
      (game === "timeline" && r.streak) ? h("span", { title: "current daily streak",
        style: { color: "#5fae6e", font: "600 11px/1 " + MONO } }, "streak " + r.streak) : null,
      h("span", { title: r.wins + " wins · " + r.games_played + " games" }, String(r.total_score)));
  }

  // Leaderboard panel for one game. Mounted at the bottom of each game page.
  function widget(game) {
    var body = h("div", { style: { padding: "8px 0", font: "400 12.5px/1.6 " + SANS, color: DIM } }, "Loading the board…");
    var el = h("div", { style: { marginTop: "44px", maxWidth: "560px" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" } },
        window.Kicker({ color: "#9c8cf0" }, "Leaderboard · " + (GAME_LABEL[game] || game)),
        h("span", { style: { font: "600 10px/1 " + MONO, letterSpacing: ".14em", color: FAINT } }, "TOTAL SCORE")),
      h("div", { style: { background: PANEL, border: "1px solid " + RULE, borderRadius: "9px", padding: "6px 18px 10px" } }, body));

    function load() {
      fetchBoard(game).then(function (data) {
        var me = myUid();
        body.innerHTML = "";
        if (!data.top || !data.top.length) {
          body.appendChild(h("div", { style: { padding: "8px 0", font: "400 12.5px/1.6 " + SANS, color: DIM } },
            me ? "No scores yet — finish a game and be first on the board."
               : "No scores yet. Sign in and your results land here."));
          return;
        }
        var meOnBoard = false;
        data.top.forEach(function (r, i) {
          var mine = !!me && r.wallet === me;
          meOnBoard = meOnBoard || mine;
          body.appendChild(row(i + 1, r, mine, game));
        });
        if (data.you && !meOnBoard) body.appendChild(row(data.you.rank, data.you, true, game));
        if (!me) body.appendChild(h("div", { style: { padding: "10px 0 4px", font: "400 11.5px/1.5 " + SANS, color: FAINT } },
          "Sign in to save your results."));
      }).catch(function () {
        body.innerHTML = "";
        body.appendChild(h("div", { style: { padding: "8px 0", font: "400 12.5px/1.5 " + SANS, color: FAINT } },
          "Leaderboard unavailable right now."));
      });
    }
    liveWidgets.push({ el: el, game: game, load: load });
    load();
    return el;
  }

  // One-shot sync: push localStorage Timeline stats up when an identity appears
  // (Google sign-in or wallet connect), so a streak built before signing in
  // isn't lost. The server never regresses a row that's already ahead.
  var lastSynced = null;
  function syncLocal() {
    var id = ident();
    if (!id) return;
    var key = id.token ? myUid() : id.wallet;   // re-sync when the identity changes
    if (key === lastSynced) return;
    lastSynced = key;
    var played = +(localStorage.getItem("hcx_tl_played") || 0);
    var wins = +(localStorage.getItem("hcx_tl_wins") || 0);
    var streak = +(localStorage.getItem("hcx_tl_streak") || 0);
    if (!played && !streak) return;
    var b = { game: "timeline", action: "sync", streak: streak, played: played, wins: wins };
    if (id.wallet) b.wallet = id.wallet;
    fetch(API, {
      method: "POST", headers: authHeaders(id, { "Content-Type": "application/json" }),
      body: JSON.stringify(b)
    }).then(function () { refresh("timeline"); }).catch(function () {});
  }
  // Sync + refresh boards whenever either identity changes.
  window.useWallet().subscribe(function () { syncLocal(); refreshAll(); });
  if (window.useAuth) window.useAuth().subscribe(function () { syncLocal(); refreshAll(); });

  window.HCX_SCORES = { submit: submit, widget: widget, refresh: refresh, refreshAll: refreshAll, syncLocal: syncLocal, checkDaily: checkDaily };
})();
