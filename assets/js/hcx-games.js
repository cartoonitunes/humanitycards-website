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
  // Playable duel on the real relationship graph (relationships.js).
  // Rules: pick a card, pick a target. A direct historical edge (killed,
  // defeated, succeeded, opposed, influenced) is an instant strike and your
  // card stays ready. No edge: higher influence strikes but exhausts your
  // card; lower or tied influence and your card falls. Clear the council
  // before your hand runs out.
  var REL_VERB = { KILLED: "killed", DEFEATED: "defeated", SUCCEEDED: "succeeded", OPPOSED: "opposed", INFLUENCED: "influenced" };
  function AssassinationPage() {
    var H = window.HCX, REL = window.HCX_REL;
    var wallet = window.useWallet();
    var st;
    var host = h("div", null);
    function rr() { host.innerHTML = ""; host.appendChild(build()); }

    function newGame() {
      var pool = shuffle(((wallet.connected && H.OWNED.length >= 10) ? H.OWNED : H.FIGURES).slice());
      var council = pool.slice(0, 5);
      // bias the deal: up to 3 hand cards hold a real edge over the council,
      // so history is actually in play most games
      var rest = pool.slice(5);
      var hand = rest.filter(function (f) {
        return council.some(function (c) { return REL.edge(f.humanId, c.humanId); });
      }).slice(0, 3);
      for (var i = 0; i < rest.length && hand.length < 5; i++)
        if (hand.indexOf(rest[i]) < 0) hand.push(rest[i]);
      st = { council: council, hand: shuffle(hand), struck: {}, spent: {}, lost: {},
             sel: null, target: null, last: null, over: null };
    }

    function usable(f) { return !st.spent[f.humanId] && !st.lost[f.humanId]; }
    function strike() {
      var a = st.sel, d = st.target;
      if (!a || !d || st.over) return;
      var e = REL.edge(a.humanId, d.humanId);
      if (e) {
        st.struck[d.humanId] = true;
        st.last = { win: true, edge: e, a: a, d: d };
      } else if (a.stats.influence > d.stats.influence) {
        st.struck[d.humanId] = true;
        st.spent[a.humanId] = true;
        st.last = { win: true, edge: null, a: a, d: d };
      } else {
        st.lost[a.humanId] = true;
        st.last = { win: false, edge: null, a: a, d: d };
      }
      st.sel = null; st.target = null;
      if (st.council.every(function (c) { return st.struck[c.humanId]; })) st.over = "win";
      else if (!st.hand.some(usable)) st.over = "loss";
      rr();
    }

    function cardCell(f, dim, tag, tagColor, selected, onClick) {
      return h("div", { onClick: onClick || null,
        style: { position: "relative", cursor: onClick ? "pointer" : "default", borderRadius: "8px",
          opacity: dim ? 0.38 : 1, transform: selected ? "translateY(-8px)" : "none", transition: "transform .2s, opacity .3s",
          boxShadow: selected ? "0 0 0 2px " + (tagColor || COPPER) + ", 0 0 26px -8px " + (tagColor || COPPER) : "none" } },
        window.Card({ figure: f, badge: false, glow: false }),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "7px 9px", display: "flex", justifyContent: "space-between",
          background: "linear-gradient(transparent,#000d)", font: "700 11px/1 " + MONO, color: "#fff", borderRadius: "0 0 7px 7px" } },
          h("span", null, "INF"), h("span", { style: { color: "#e8c89a" } }, String(f.stats.influence))),
        tag ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          font: "700 13px/1 " + MONO, letterSpacing: ".1em", color: tagColor || "#d0563a", background: "#000a", borderRadius: "7px" } }, tag) : null);
    }

    function tiesPanel(f) {
      var ties = REL.edgesFor(f.humanId);
      var onBoard = {};
      st.council.forEach(function (c) { onBoard[c.humanId] = true; });
      ties.sort(function (x, y) { return (onBoard[y.overId] ? 1 : 0) - (onBoard[x.overId] ? 1 : 0); });
      return h("div", { style: { background: PANEL, border: "1px solid " + RULE, borderRadius: "9px", padding: "18px 20px", maxWidth: "760px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" } },
          h("h3", { style: { margin: 0, font: "700 17px/1 " + MONO, color: INK } }, f.name + "'s edges in history"),
          window.Kicker({ color: DIM }, "Instant strikes")),
        ties.length
          ? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
              ties.slice(0, 6).map(function (t) {
                var o = H.byId(t.overId), hot = onBoard[t.overId];
                return h("span", { title: t.note, style: { font: "600 11.5px/1.4 " + MONO, color: hot ? "#13101f" : INK,
                  background: hot ? "#5fae6e" : "#ffffff08", border: "1px solid " + (hot ? "#5fae6e" : RULE),
                  borderRadius: "30px", padding: "8px 13px" } }, REL_VERB[t.type] + " → " + (o ? o.name : t.overId));
              }))
          : h("div", { style: { font: "400 12.5px/1.5 " + SANS, color: DIM } }, "No recorded edges — this one fights on influence alone."));
    }

    function resultPanel(r) {
      var head = r.win
        ? (r.edge ? r.a.name + " strikes — history sides with the " + REL_VERB[r.edge.type] : r.a.name + " overpowers " + r.d.name)
        : r.a.name + " falls to " + r.d.name;
      var body = r.edge ? r.edge.note
        : "Influence " + r.a.stats.influence + " vs " + r.d.stats.influence +
          (r.win ? " — the strike lands, but the effort exhausts your card." : " — the defender holds. Your card is gone.");
      return h("div", { style: { background: PANEL, border: "1px solid " + (r.win ? "#5fae6e55" : "#d0563a55"), borderRadius: "9px", padding: "16px 20px", maxWidth: "760px" } },
        h("div", { style: { font: "700 15px/1.3 " + MONO, color: r.win ? "#5fae6e" : "#d0563a", marginBottom: "6px" } }, head),
        h("div", { style: { font: "400 13px/1.55 " + SANS, color: "#c3bdae" } }, body));
    }

    function build() {
      var ready = st.sel && st.target && !st.over;
      return GameShell({ kicker: "Connections · 1v1", title: "Assassination",
        body: "Every edge here is real: 165 documented kill / defeat / succession / rivalry / influence links among the 239. Play a card with a direct edge over the target and the strike is instant; otherwise higher influence wins, and the defender takes ties." },
        h("div", { className: "assassin-board", style: { display: "grid", gridTemplateColumns: "1fr", gap: "22px" } },
          h("div", null,
            h("div", { style: { font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "14px" } },
              "OPPONENT'S COUNCIL — " + st.council.filter(function (c) { return !st.struck[c.humanId]; }).length + " STANDING"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", maxWidth: "760px" } },
              st.council.map(function (f) {
                var down = !!st.struck[f.humanId];
                return cardCell(f, down, down ? "STRUCK" : null, "#d0563a", st.target === f,
                  down || st.over ? null : function () { st.target = (st.target === f ? null : f); rr(); });
              }))),
          h("div", { style: { position: "relative", padding: "20px 0", textAlign: "center" } },
            window.DottedRule({ style: { position: "absolute", left: 0, right: 0, top: "50%" } }),
            h("span", { style: { position: "relative", background: BG, padding: "0 16px", font: "600 11px/1 " + MONO, letterSpacing: ".18em", color: DIM } },
              st.over === "win" ? "COUNCIL ELIMINATED" : st.over === "loss" ? "YOUR HAND IS SPENT" :
              ready ? (REL.edge(st.sel.humanId, st.target.humanId) ? "HISTORY FAVOURS THIS STRIKE" : "NO EDGE — INFLUENCE DECIDES") : "PICK A CARD AND A TARGET")),
          h("div", null,
            h("div", { style: { font: "600 11px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "14px" } }, "YOUR HAND"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "16px", maxWidth: "760px" } },
              st.hand.map(function (f) {
                var gone = st.lost[f.humanId], used = st.spent[f.humanId];
                return cardCell(f, gone || used, gone ? "FALLEN" : used ? "SPENT" : null, gone ? "#d0563a" : "#8d8678", st.sel === f,
                  (gone || used || st.over) ? null : function () { st.sel = (st.sel === f ? null : f); rr(); });
              }))),
          h("div", { style: { display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" } },
            st.over
              ? window.Btn({ onClick: function () { newGame(); rr(); } }, st.over === "win" ? "Council down — play again" : "Avenged? Play again")
              : window.Btn({ disabled: !ready, onClick: strike }, ready ? "Strike " + st.target.name : "Strike"),
            st.over ? h("span", { style: { font: "700 14px/1 " + MONO, color: st.over === "win" ? "#5fae6e" : "#d0563a" } },
              st.over === "win" ? "All five struck. History was on your side." : "The council stands. Your hand is gone.") : null),
          st.last ? resultPanel(st.last) : null,
          (st.sel && !st.over) ? tiesPanel(st.sel) : null));
    }

    newGame();
    rr();
    return host;
  }

  Object.assign(window, { PlayHub: PlayHub, TimelinePage: TimelinePage, BattlePage: BattlePage, DraftPage: DraftPage, AssassinationPage: AssassinationPage });
})();
