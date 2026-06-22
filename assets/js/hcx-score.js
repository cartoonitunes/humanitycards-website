/* hcx-score.js — the Historian Score engine (pure, client-side).
 *
 *   Historian Score = Collection Score
 *                   + round(Lifetime Game Points × Collection Multiplier)
 *                   + Achievement Points
 *
 * Everything here is a pure function of (owned cards, game stats). It reads the
 * static metadata from window.HCX_SETS and never touches the network — except
 * gamePointsFor(), a small helper that pulls a player's lifetime game points
 * from /api/scores. The leaderboard and the collection page both feed their
 * computed breakdown to /api/leaderboard-hc so it can be ranked. */
(function () {
  "use strict";
  var HCX = window.HCX, SETS = window.HCX_SETS;
  if (!HCX || !SETS) return;

  // ---- rarity base points (duplicate decay: 1st 100%, 2nd 25%, 3rd+ 10%) ---
  var DUP = [1, 0.25, 0.10];
  function dupFactor(copyIndex) { return copyIndex < DUP.length ? DUP[copyIndex] : DUP[DUP.length - 1]; }

  // ---- completion bonuses by unique figures owned -------------------------
  var COMPLETION = [
    { n: 5,   bonus: 100,   name: "First Steps" },
    { n: 25,  bonus: 500,   name: "History Buff" },
    { n: 50,  bonus: 1500,  name: "Serious Collector" },
    { n: 100, bonus: 4000,  name: "Walking Encyclopedia" },
    { n: 150, bonus: 8000,  name: "Living Museum" },
    { n: SETS.TOTAL, bonus: 25000, name: "The Completionist" }
  ];

  // ---- collection multiplier on game points -------------------------------
  function collectionMultiplier(uniques) {
    if (uniques <= 5) return 1.0;
    if (uniques <= 15) return 1.1;
    if (uniques <= 30) return 1.2;
    if (uniques <= 50) return 1.3;
    if (uniques <= 80) return 1.5;
    if (uniques <= 120) return 1.75;
    if (uniques <= 160) return 2.0;
    if (uniques <= 200) return 2.25;
    return 2.5;
  }

  // ---- collector ranks (by Historian Score) -------------------------------
  var RANKS = [
    { min: 0,      title: "Student",         color: "#8A8475", key: "student" },
    { min: 501,    title: "Scholar",         color: "#63A92C", key: "scholar" },
    { min: 2001,   title: "Historian",       color: "#3B82F6", key: "historian" },
    { min: 5001,   title: "Professor",       color: "#A855F7", key: "professor" },
    { min: 15001,  title: "Curator",         color: "#FFD700", key: "curator" },
    { min: 40001,  title: "Archivist",       color: "#F4B860", key: "archivist" },
    { min: 80001,  title: "Grand Historian", color: "#E9C46A", key: "grand", prismatic: true },
    { min: 150001, title: "Immortal",        color: "#FF7A45", key: "immortal", prismatic: true }
  ];
  function rankFor(score) {
    var r = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (score >= RANKS[i].min) { r = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    var pct = next ? Math.max(0, Math.min(1, (score - r.min) / (next.min - r.min))) : 1;
    return { rank: r, next: next, progress: pct, index: RANKS.indexOf(r) + 1 };
  }

  // =========================================================== CORE COMPUTE
  // owned: array of figure objects (one entry per card; duplicates repeat).
  // opts: { gamePoints, gameStats, now }
  function compute(owned, opts) {
    owned = owned || [];
    opts = opts || {};
    var tierKey = SETS.tierKey, TIERS = SETS.TIERS;

    // group by figure
    var byFig = {};      // humanId -> { figure, count }
    var tiers = { mythic: 0, legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 };
    owned.forEach(function (f) {
      var g = byFig[f.humanId] || (byFig[f.humanId] = { figure: f, count: 0 });
      g.count++;
    });
    var ownedIds = Object.keys(byFig).map(Number);
    var uniques = ownedIds.length;
    ownedIds.forEach(function (id) { tiers[tierKey(byFig[id].figure.maxSupply)]++; });

    // which sets are complete (own ≥1 of every figureId)?
    var ownedSet = {}; ownedIds.forEach(function (id) { ownedSet[id] = true; });
    var completedSetIds = {}, setProgress = [];
    SETS.SETS.forEach(function (set) {
      var have = 0;
      for (var i = 0; i < set.figureIds.length; i++) if (ownedSet[set.figureIds[i]]) have++;
      var complete = have === set.figureIds.length && set.figureIds.length > 0;
      if (complete) completedSetIds[set.id] = true;
      setProgress.push({ set: set, have: have, total: set.figureIds.length, complete: complete });
    });

    // per-card points: base × dup-decay × set multiplier (1 + 0.5×completedMultiplierSets)
    var cardPoints = 0;
    ownedIds.forEach(function (id) {
      var g = byFig[id];
      var base = TIERS[tierKey(g.figure.maxSupply)].base;
      // set multiplier: count completed MULTIPLIER sets this figure belongs to
      var memberSets = SETS.setsByFigure[id] || [];
      var completedMult = 0;
      memberSets.forEach(function (sid) {
        var s = SETS.setById[sid];
        if (s && s.bonusType === "multiplier" && completedSetIds[sid]) completedMult++;
      });
      var mult = 1 + 0.5 * completedMult;
      for (var c = 0; c < g.count; c++) cardPoints += base * dupFactor(c) * mult;
    });
    cardPoints = Math.round(cardPoints);

    // mini-set flat bonuses
    var miniBonus = 0, miniComplete = [];
    SETS.SETS.forEach(function (set) {
      if (set.bonusType === "flat" && completedSetIds[set.id]) { miniBonus += set.bonusValue; miniComplete.push(set); }
    });

    // completion (breadth) bonuses
    var completionBonus = 0, completionHit = [];
    COMPLETION.forEach(function (m) { if (uniques >= m.n) { completionBonus += m.bonus; completionHit.push(m); } });

    var collectionScore = cardPoints + miniBonus + completionBonus;

    // game contribution
    var gamePoints = Math.max(0, Math.round(Number(opts.gamePoints) || 0));
    var mult = collectionMultiplier(uniques);
    var gameContribution = Math.round(gamePoints * mult);

    // achievements
    var ctx = buildCtx({
      owned: owned, byFig: byFig, ownedIds: ownedIds, ownedSet: ownedSet, uniques: uniques,
      tiers: tiers, completedSetIds: completedSetIds, setProgress: setProgress,
      gameStats: opts.gameStats || {}, gamePoints: gamePoints, now: opts.now
    });
    var ach = evaluateAchievements(ctx);

    var total = collectionScore + gameContribution + ach.points;
    var rk = rankFor(total);

    return {
      total: total,
      collectionScore: collectionScore,
      cardPoints: cardPoints,
      miniBonus: miniBonus,
      completionBonus: completionBonus,
      gamePoints: gamePoints,
      gameMultiplier: mult,
      gameContribution: gameContribution,
      achievementPoints: ach.points,
      achievements: ach.list,
      unlockedCount: ach.unlocked,
      uniques: uniques,
      totalCards: owned.length,
      totalFigures: SETS.TOTAL,
      tiers: tiers,
      byFig: byFig,
      ownedIds: ownedIds,
      setProgress: setProgress,
      miniComplete: miniComplete,
      completedSetIds: completedSetIds,
      completionHit: completionHit,
      completionTable: COMPLETION,
      rank: rk.rank,
      nextRank: rk.next,
      rankProgress: rk.progress,
      rankIndex: rk.index
    };
  }

  // ---- achievement evaluation context -------------------------------------
  function buildCtx(p) {
    var FIGS = HCX.FIGURES;
    // categories / continents / eras owned
    var cats = {}, conts = {}, eraSets = {}, womenOwned = 0, renaissanceOwned = 0, conquerorsOwned = 0;
    var minYear = null, maxYear = null;
    p.ownedIds.forEach(function (id) {
      var f = HCX.byId(id); if (!f) return;
      var m = f.meta;
      cats[m.category] = (cats[m.category] || 0) + 1;
      conts[m.continent] = (conts[m.continent] || 0) + 1;
      if (m.gender === "F") womenOwned++;
      if (m.era === "Renaissance") renaissanceOwned++;
      if (m.category === "Conqueror") conquerorsOwned++;
      if (f.born != null) { if (minYear == null || f.born < minYear) minYear = f.born; if (maxYear == null || f.born > maxYear) maxYear = f.born; }
    });
    // completed sets by kind
    var compByKind = { era: 0, category: 0, women: 0, mini: 0 };
    var distinctCompletedCategories = {};
    var eraSetIds = {}; SETS.ERA_SETS.forEach(function (e) { eraSetIds[e.id] = true; });
    var eraSetsComplete = 0, totalCompleted = 0;
    Object.keys(p.completedSetIds).forEach(function (sid) {
      var s = SETS.setById[sid]; if (!s) return;
      compByKind[s.kind] = (compByKind[s.kind] || 0) + 1;
      totalCompleted++;
      if (s.kind === "category") distinctCompletedCategories[s.category] = true;
      if (eraSetIds[sid]) eraSetsComplete++;
    });
    // full houses (own every minted copy of a figure)
    var fullHouses = 0;
    p.ownedIds.forEach(function (id) {
      var g = p.byFig[id];
      if (g.count >= g.figure.maxSupply && g.figure.maxSupply > 0) fullHouses++;
    });
    // ancient-world fully owned?
    var ancient = SETS.setById["ancient-world"];
    var ancientComplete = ancient && p.completedSetIds["ancient-world"];

    // game stats roll-up
    var gs = p.gameStats || {};
    var totalPlayed = 0, totalWins = 0, modesWon = 0, bestStreak = 0;
    ["timeline", "battle", "draft", "assassination"].forEach(function (gm) {
      var s = gs[gm] || {};
      totalPlayed += s.games_played || 0;
      totalWins += s.wins || 0;
      if ((s.wins || 0) > 0) modesWon++;
      if ((s.best_streak || 0) > bestStreak) bestStreak = s.best_streak || 0;
    });

    var allTiers = SETS.TIER_ORDER.every(function (k) { return p.tiers[k] > 0; });

    return {
      uniques: p.uniques, totalCards: p.owned.length, tiers: p.tiers, allTiers: allTiers,
      ownedSet: p.ownedSet, cats: cats, conts: conts, womenOwned: womenOwned,
      renaissanceOwned: renaissanceOwned, conquerorsOwned: conquerorsOwned,
      continentsCount: Object.keys(conts).length,
      yearSpan: (minYear != null && maxYear != null) ? (maxYear - minYear) : 0,
      totalCompleted: totalCompleted, compByKind: compByKind,
      distinctCompletedCategories: Object.keys(distinctCompletedCategories).length,
      eraSetsComplete: eraSetsComplete, eraSetCount: SETS.ERA_SETS.length,
      ancientComplete: ancientComplete,
      fullHouses: fullHouses, rarestId: SETS.rarestFigureId(),
      hasRarest: p.ownedSet[SETS.rarestFigureId()],
      gameStats: gs, totalPlayed: totalPlayed, totalWins: totalWins, modesWon: modesWon,
      bestStreak: bestStreak, gamePoints: p.gamePoints, now: p.now
    };
  }

  // ---- the achievement catalogue ------------------------------------------
  // Each: id, name, desc, points, group, secret?, check(ctx), progress(ctx)->[have,need]
  function ach(id, name, desc, points, group, check, progress, secret) {
    return { id: id, name: name, desc: desc, points: points, group: group, check: check, progress: progress, secret: !!secret };
  }
  var ownEvery = function (ctx, ids) { return ids.every(function (i) { return ctx.ownedSet[i]; }); };
  var countEvery = function (ctx, ids) { var n = 0; ids.forEach(function (i) { if (ctx.ownedSet[i]) n++; }); return n; };

  var ACHIEVEMENTS = [
    // Collection milestones
    ach("first-discovery", "First Discovery", "Own 1 unique figure", 50, "Collection",
      function (c) { return c.uniques >= 1; }, function (c) { return [c.uniques, 1]; }),
    ach("handful", "Handful of History", "Own 5 unique figures", 100, "Collection",
      function (c) { return c.uniques >= 5; }, function (c) { return [c.uniques, 5]; }),
    ach("quarter", "Quarter Century", "Own 25 unique figures", 250, "Collection",
      function (c) { return c.uniques >= 25; }, function (c) { return [c.uniques, 25]; }),
    ach("half-hundred", "Half a Hundred", "Own 50 unique figures", 500, "Collection",
      function (c) { return c.uniques >= 50; }, function (c) { return [c.uniques, 50]; }),
    ach("centurion", "Centurion", "Own 100 unique figures", 1000, "Collection",
      function (c) { return c.uniques >= 100; }, function (c) { return [c.uniques, 100]; }),
    ach("living-museum", "Living Museum", "Own 150 unique figures", 2000, "Collection",
      function (c) { return c.uniques >= 150; }, function (c) { return [c.uniques, 150]; }),
    ach("completionist", "The Completionist", "Own every figure", 5000, "Collection",
      function (c) { return c.uniques >= SETS.TOTAL; }, function (c) { return [c.uniques, SETS.TOTAL]; }),

    // Rarity
    ach("lucky-find", "Lucky Find", "Own 1 Mythic card", 300, "Rarity",
      function (c) { return c.tiers.mythic >= 1; }, function (c) { return [c.tiers.mythic, 1]; }),
    ach("myth-collector", "Myth Collector", "Own 3 Mythic cards", 750, "Rarity",
      function (c) { return c.tiers.mythic >= 3; }, function (c) { return [c.tiers.mythic, 3]; }),
    ach("legendary-status", "Legendary Status", "Own 5 Legendary cards", 500, "Rarity",
      function (c) { return c.tiers.legendary >= 5; }, function (c) { return [c.tiers.legendary, 5]; }),
    ach("full-spectrum", "Full Spectrum", "Own 1+ card of every rarity tier", 200, "Rarity",
      function (c) { return c.allTiers; }, function (c) { var n = 0; SETS.TIER_ORDER.forEach(function (k) { if (c.tiers[k] > 0) n++; }); return [n, 6]; }),
    ach("rarest-of-rare", "Rarest of Rare", "Own the single lowest-supply figure", 1000, "Rarity",
      function (c) { return !!c.hasRarest; }, function (c) { return [c.hasRarest ? 1 : 0, 1]; }),

    // Sets
    ach("set-starter", "Set Starter", "Complete 1 set", 200, "Sets",
      function (c) { return c.totalCompleted >= 1; }, function (c) { return [c.totalCompleted, 1]; }),
    ach("set-collector", "Set Collector", "Complete 5 sets", 500, "Sets",
      function (c) { return c.totalCompleted >= 5; }, function (c) { return [c.totalCompleted, 5]; }),
    ach("set-master", "Set Master", "Complete 10 sets", 1000, "Sets",
      function (c) { return c.totalCompleted >= 10; }, function (c) { return [c.totalCompleted, 10]; }),
    ach("polymath", "Polymath", "Complete sets in 3+ categories", 750, "Sets",
      function (c) { return c.distinctCompletedCategories >= 3; }, function (c) { return [c.distinctCompletedCategories, 3]; }),
    ach("grand-collection", "The Grand Collection", "Complete all era sets", 2000, "Sets",
      function (c) { return c.eraSetsComplete >= c.eraSetCount; }, function (c) { return [c.eraSetsComplete, c.eraSetCount]; }),

    // Thematic
    ach("renaissance-person", "Renaissance Person", "Own 5 Renaissance figures", 200, "Thematic",
      function (c) { return c.renaissanceOwned >= 5; }, function (c) { return [c.renaissanceOwned, 5]; }),
    ach("ancient-wisdom", "Ancient Wisdom", "Own every Ancient World figure", 750, "Thematic",
      function (c) { return !!c.ancientComplete; }, function (c) { var s = SETS.setById["ancient-world"]; return [countEvery(c, s.figureIds), s.figureIds.length]; }),
    ach("power-conquest", "Power & Conquest", "Own 5 Conquerors", 200, "Thematic",
      function (c) { return c.conquerorsOwned >= 5; }, function (c) { return [c.conquerorsOwned, 5]; }),
    ach("ahead-of-time", "Ahead of Their Time", "Own 5 Women of History", 200, "Thematic",
      function (c) { return c.womenOwned >= 5; }, function (c) { return [c.womenOwned, 5]; }),
    ach("philosophy-club", "Philosophy Club", "Own Socrates, Plato AND Aristotle", 300, "Thematic",
      function (c) { return ownEvery(c, [42, 38, 16]); }, function (c) { return [countEvery(c, [42, 38, 16]), 3]; }),
    ach("continental", "Continental Collector", "Own figures from 4+ continents", 250, "Thematic",
      function (c) { return c.continentsCount >= 4; }, function (c) { return [c.continentsCount, 4]; }),
    ach("millennium", "Millennium Span", "Own figures born 1000+ years apart", 150, "Thematic",
      function (c) { return c.yearSpan >= 1000; }, function (c) { return [Math.min(c.yearSpan, 1000), 1000]; }),

    // Game
    ach("first-victory", "First Victory", "Win 1 game (any mode)", 50, "Games",
      function (c) { return c.totalWins >= 1; }, function (c) { return [c.totalWins, 1]; }),
    ach("battle-hardened", "Battle Hardened", "Win 25 Battles", 300, "Games",
      function (c) { return (c.gameStats.battle && c.gameStats.battle.wins || 0) >= 25; },
      function (c) { return [(c.gameStats.battle && c.gameStats.battle.wins) || 0, 25]; }),
    ach("untouchable", "Untouchable", "Hit a 10-game win streak", 750, "Games",
      function (c) { return c.bestStreak >= 10; }, function (c) { return [c.bestStreak, 10]; }),
    ach("jack-of-trades", "Jack of All Trades", "Win in every game mode", 400, "Games",
      function (c) { return c.modesWon >= 4; }, function (c) { return [c.modesWon, 4]; }),
    ach("grinder", "Grinder", "Play 100 total games", 200, "Games",
      function (c) { return c.totalPlayed >= 100; }, function (c) { return [c.totalPlayed, 100]; }),
    ach("dedication", "Dedication", "Play 500 total games", 500, "Games",
      function (c) { return c.totalPlayed >= 500; }, function (c) { return [c.totalPlayed, 500]; }),

    // Secret
    ach("full-house", "Full House", "Own every minted copy of a figure", 500, "Secret",
      function (c) { return c.fullHouses >= 1; }, function (c) { return [c.fullHouses, 1]; }, true),
    ach("night-owl", "Night Owl", "Visit between 2–4 AM local time", 100, "Secret",
      function (c) { var hr = (c.now != null ? new Date(c.now) : new Date()).getHours(); return hr >= 2 && hr < 4; },
      function () { return [0, 1]; }, true)
  ];

  function evaluateAchievements(ctx) {
    var list = [], points = 0, unlocked = 0;
    ACHIEVEMENTS.forEach(function (a) {
      var got = false;
      try { got = !!a.check(ctx); } catch (e) { got = false; }
      var pr = [0, 1];
      try { pr = a.progress(ctx) || [0, 1]; } catch (e) {}
      if (got) { points += a.points; unlocked++; }
      list.push({ id: a.id, name: a.name, desc: a.desc, points: a.points, group: a.group,
        secret: a.secret, unlocked: got, have: pr[0], need: pr[1] });
    });
    return { list: list, points: points, unlocked: unlocked };
  }

  // ---- lifetime game points for a player (from /api/scores) ---------------
  // Returns { points, stats } where stats is keyed by game mode. Best-effort:
  // resolves with zeros if the API is unreachable or the player has no games.
  var GAMES = ["timeline", "battle", "draft", "assassination"];
  function scoresApiBase() {
    var onIpfs = location.protocol === "ipns:" || location.protocol === "ipfs:" ||
      /\.eth(\.limo)?$/.test(location.hostname) || location.hostname.indexOf(".ipfs.") >= 0;
    return onIpfs ? "https://humanitycards.vercel.app/api/scores" : "/api/scores";
  }
  function gamePointsFor(opts) {
    opts = opts || {};
    var base = scoresApiBase();
    var headers = {};
    if (opts.token) headers["Authorization"] = "Bearer " + opts.token;
    var qWallet = (!opts.token && opts.wallet) ? "&wallet=" + encodeURIComponent(opts.wallet) : "";
    return Promise.all(GAMES.map(function (g) {
      return fetch(base + "?game=" + g + qWallet, { headers: headers })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return { game: g, you: (j && j.you) || null, top: (j && j.top) || [] }; })
        .catch(function () { return { game: g, you: null, top: [] }; });
    })).then(function (results) {
      var points = 0, stats = {};
      results.forEach(function (res) {
        var you = res.you;
        // best_streak isn't on the "you" row; recover it from the top list if
        // the player happens to be there (best-effort for streak achievements).
        var bs = 0;
        if (you && res.top) {
          res.top.forEach(function (row) {
            if (row.wallet && you.wallet && row.wallet === you.wallet && row.best_streak) bs = row.best_streak;
          });
        }
        if (you) {
          points += you.total_score || 0;
          stats[res.game] = { total_score: you.total_score || 0, best_score: you.best_score || 0,
            games_played: you.games_played || 0, wins: you.wins || 0, best_streak: bs, rank: you.rank || null };
        } else {
          stats[res.game] = { total_score: 0, best_score: 0, games_played: 0, wins: 0, best_streak: 0, rank: null };
        }
      });
      return { points: points, stats: stats };
    });
  }

  window.HCX_SCORE = {
    compute: compute,
    collectionMultiplier: collectionMultiplier,
    rankFor: rankFor,
    RANKS: RANKS,
    COMPLETION: COMPLETION,
    ACHIEVEMENTS: ACHIEVEMENTS,
    gamePointsFor: gamePointsFor,
    scoresApiBase: scoresApiBase
  };
})();
