/* Battle. You see your card, pick a stat, then the AI card is revealed and
 * compared. Winner takes both cards. Empty the AI deck to win. When a wallet
 * holds cards, your deck is drawn from your collection. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("battle.html");

  var STATS = [
    ["influence", "Influence"],
    ["era", "Era score"],
    ["rarity", "Rarity"],
    ["controversy", "Controversy"],
    ["legacy", "Legacy"]
  ];
  var DECK_EACH = 6;

  var youDeck = [], aiDeck = [], round = 1, revealed = false, wins = HC.load("bt:wins", 0);
  var youCardBox = document.getElementById("you-card");
  var aiCardBox = document.getElementById("ai-card");
  var statList = document.getElementById("stat-list");
  var prompt = document.getElementById("battle-prompt");
  var logBox = document.getElementById("battle-log");

  function log(msg, cls) {
    var p = el("p", cls ? { class: cls, html: msg } : { html: msg });
    logBox.insertBefore(p, logBox.firstChild);
  }

  var dealInfo = null;

  function newMatch() {
    var battlePool = HC.ROSTER.filter(function (h) { return h.inf >= 45; });
    // Your deck: drawn from your collection first, padded with random loaners.
    var deal = HC.dealHand(DECK_EACH, { pool: battlePool });
    dealInfo = deal;
    var yours = deal.hand.slice();
    // AI deck: random, never overlapping yours.
    var pool = HC.shuffle(battlePool.filter(function (h) { return yours.indexOf(h) === -1; }));
    var ai = pool.slice(0, DECK_EACH);
    youDeck = yours; aiDeck = ai; round = 1; revealed = false;
    logBox.innerHTML = "";
    HC.modeBadge(document.getElementById("mode-badge"), deal);
    log(deal.isCollection
      ? "Match start. " + deal.ownedCount + " of your owned card" + (deal.ownedCount > 1 ? "s are" : " is") + " in play."
      : "Match start. Random loaner deck. Connect a wallet with cards to play your own.");
    document.getElementById("new-match-btn").style.display = "none";
    renderRound();
  }

  function renderRound() {
    revealed = false;
    document.getElementById("next-btn").style.display = "none";
    document.getElementById("new-match-btn").style.display = "none";
    document.getElementById("sb-you").textContent = youDeck.length;
    document.getElementById("sb-ai").textContent = aiDeck.length;
    document.getElementById("sb-round").textContent = round;
    document.getElementById("sb-wins").textContent = wins;

    if (!youDeck.length || !aiDeck.length) return endMatch();

    var you = youDeck[0];
    youCardBox.innerHTML = ""; youCardBox.appendChild(HC.card.node(you, { cardNumber: round, owned: HC.wallet.ownsHuman(you.id) }));
    // AI card face-down
    aiCardBox.innerHTML = "";
    var back = el("div", { class: "hc-card" }); back.innerHTML = HC.card.backSvg();
    aiCardBox.appendChild(back);

    prompt.textContent = "Your move. Pick the category you think wins.";
    statList.innerHTML = "";
    STATS.forEach(function (s) {
      var v = you.stats[s[0]];
      var row = el("div", { class: "stat-row pickable", "data-k": s[0] }, [
        el("div", { class: "label", text: s[1] }),
        el("div", { class: "bar" }, [el("i", { style: "width:" + v + "%" })]),
        el("div", { class: "val", text: v })
      ]);
      row.addEventListener("click", function () { play(s[0]); });
      statList.appendChild(row);
    });
  }

  function play(stat) {
    if (revealed) return;
    revealed = true;
    var you = youDeck[0], ai = aiDeck[0];
    aiCardBox.innerHTML = ""; aiCardBox.appendChild(HC.card.node(ai, { cardNumber: round }));

    var yv = you.stats[stat], av = ai.stats[stat];
    // annotate stat rows
    Array.prototype.forEach.call(statList.children, function (row) {
      var k = row.getAttribute("data-k");
      row.classList.remove("pickable");
      var av2 = ai.stats[k];
      // append AI value
      row.appendChild(el("div", { class: "val mute", style: "grid-column:3;font-size:11px", text: "AI " + av2 }));
      if (k === stat) row.classList.add(yv >= av ? "win" : "lose");
    });

    var statName = STATS.filter(function (s) { return s[0] === stat; })[0][1];
    if (yv > av) {
      log("<b>" + esc(you.name) + "</b> " + statName + " " + yv + " beats <b>" + esc(ai.name) + "</b> " + av, "win");
      youDeck.push(youDeck.shift()); youDeck.push(aiDeck.shift());
      prompt.textContent = "You win the round and take both cards.";
    } else if (yv < av) {
      log("<b>" + esc(ai.name) + "</b> " + statName + " " + av + " beats your <b>" + esc(you.name) + "</b> " + yv, "lose");
      aiDeck.push(aiDeck.shift()); aiDeck.push(youDeck.shift());
      prompt.textContent = "The AI takes the round.";
    } else {
      log(statName + " tied at " + yv + ". Cards reshuffle.", "hit");
      youDeck.push(youDeck.shift()); aiDeck.push(aiDeck.shift());
      prompt.textContent = "Tie. Both keep their cards.";
    }
    round++;
    document.getElementById("sb-you").textContent = youDeck.length;
    document.getElementById("sb-ai").textContent = aiDeck.length;

    if (!youDeck.length || !aiDeck.length) {
      document.getElementById("next-btn").style.display = "none";
      setTimeout(endMatch, 700);
    } else {
      document.getElementById("next-btn").style.display = "inline-flex";
    }
  }

  function endMatch() {
    var won = youDeck.length > 0;
    if (won) { wins++; HC.save("bt:wins", wins); }
    prompt.innerHTML = won ? "<span style='color:var(--good)'>You cleared the AI deck. Match won.</span>"
                           : "<span style='color:var(--bad)'>The AI took all your cards.</span>";
    log(won ? "🏆 Match won." : "💀 Match lost.", won ? "win" : "lose");
    document.getElementById("sb-wins").textContent = wins;
    document.getElementById("new-match-btn").style.display = "inline-flex";
    statList.innerHTML = "";
  }

  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  document.getElementById("next-btn").addEventListener("click", renderRound);
  document.getElementById("new-match-btn").addEventListener("click", newMatch);
  // When ownership changes, start a fresh match so the new collection is dealt.
  var inited = false;
  HC.wallet.onChange(function () {
    if (!inited) { inited = true; return; }
    HC.toast("Collection updated. Dealing a new match.");
    newMatch();
  });
  newMatch();
})();
