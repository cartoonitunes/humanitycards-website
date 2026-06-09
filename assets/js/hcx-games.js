/* hcx-games.js — vanilla port of games.jsx. Play hub + Timeline (daily,
 * login-gated, Wordle-style) + Battle + Draft + Assassination. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      BG = window.BG, PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;
  var PlayingWith = window.PlayingWith;

  function GameShell(opts) {
    var children = Array.prototype.slice.call(arguments, 1);
    return window.Section({ style: { paddingTop: "40px" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "30px" } },
        h("div", null,
          window.Kicker({ color: "#9c8cf0" }, opts.kicker),
          h("h1", { style: { margin: "14px 0 8px", font: "700 clamp(32px,5vw,48px)/1 " + MONO, color: INK } }, opts.title),
          h("p", { style: { margin: 0, maxWidth: "520px", font: "400 14px/1.6 " + SANS, color: DIM } }, opts.body)),
        PlayingWith(true)),
      children);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---- Play hub ----
  function PlayHub() {
    var r = window.useRouter();
    var games = [
      { id: "timeline", k: "Daily Puzzle", t: "Timeline", b: "Order five figures by birth year. One shared puzzle a day, with a streak to protect.", fig: "Cleopatra" },
      { id: "battle", k: "1v1", t: "Battle", b: "Draw, pick a stat, and pit your figure against the house. Higher number takes the trick.", fig: "Gengis Khan" },
      { id: "draft", k: "Council", t: "Draft", b: "Assemble a five-figure council to top the day's category. Spend your scarcity wisely.", fig: "Da Vinci" },
      { id: "assassination", k: "Connections", t: "Assassination", b: "Play figures bound by history — teacher, rival, heir — to remove your opponent's council.", fig: "Caesar" }
    ];
    return window.Section({ style: { paddingTop: "40px" } },
      window.Kicker({ color: "#9c8cf0" }, "Play"),
      h("h1", { style: { margin: "14px 0 8px", font: "700 clamp(34px,5vw,52px)/1 " + MONO, color: INK } }, "Put history in play"),
      h("p", { style: { margin: "0 0 14px", maxWidth: "560px", font: "400 15px/1.65 " + SANS, color: DIM } }, "Every game runs on random cards out of the box. Connect a wallet and it plays with your real deck instead."),
      h("div", { style: { marginBottom: "30px" } }, PlayingWith(true)),
      h("div", { className: "play-grid", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" } },
        games.map(function (g) {
          return h("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: "20px", background: PANEL, border: "1px solid " + RULE, borderRadius: "10px", padding: "20px", alignItems: "center" } },
            h("div", { style: { width: "120px" } }, window.Card({ figure: window.HCX.byName(g.fig), badge: false, glow: false })),
            h("div", null,
              window.Kicker({ color: "#9c8cf0" }, g.k),
              h("h3", { style: { margin: "10px 0 6px", font: "700 22px/1 " + MONO, color: INK } }, g.t),
              h("p", { style: { margin: "0 0 16px", font: "400 13px/1.55 " + SANS, color: DIM } }, g.b),
              window.Btn({ size: "sm", onClick: function () { r.go(g.id); } }, "Play " + g.t)));
        })));
  }

  // ---- Timeline ----
  var TL_MAX = 4;
  function tlDateKey(d) { d = d || new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function tlYesterdayKey() { var d = new Date(); d.setDate(d.getDate() - 1); return tlDateKey(d); }
  function tlLoad(key) { try { return JSON.parse(localStorage.getItem("hcx_tl_" + key)) || null; } catch (e) { return null; } }
  function tlSave(key, rec) { localStorage.setItem("hcx_tl_" + key, JSON.stringify(rec)); }
  function tlGet(k, d) { var v = localStorage.getItem(k); return v == null ? d : v; }
  function seededShuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function tlStat(label, value) {
    return h("div", null,
      h("div", { style: { font: "700 20px/1 " + MONO, color: INK } }, String(value)),
      h("div", { style: { marginTop: "5px", font: "600 9.5px/1 " + MONO, letterSpacing: ".16em", color: DIM } }, label.toUpperCase()));
  }
  function TLPips(corr) {
    return h("div", { style: { display: "flex", gap: "5px" } },
      corr.map(function (ok) { return h("span", { style: { width: "13px", height: "13px", borderRadius: "3px",
        background: ok ? "#5fae6e" : "#2e2c28", boxShadow: ok ? "0 0 8px -2px #5fae6e" : "none" } }); }));
  }
  function arrowBtn(ch, fn, disabled) {
    return h("button", { onClick: disabled ? null : fn, disabled: disabled, style: {
      width: "38px", height: "32px", borderRadius: "5px", cursor: disabled ? "default" : "pointer",
      background: disabled ? "transparent" : PANEL, border: "1px solid " + RULE, color: disabled ? FAINT : INK,
      font: "400 13px/1 " + MONO, opacity: disabled ? 0.4 : 1 } }, ch);
  }

  function TimelinePage() {
    var wallet = window.useWallet();
    var base = window.HCX.TIMELINE_TODAY;
    var solvedOrder = base.slice().sort(function (a, b) { return a.born - b.born; });
    var today = tlDateKey();
    var saved = tlLoad(today);
    var record = saved || { order: null, att: [], finished: false, solved: false };
    var order = (saved && saved.order) ? saved.order.map(window.HCX.byId) : seededShuffle(base, window.HCX.seed(today + "-tl"));
    var showResult = !!(saved && saved.finished);
    var countdownTimer = null;

    var host = h("div", null);
    function rr() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } host.innerHTML = ""; host.appendChild(build()); }

    function correctness(o) { return o.map(function (f, i) { return f.humanId === solvedOrder[i].humanId; }); }
    function move(i, dir) {
      if (record.finished) return;
      var j = i + dir; if (j < 0 || j >= order.length) return;
      var t = order[i]; order[i] = order[j]; order[j] = t;
      showResult = false;
      record = Object.assign({}, record, { order: order.map(function (f) { return f.humanId; }) });
      tlSave(today, record); rr();
    }
    function lockIn() {
      var corr = correctness(order);
      var isSolved = corr.every(Boolean);
      var att = record.att.concat([corr]);
      var finished = isSolved || att.length >= TL_MAX;
      record = { order: order.map(function (f) { return f.humanId; }), att: att, finished: finished, solved: isSolved };
      tlSave(today, record); showResult = true;
      if (finished && tlGet("hcx_tl_last", "") !== today) {
        localStorage.setItem("hcx_tl_last", today);
        localStorage.setItem("hcx_tl_played", (+tlGet("hcx_tl_played", 0)) + 1);
        if (isSolved) {
          localStorage.setItem("hcx_tl_wins", (+tlGet("hcx_tl_wins", 0)) + 1);
          var cont = tlGet("hcx_tl_streakLast", "") === tlYesterdayKey();
          localStorage.setItem("hcx_tl_streak", cont ? (+tlGet("hcx_tl_streak", 0)) + 1 : 1);
          localStorage.setItem("hcx_tl_streakLast", today);
        } else { localStorage.setItem("hcx_tl_streak", 0); }
      }
      rr();
    }

    function build() {
      var stats = { streak: +tlGet("hcx_tl_streak", 0), played: +tlGet("hcx_tl_played", 0), wins: +tlGet("hcx_tl_wins", 0) };
      var lastScore = record.att.length ? record.att[record.att.length - 1].filter(Boolean).length : 0;
      var attemptsLeft = TL_MAX - record.att.length;

      if (!wallet.connected) {
        return GameShell({ kicker: "Daily Puzzle", title: "Timeline", body: "Order five figures by birth year. One shared puzzle a day — your streak is tracked." },
          h("div", { style: { position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid " + RULE } },
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", padding: "40px", filter: "blur(4px) saturate(.6)", opacity: 0.45, pointerEvents: "none" } },
              base.map(function (f) { return window.Card({ figure: f, badge: false, glow: false }); })),
            h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px",
              background: "radial-gradient(60% 80% at 50% 50%, rgba(11,11,14,.55), rgba(11,11,14,.93))" } },
              h("div", { style: { font: "700 30px/1 " + MONO, color: "#9c8cf0", marginBottom: "18px" } }, "⬡"),
              window.Kicker({ color: "#9c8cf0" }, "Sign in to play"),
              h("h2", { style: { margin: "16px 0 10px", font: "700 clamp(24px,4vw,34px)/1.1 " + MONO, color: INK, maxWidth: "20ch" } }, "The Daily keeps your streak"),
              h("p", { style: { margin: "0 0 24px", maxWidth: "400px", font: "400 14px/1.6 " + SANS, color: DIM } }, "Connect your wallet to play today's puzzle. We track your attempts, win rate and day streak — one puzzle, four tries, fresh figures every day."),
              window.Btn({ onClick: wallet.toggle }, "Connect Wallet to Play"),
              stats.streak > 0 ? h("div", { style: { marginTop: "20px", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, "CURRENT STREAK · " + stats.streak + " DAYS") : null)));
      }

      return GameShell({ kicker: "Daily Puzzle · " + new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }), title: "Timeline", body: "Use the arrows to order these five, earliest birth on the left. Four tries — your streak's on the line." },
        h("div", { style: { display: "flex", gap: "26px", flexWrap: "wrap", alignItems: "center", padding: "14px 20px", background: PANEL, border: "1px solid " + RULE, borderRadius: "9px", marginBottom: "26px" } },
          tlStat("Streak", stats.streak), tlStat("Win Rate", stats.played ? Math.round(stats.wins / stats.played * 100) + "%" : "—"), tlStat("Played", stats.played),
          h("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" } },
            h("span", { style: { font: "600 10.5px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, record.finished ? "DONE" : "ATTEMPT " + (record.att.length + 1) + " / " + TL_MAX),
            record.att.length > 0 ? TLPips(record.att[record.att.length - 1]) : null)),
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, textTransform: "uppercase", marginBottom: "14px" } },
          h("span", null, "← Earliest"), h("span", null, "Latest →")),
        h("div", { className: "tl-row", style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px" } },
          order.map(function (f, i) {
            var ok = showResult && f.humanId === solvedOrder[i].humanId;
            var bad = showResult && !ok;
            return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
              h("div", { style: { position: "relative", borderRadius: "8px",
                boxShadow: ok ? "0 0 0 2px #5fae6e, 0 0 24px -8px #5fae6e" : bad ? "0 0 0 2px #d0563a" : "none", transition: "box-shadow .3s" } },
                window.Card({ figure: f, badge: false, glow: false }),
                showResult ? h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "8px", textAlign: "center",
                  font: "700 13px/1 " + MONO, color: "#fff", background: "linear-gradient(transparent,#000c)", letterSpacing: ".05em" } }, window.HCX.eraLabel(f.born)) : null),
              !record.finished ? h("div", { style: { display: "flex", gap: "8px", justifyContent: "center" } },
                arrowBtn("◀", function () { move(i, -1); }, i === 0),
                arrowBtn("▶", function () { move(i, 1); }, i === order.length - 1)) : null);
          })),
        h("div", { style: { marginTop: "30px" } },
          record.finished
            ? TLDone(record.solved, record.att, stats)
            : h("div", { style: { display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" } },
                window.Btn({ onClick: lockIn }, "Lock In Order"),
                showResult ? h("div", { style: { font: "400 13px/1.5 " + SANS, color: DIM } },
                  h("strong", { style: { color: INK, fontWeight: 700 } }, lastScore + " / 5 in place"),
                  " · " + attemptsLeft + (attemptsLeft === 1 ? " try left — make it count" : " tries left")) : null)));
    }

    function TLDone(solved, attempts, stats) {
      return h("div", { style: { display: "flex", flexWrap: "wrap", gap: "30px", alignItems: "center", animation: "fadeUp .4s ease both" } },
        h("div", null,
          h("div", { style: { font: "700 24px/1 " + MONO, color: solved ? "#5fae6e" : "#d0563a", marginBottom: "8px" } },
            solved ? "Solved in " + attempts.length + (attempts.length === 1 ? " try" : " tries") : "Out of tries"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "6px" } }, attempts.map(function (a) { return TLPips(a); })),
          h("div", { style: { font: "400 13px/1.5 " + SANS, color: DIM } },
            solved ? "Nicely done. Streak now " + stats.streak + "." : "The order is revealed above. Streak reset.")),
        h("div", { style: { paddingLeft: "30px", borderLeft: "1px solid " + RULE } },
          h("div", { style: { font: "600 10px/1 " + MONO, letterSpacing: ".16em", color: DIM, marginBottom: "10px" } }, "NEXT PUZZLE IN"),
          TLCountdown()));
    }
    function TLCountdown() {
      var span = h("span", { style: { font: "700 16px/1 " + MONO, color: INK, letterSpacing: ".06em" } }, "");
      function tick() {
        var n = new Date(), end = new Date(n); end.setHours(24, 0, 0, 0);
        var s = Math.max(0, Math.floor((end - n) / 1000));
        span.textContent = String(Math.floor(s / 3600)).padStart(2, "0") + ":" + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      }
      tick(); countdownTimer = setInterval(tick, 1000);
      return span;
    }

    rr();
    return host;
  }

  // ---- Battle ----
  function deckFor(wallet) {
    var src = (wallet.connected && window.HCX.OWNED.length) ? window.HCX.OWNED : window.HCX.FIGURES;
    return shuffle(src.slice()).slice(0, 16);
  }
  function drawRound(deck) { var d = shuffle(deck.slice()); return { mine: d[0], theirs: d[1] || d[0] }; }
  function statName(k) { return ({ influence: "Influence", intellect: "Intellect", dominion: "Dominion", legacy: "Legacy" })[k]; }
  function BattlePage() {
    var wallet = window.useWallet();
    var STATS = [["influence", "Influence"], ["intellect", "Intellect"], ["dominion", "Dominion"], ["legacy", "Legacy"]];
    var deck = deckFor(wallet);
    var round = drawRound(deck);
    var scoreV = [0, 0];
    var result = null;
    var host = h("div", null);
    function rr() { host.innerHTML = ""; host.appendChild(build()); }
    function pick(stat) {
      if (result) return;
      var mine = round.mine.stats[stat], theirs = round.theirs.stats[stat];
      var win = mine > theirs, tie = mine === theirs;
      if (!tie) { if (win) scoreV[0]++; else scoreV[1]++; }
      result = { stat: stat, win: win, tie: tie, mine: mine, theirs: theirs }; rr();
    }
    function next() { round = drawRound(deck); result = null; rr(); }
    function build() {
      return GameShell({ kicker: "1v1 · Best of 9", title: "Battle", body: "Your card is face-up, the house's is hidden. Choose the stat you trust, then see if it holds." },
        h("div", { style: { display: "flex", justifyContent: "center", gap: "30px", marginBottom: "24px", font: "700 18px/1 " + MONO } },
          h("span", { style: { color: COPPER } }, "You " + scoreV[0]),
          h("span", { style: { color: FAINT } }, "·"),
          h("span", { style: { color: "#9c8cf0" } }, scoreV[1] + " House")),
        h("div", { className: "battle-row", style: { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "30px", alignItems: "center", maxWidth: "820px", margin: "0 auto" } },
          h("div", null,
            h("div", { style: { maxWidth: "260px", margin: "0 auto" } }, window.Card({ figure: round.mine, glow: true })),
            h("div", { style: { textAlign: "center", marginTop: "12px", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, "YOUR DRAW")),
          h("div", { style: { textAlign: "center", font: "700 20px/1 " + MONO, color: FAINT } }, "VS"),
          h("div", null,
            h("div", { style: { maxWidth: "260px", margin: "0 auto", position: "relative" } },
              result ? window.Card({ figure: round.theirs, glow: true })
                     : h("div", { style: { aspectRatio: "5/7", borderRadius: "7px", overflow: "hidden", boxShadow: "0 0 0 1px #ffffff14" } }, window.CardBack("#5a5346"))),
            h("div", { style: { textAlign: "center", marginTop: "12px", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM } }, "HOUSE"))),
        h("div", { style: { maxWidth: "560px", margin: "30px auto 0" } },
          result
            ? h("div", { style: { textAlign: "center" } },
                h("div", { style: { font: "700 22px/1 " + MONO, color: result.tie ? INK : result.win ? "#5fae6e" : "#d0563a", marginBottom: "8px" } },
                  result.tie ? "Tie" : result.win ? "You win the trick" : "House takes it"),
                h("div", { style: { font: "400 13px/1.5 " + SANS, color: DIM, marginBottom: "18px" } }, statName(result.stat) + " — you " + result.mine + ", house " + result.theirs),
                window.Btn({ onClick: next }, "Next Round"))
            : h("div", null,
                h("div", { style: { textAlign: "center", font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "14px" } }, "PICK YOUR STAT"),
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
                  STATS.map(function (s) {
                    return h("button", { onClick: function () { pick(s[0]); },
                      style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px",
                        background: PANEL, border: "1px solid " + RULE, borderRadius: "7px", cursor: "pointer",
                        font: "600 13px/1 " + MONO, color: INK, letterSpacing: ".06em", transition: "border-color .18s" },
                      onMouseEnter: function (e) { e.currentTarget.style.borderColor = COPPER; },
                      onMouseLeave: function (e) { e.currentTarget.style.borderColor = RULE; } },
                      h("span", null, s[1]), h("span", { style: { color: COPPER } }, String(round.mine.stats[s[0]])));
                  })))));
    }
    rr();
    return host;
  }

  // ---- Draft ----
  function DraftPage() {
    var wallet = window.useWallet();
    var pool = shuffle(((wallet.connected && window.HCX.OWNED.length) ? window.HCX.OWNED : window.HCX.FIGURES).slice()).slice(0, 12);
    var picked = [];
    var CATEGORY = "Minds of the Enlightenment", target = 380;
    var host = h("div", null);
    function rr() { host.innerHTML = ""; host.appendChild(build()); }
    function toggle(f) {
      var idx = picked.indexOf(f);
      if (idx >= 0) picked.splice(idx, 1);
      else if (picked.length < 5) picked.push(f);
      rr();
    }
    function build() {
      var total = picked.reduce(function (n, f) { return n + f.stats.intellect; }, 0);
      return GameShell({ kicker: "Council · Daily Category", title: "Draft", body: "Pick a five-figure council. Today they're scored on Intellect — beat the bar to place on the board." },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", padding: "16px 20px", background: PANEL, border: "1px solid " + RULE, borderRadius: "9px", marginBottom: "24px" } },
          h("div", null, window.Kicker({ color: "#9c8cf0" }, "Today's brief"),
            h("div", { style: { marginTop: "6px", font: "700 18px/1 " + MONO, color: INK } }, CATEGORY)),
          h("div", { style: { textAlign: "right" } },
            h("div", { style: { font: "700 24px/1 " + MONO, color: total >= target ? "#5fae6e" : INK } }, total + " / " + target),
            h("div", { style: { font: "600 10px/1.4 " + MONO, letterSpacing: ".14em", color: DIM, marginTop: "5px" } }, picked.length + "/5 CHOSEN · INTELLECT"))),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "18px" } },
          pool.map(function (f) {
            var on = picked.indexOf(f) >= 0;
            return h("div", { onClick: function () { toggle(f); },
              style: { position: "relative", cursor: "pointer", borderRadius: "8px",
                boxShadow: on ? "0 0 0 2px #9c8cf0, 0 0 26px -8px #9c8cf0" : "none", transition: "box-shadow .2s", opacity: (!on && picked.length >= 5) ? 0.5 : 1 } },
              window.Card({ figure: f, badge: false, glow: false }),
              h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(transparent,#000d)", font: "700 12px/1 " + MONO, color: "#fff" } },
                h("span", null, "INT"), h("span", { style: { color: "#c7b9ff" } }, String(f.stats.intellect))),
              on ? h("div", { style: { position: "absolute", top: "10px", left: "10px", width: "22px", height: "22px", borderRadius: "50%", background: "#9c8cf0", color: "#13101f", font: "700 12px/22px " + MONO, textAlign: "center" } }, String(picked.indexOf(f) + 1)) : null);
          })),
        h("div", { style: { marginTop: "26px", textAlign: "center" } },
          window.Btn({ disabled: picked.length < 5, onClick: function () {} }, picked.length < 5 ? "Choose " + (5 - picked.length) + " more" : (total >= target ? "Submit Council — you placed!" : "Submit Council"))));
    }
    rr();
    return host;
  }

  // ---- Assassination ----
  function boardRow(label, figs, opponent) {
    return h("div", null,
      h("div", { style: { font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "14px" } }, label.toUpperCase()),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", maxWidth: "760px" } },
        figs.map(function (f, i) {
          return h("div", { style: { opacity: opponent && i === 1 ? 0.4 : 1, position: "relative" } },
            window.Card({ figure: f, badge: false, glow: false }),
            opponent && i === 1 ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px/1 " + MONO, letterSpacing: ".1em", color: "#d0563a", background: "#000a", borderRadius: "7px" } }, "STRUCK") : null);
        })));
  }
  function AssassinationPage() {
    var s = 0;
    var hand = ["Caesar", "Hannibal", "Cleopatra", "Gengis Khan", "Napoleon"].map(window.HCX.byName).filter(Boolean);
    var connections = {
      "Caesar": ["Heir → Augustus", "Ally → Cleopatra", "Rival → Pompey"],
      "Hannibal": ["Rival → Scipio Africanus", "Father → Hamilcar", "Echo → Napoleon"],
      "Cleopatra": ["Ally → Caesar", "Rival → Augustus", "Love → Mark Antony"],
      "Gengis Khan": ["Era → Marco Polo", "Echo → Attila", "Foe → William the Conqueror"],
      "Napoleon": ["Echo → Caesar", "Era → Beethoven", "Mind → Karl Marx"]
    };
    var host = h("div", null);
    function rr() { host.innerHTML = ""; host.appendChild(build()); }
    function build() {
      var cur = hand[s];
      return GameShell({ kicker: "Connections · 1v1", title: "Assassination", body: "Play a figure, then chain another bound to them by history — teacher, heir, rival — to strike a card from your opponent's council." },
        h("div", { className: "assassin-board", style: { display: "grid", gridTemplateColumns: "1fr", gap: "22px" } },
          boardRow("Opponent's Council", ["Augustus", "Marco Polo", "Spartacus", "Beethoven", "Charlemagne"].map(window.HCX.byName).filter(Boolean), true),
          h("div", { style: { position: "relative", padding: "26px 0", textAlign: "center" } },
            window.DottedRule({ style: { position: "absolute", left: 0, right: 0, top: "50%" } }),
            h("span", { style: { position: "relative", background: BG, padding: "0 16px", font: "600 11px/1 " + MONO, letterSpacing: ".18em", color: DIM } }, "PLAY A CONNECTION")),
          h("div", null,
            h("div", { style: { font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "14px" } }, "YOUR HAND"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", maxWidth: "760px" } },
              hand.map(function (f, i) {
                return h("div", { onClick: function () { s = i; rr(); },
                  style: { cursor: "pointer", borderRadius: "8px", transform: i === s ? "translateY(-8px)" : "none", transition: "transform .2s",
                    boxShadow: i === s ? "0 0 0 2px " + COPPER + ", 0 0 26px -8px " + COPPER : "none" } },
                  window.Card({ figure: f, badge: false, glow: false }));
              }))),
          cur ? h("div", { style: { background: PANEL, border: "1px solid " + RULE, borderRadius: "9px", padding: "20px 22px", maxWidth: "760px" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" } },
              h("h3", { style: { margin: 0, font: "700 18px/1 " + MONO, color: INK } }, cur.name + "'s ties"),
              window.Kicker({ color: DIM }, "Chain to strike")),
            h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
              (connections[cur.name] || ["No recorded ties"]).map(function (c) {
                return h("span", { style: { font: "600 12px/1 " + MONO, color: INK, background: "#ffffff08", border: "1px solid " + RULE, borderRadius: "30px", padding: "9px 14px" } }, c);
              }))) : null));
    }
    rr();
    return host;
  }

  Object.assign(window, { PlayHub: PlayHub, TimelinePage: TimelinePage, BattlePage: BattlePage, DraftPage: DraftPage, AssassinationPage: AssassinationPage });
})();
