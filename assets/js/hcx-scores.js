/* hcx-scores.js — Turso-backed scores + leaderboards through /api/scores.
 * Results save only while a wallet is connected — the address is the identity
 * (v1: no signature). Pre-existing localStorage Timeline stats sync up once
 * per connected address. Everything here is fire-and-forget: a dead API never
 * blocks or breaks a game. */
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

  function addr() { var w = window.useWallet(); return (w.connected && w.address) ? w.address : null; }

  var liveWidgets = [];   // mounted leaderboard panels; re-fetched after a submit

  function refresh(game) {
    liveWidgets = liveWidgets.filter(function (w) { return w.el.isConnected; });
    liveWidgets.forEach(function (w) { if (w.game === game) w.load(); });
  }

  function submit(game, score, win, meta) {
    var a = addr();
    if (!a) return Promise.resolve(null);
    return fetch(API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: a, game: game, score: Math.max(0, Math.round(score)), win: !!win, meta: meta || null })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) { refresh(game); return res; })
      .catch(function () { return null; });
  }

  function fetchBoard(game) {
    var a = addr();
    return fetch(API + "?game=" + encodeURIComponent(game) + (a ? "&wallet=" + a : ""))
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); });
  }

  function row(rank, r, mine, game) {
    return h("div", { style: { display: "flex", alignItems: "baseline", gap: "12px", padding: "9px 0",
        borderBottom: "1px dotted " + RULE, font: "600 12.5px/1 " + MONO, color: mine ? COPPER : INK } },
      h("span", { style: { width: "26px", color: mine ? COPPER : FAINT } }, String(rank)),
      h("span", { style: { flex: 1, minWidth: 0 } }, window.shortAddr(r.wallet) + (mine ? " · you" : "")),
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
        var me = addr(); me = me && me.toLowerCase();
        body.innerHTML = "";
        if (!data.top || !data.top.length) {
          body.appendChild(h("div", { style: { padding: "8px 0", font: "400 12.5px/1.6 " + SANS, color: DIM } },
            me ? "No scores yet — finish a game and be first on the board."
               : "No scores yet. Connect a wallet and your results land here."));
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
          "Connect a wallet to save your results."));
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

  // One-shot sync: push localStorage Timeline stats up when a wallet connects,
  // so a streak built before sign-in isn't lost. The server never regresses a
  // row that's already ahead.
  var lastSynced = null;
  function syncLocal() {
    var a = addr();
    if (!a || a === lastSynced) return;
    lastSynced = a;
    var played = +(localStorage.getItem("hcx_tl_played") || 0);
    var wins = +(localStorage.getItem("hcx_tl_wins") || 0);
    var streak = +(localStorage.getItem("hcx_tl_streak") || 0);
    if (!played && !streak) return;
    fetch(API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: a, game: "timeline", action: "sync", streak: streak, played: played, wins: wins })
    }).then(function () { refresh("timeline"); }).catch(function () {});
  }
  window.useWallet().subscribe(syncLocal);

  window.HCX_SCORES = { submit: submit, widget: widget, refresh: refresh, syncLocal: syncLocal };
})();
