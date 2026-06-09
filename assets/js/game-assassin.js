/* Assassination. The AI fields a target; you answer with a figure from your
 * hand. A direct historical edge is an instant kill. Otherwise the higher
 * influence survives the clash. First to the kill target wins. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("assassin.html");

  var TARGET_KILLS = 3, HAND = 6;

  var targetBox = document.getElementById("target-card");
  var playBox = document.getElementById("play-card");
  var handBox = document.getElementById("hand");
  var prompt = document.getElementById("assassin-prompt");
  var logBox = document.getElementById("kill-log");

  var hand = [], aiDeck = [], target = null, youKills = 0, aiKills = 0, resolving = false;

  function log(msg, cls) { logBox.insertBefore(el("p", { class: cls || "", html: msg }), logBox.firstChild); }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function newGame() {
    youKills = aiKills = 0;
    var assassinIds = {}; HC.rel.EDGES.forEach(function (e) { assassinIds[e[0]] = 1; });
    var victimIds = {}; HC.rel.EDGES.forEach(function (e) { victimIds[e[1]] = 1; });
    var assassins = HC.shuffle(Object.keys(assassinIds).map(function (id) { return HC.byId[+id]; }));
    var victims = HC.shuffle(Object.keys(victimIds).map(function (id) { return HC.byId[+id]; }));
    var famous = HC.shuffle(HC.ROSTER.filter(function (h) { return h.inf >= 70; }));

    // Your hand: a few proven assassins + strong filler.
    hand = [];
    assassins.slice(0, 3).forEach(function (h) { if (hand.indexOf(h) === -1) hand.push(h); });
    var fi = 0; while (hand.length < HAND) { var h = famous[fi++]; if (hand.indexOf(h) === -1) hand.push(h); }

    // AI target deck: mostly people you can kill, plus some tough randoms.
    aiDeck = [];
    victims.slice(0, 5).forEach(function (h) { if (aiDeck.indexOf(h) === -1) aiDeck.push(h); });
    var ri = 0; while (aiDeck.length < 9) { var t = famous[famous.length - 1 - ri++]; if (aiDeck.indexOf(t) === -1 && hand.indexOf(t) === -1) aiDeck.push(t); }
    aiDeck = HC.shuffle(aiDeck);

    logBox.innerHTML = "";
    document.getElementById("new-btn").style.display = "none";
    document.getElementById("sb-target").textContent = TARGET_KILLS;
    log("New game. Reach " + TARGET_KILLS + " kills before the AI does.");
    playBox.innerHTML = "";
    nextTarget();
  }

  function nextTarget() {
    resolving = false;
    document.getElementById("next-btn").style.display = "none";
    document.getElementById("sb-you").textContent = youKills;
    document.getElementById("sb-ai").textContent = aiKills;

    if (youKills >= TARGET_KILLS || aiKills >= TARGET_KILLS || !aiDeck.length || !hand.length) return endGame();

    target = aiDeck.shift();
    targetBox.innerHTML = ""; targetBox.appendChild(HC.card.node(target, { cardNumber: "AI" }));
    playBox.innerHTML = "";
    var killers = HC.rel.killersOf(target.id);
    var canKill = hand.some(function (h) { return killers.indexOf(h.id) !== -1; });
    prompt.innerHTML = "Target: <b>" + esc(target.name) + "</b> (influence " + target.stats.influence + "). " +
      (canKill ? "<span style='color:var(--good)'>You hold a direct counter.</span>" : "No direct counter, win on influence.");
    renderHand();
  }

  function renderHand() {
    handBox.innerHTML = "";
    var killers = target ? HC.rel.killersOf(target.id) : [];
    hand.forEach(function (h) {
      var node = HC.card.node(h, { cardNumber: "", onClick: resolving ? null : function () { playCard(h); } });
      node.style.maxWidth = "140px";
      if (killers.indexOf(h.id) !== -1) {
        node.style.boxShadow = "0 0 0 2px var(--good), 0 0 18px -4px var(--good)";
        node.appendChild(el("div", { class: "hc-owned-badge", style: "background:var(--good)", text: "COUNTER" }));
      }
      handBox.appendChild(node);
    });
  }

  function playCard(h) {
    if (resolving || !target) return;
    resolving = true;
    playBox.innerHTML = ""; playBox.appendChild(HC.card.node(h, { cardNumber: "YOU" }));

    var direct = HC.rel.beats(h.id, target.id);
    var reverse = HC.rel.beats(target.id, h.id);
    var outcome;

    if (direct) {
      youKills++; outcome = "kill";
      log("☠ <b>" + esc(h.name) + "</b> ends <b>" + esc(target.name) + "</b>. " + esc(direct), "win");
      prompt.innerHTML = "<span style='color:var(--good)'>Direct kill. " + esc(direct) + "</span>";
    } else if (reverse) {
      aiKills++; outcome = "death";
      hand = hand.filter(function (x) { return x !== h; });
      log("✖ <b>" + esc(target.name) + "</b> turns the tables on <b>" + esc(h.name) + "</b>. " + esc(reverse), "lose");
      prompt.innerHTML = "<span style='color:var(--bad)'>Your agent fell. " + esc(reverse) + "</span>";
    } else {
      var yv = h.stats.influence, av = target.stats.influence;
      if (yv > av) {
        youKills++; outcome = "kill";
        log("⚔ <b>" + esc(h.name) + "</b> (" + yv + ") overpowers <b>" + esc(target.name) + "</b> (" + av + ")", "hit");
        prompt.innerHTML = "<span style='color:var(--good)'>Won the clash on influence.</span>";
      } else if (yv < av) {
        aiKills++; outcome = "death";
        hand = hand.filter(function (x) { return x !== h; });
        log("⚔ <b>" + esc(target.name) + "</b> (" + av + ") outguns <b>" + esc(h.name) + "</b> (" + yv + ")", "lose");
        prompt.innerHTML = "<span style='color:var(--bad)'>Outmatched on influence. Agent lost.</span>";
      } else {
        outcome = "stale";
        log("Stalemate between <b>" + esc(h.name) + "</b> and <b>" + esc(target.name) + "</b>.", "");
        prompt.innerHTML = "Stalemate. Both walk away.";
      }
    }

    document.getElementById("sb-you").textContent = youKills;
    document.getElementById("sb-ai").textContent = aiKills;
    renderHand();
    if (youKills >= TARGET_KILLS || aiKills >= TARGET_KILLS || !hand.length || !aiDeck.length) {
      setTimeout(endGame, 800);
    } else {
      document.getElementById("next-btn").style.display = "inline-flex";
    }
  }

  function endGame() {
    var won = youKills >= TARGET_KILLS || (aiKills < TARGET_KILLS && youKills > aiKills);
    var draw = youKills === aiKills && youKills < TARGET_KILLS;
    prompt.innerHTML = draw ? "<span style='color:var(--warn)'>Out of agents. It's a draw.</span>"
      : won ? "<span style='color:var(--good)'>You reached " + youKills + " kills. Victory.</span>"
            : "<span style='color:var(--bad)'>The AI got there first.</span>";
    log(draw ? "Draw." : won ? "🏆 You win." : "💀 You lose.", won ? "win" : draw ? "" : "lose");
    document.getElementById("next-btn").style.display = "none";
    document.getElementById("new-btn").style.display = "inline-flex";
    handBox.innerHTML = "";
  }

  document.getElementById("next-btn").addEventListener("click", nextTarget);
  document.getElementById("new-btn").addEventListener("click", newGame);
  newGame();
})();
