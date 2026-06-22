/* hcx-gamify.js — the gamification UI for the Collection Showcase page.
 *
 * Builds the panels that turn a wallet's holdings into a scored, ranked,
 * badge-earning trophy case: Historian Score header + rank crest, "catch 'em
 * all" progress, rarity breakdown, set progress (with loss-aversion "1 away!"
 * nudges), and the achievements grid. hcx-showcase.js calls
 * HCX_GAMIFY.mount(host, owned, S) once the collection is loaded.
 *
 * Scoring lives in hcx-score.js; static metadata in hcx-sets.js. This file is
 * presentation + the share-score flow. */
(function () {
  "use strict";
  var h = window.h, HCX = window.HCX, SETS = window.HCX_SETS, SCORE = window.HCX_SCORE;
  if (!h || !HCX || !SETS || !SCORE) return;
  var SITE = "https://humanitycards.vercel.app";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
  function pct(have, need) { return Math.max(0, Math.min(100, need ? (have / need) * 100 : 0)); }

  // a rank crest (shield) — uses the rank colour; prismatic ranks get an animated class
  function crest(rank, big) {
    var cls = "gx-crest" + (big ? " big" : "") + (rank.prismatic ? " prismatic" : "");
    return h("span", { className: cls, style: { "--crest": rank.color } },
      h("span", { className: "gx-crest-ico" }, "★"));
  }

  // ============================================================ SCORE HERO
  function ScoreHero(sc, S, ctx) {
    var rank = sc.rank, next = sc.nextRank;
    var toNext = next ? (next.min - sc.total) : 0;

    var breakdown = h("div", { className: "gx-bd" },
      bdItem("Collection", sc.collectionScore, "#C98A4B"),
      bdSep(),
      bdItem("Games", sc.gameContribution, "#3B82F6", sc.gameMultiplier > 1 ? ("×" + sc.gameMultiplier) : null, "gx-bd-games"),
      bdSep(),
      bdItem("Achievements", sc.achievementPoints, "#A855F7"));

    var rankRow = h("div", { className: "gx-rankrow" },
      crest(rank, true),
      h("div", { className: "gx-rankmeta" },
        h("div", { className: "gx-ranktitle", style: { color: rank.color } }, rank.title),
        h("div", { className: "gx-ranksub" }, "Rank " + sc.rankIndex + " of " + SCORE.RANKS.length +
          (next ? " · " + fmt(toNext) + " to " + next.title : " · max rank"))));

    var bar = h("div", { className: "gx-rankbar" },
      h("div", { className: "gx-rankbar-fill", style: { width: (next ? (sc.rankProgress * 100) : 100) + "%", background: (next ? next.color : rank.color) } }));

    var actions = h("div", { className: "gx-actions" },
      h("button", { className: "gx-btn primary", onClick: function () { shareScore(sc, S); } }, "Share Score"),
      h("a", { className: "gx-btn", href: "/leaderboard" + (S.address ? "?wallet=" + encodeURIComponent(S.address) : "") }, "Leaderboard ↗"));

    return h("div", { className: "gx-hero reveal" },
      h("div", { className: "gx-hero-top" },
        h("div", { className: "gx-hero-l" },
          h("div", { className: "gx-kicker" }, "Historian Score"),
          h("div", { className: "gx-score", "data-count": String(sc.total) }, reduceMotion ? fmt(sc.total) : "0"),
          rankRow),
        h("div", { className: "gx-hero-r" }, breakdown)),
      bar,
      actions);
  }
  function bdItem(label, val, color, tag, extraCls) {
    return h("div", { className: "gx-bd-item" + (extraCls ? " " + extraCls : "") },
      h("div", { className: "gx-bd-val", style: { color: color } }, fmt(val), tag ? h("span", { className: "gx-bd-tag" }, tag) : null),
      h("div", { className: "gx-bd-label" }, label));
  }
  function bdSep() { return h("div", { className: "gx-bd-sep" }); }

  // ============================================================ CATCH 'EM ALL
  function CatchEmAll(sc) {
    var milestones = sc.completionTable.map(function (m) {
      var hit = sc.uniques >= m.n;
      return h("div", { className: "gx-ms" + (hit ? " hit" : ""), title: m.name + " · +" + fmt(m.bonus) },
        h("span", { className: "gx-ms-dot" }), h("span", { className: "gx-ms-n" }, m.n));
    });
    return h("div", { className: "gx-panel reveal" },
      h("div", { className: "gx-panel-head" },
        h("h3", null, "Catch ’em all"),
        h("span", { className: "gx-panel-sub" }, sc.uniques + " of " + sc.totalFigures + " figures")),
      h("div", { className: "gx-bigbar" },
        h("div", { className: "gx-bigbar-fill", style: { width: pct(sc.uniques, sc.totalFigures) + "%" } })),
      h("div", { className: "gx-ms-row" }, milestones));
  }

  // ============================================================ RARITY BREAKDOWN
  function RarityBreakdown(sc) {
    var chips = SETS.TIER_ORDER.map(function (k) {
      var t = SETS.TIERS[k], n = sc.tiers[k] || 0;
      return h("div", { className: "gx-rchip" + (n ? "" : " empty") + (t.prismatic ? " prismatic" : ""), style: { "--rc": t.color } },
        h("div", { className: "gx-rchip-n" }, n),
        h("div", { className: "gx-rchip-name" }, t.name),
        h("div", { className: "gx-rchip-base" }, t.base + " pts"));
    });
    return h("div", { className: "gx-panel reveal" },
      h("div", { className: "gx-panel-head" }, h("h3", null, "Rarity breakdown")),
      h("div", { className: "gx-rgrid" }, chips));
  }

  // ============================================================ SET PROGRESS
  function SetProgress(sc) {
    // sort: nearly-complete (loss aversion) first, then complete, then the rest
    var rows = sc.setProgress.slice().filter(function (p) { return p.total > 0; });
    rows.sort(function (a, b) {
      var ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (b.have / b.total) - (a.have / a.total);
    });
    function rank(p) {
      if (p.complete) return 2;
      var missing = p.total - p.have;
      if (p.have > 0 && missing <= 2) return 0;   // so close!
      if (p.have > 0) return 1;
      return 3;                                    // not started
    }
    var completeCount = rows.filter(function (p) { return p.complete; }).length;

    var cards = rows.map(function (p) {
      var missing = p.total - p.have;
      var nearly = !p.complete && p.have > 0 && missing <= 2;
      var kindCls = "gx-set " + p.set.kind + (p.complete ? " complete" : "") + (nearly ? " nearly" : "");
      var note = p.complete ? (p.set.bonusType === "flat" ? "+" + p.set.bonusValue + " pts" : "1.5× bonus active")
        : nearly ? (missing === 1 ? "1 card away!" : missing + " cards away") : null;
      return h("div", { className: kindCls },
        h("div", { className: "gx-set-top" },
          h("span", { className: "gx-set-name" }, p.set.name),
          p.complete ? h("span", { className: "gx-set-check" }, "✓") : null),
        h("div", { className: "gx-set-bar" }, h("div", { className: "gx-set-fill", style: { width: pct(p.have, p.total) + "%" } })),
        h("div", { className: "gx-set-foot" },
          h("span", { className: "gx-set-frac" }, p.have + "/" + p.total),
          note ? h("span", { className: "gx-set-note" + (nearly ? " warn" : "") }, note) : null));
    });

    return h("div", { className: "gx-panel reveal" },
      h("div", { className: "gx-panel-head" },
        h("h3", null, "Set progress"),
        h("span", { className: "gx-panel-sub" }, completeCount + " of " + rows.length + " complete")),
      h("div", { className: "gx-setgrid" }, cards));
  }

  // ============================================================ ACHIEVEMENTS
  function Achievements(sc) {
    var groups = ["Collection", "Rarity", "Sets", "Thematic", "Games", "Secret"];
    var byGroup = {};
    sc.achievements.forEach(function (a) { (byGroup[a.group] = byGroup[a.group] || []).push(a); });

    var sections = groups.filter(function (g) { return byGroup[g]; }).map(function (g) {
      var items = byGroup[g].map(function (a) { return Medallion(a); });
      return h("div", { className: "gx-ach-group" },
        h("div", { className: "gx-ach-gname" }, g),
        h("div", { className: "gx-ach-grid" }, items));
    });

    return h("div", { className: "gx-panel reveal" },
      h("div", { className: "gx-panel-head" },
        h("h3", null, "Achievements"),
        h("span", { className: "gx-panel-sub" }, sc.unlockedCount + " of " + sc.achievements.length + " · " + fmt(sc.achievementPoints) + " AP")),
      sections);
  }
  function Medallion(a) {
    var locked = !a.unlocked;
    var hidden = a.secret && locked;
    var p = pct(a.have, a.need);
    return h("div", { className: "gx-medal" + (locked ? " locked" : " unlocked") + (a.group === "Secret" ? " secret" : ""),
        title: (hidden ? "Secret achievement" : a.name + " — " + a.desc) + (locked ? "" : " (unlocked)") },
      h("div", { className: "gx-medal-disc" }, h("span", null, hidden ? "?" : (locked ? "🔒" : "★"))),
      h("div", { className: "gx-medal-name" }, hidden ? "Secret" : a.name),
      h("div", { className: "gx-medal-desc" }, hidden ? "Keep collecting to reveal" : a.desc),
      (!a.unlocked && !hidden && a.need > 1) ? h("div", { className: "gx-medal-bar" }, h("div", { className: "gx-medal-fill", style: { width: p + "%" } })) : null,
      h("div", { className: "gx-medal-pts" }, "+" + fmt(a.points) + (locked ? "" : " AP")));
  }

  // ============================================================ SHARE SCORE
  function ogScoreUrl(sc, S) {
    var top = sc.achievements.filter(function (a) { return a.unlocked && !a.secret; })
      .sort(function (a, b) { return b.points - a.points; }).slice(0, 3).map(function (a) { return a.name; });
    var q = "wallet=" + encodeURIComponent(S.address || "")
      + "&label=" + encodeURIComponent(S.label || shortAddr(S.address || ""))
      + "&score=" + sc.total + "&rank=" + encodeURIComponent(sc.rank.title)
      + "&ri=" + sc.rankIndex
      + "&u=" + sc.uniques + "&t=" + sc.totalFigures
      + "&col=" + sc.collectionScore + "&gp=" + sc.gameContribution + "&ap=" + sc.achievementPoints
      + "&m=" + sc.tiers.mythic + "&l=" + sc.tiers.legendary + "&e=" + sc.tiers.epic
      + "&r=" + sc.tiers.rare + "&un=" + sc.tiers.uncommon + "&c=" + sc.tiers.common
      + "&badges=" + encodeURIComponent(top.join("|"));
    if (sc.lbRank) q += "&pos=" + sc.lbRank;
    return SITE + "/api/og-score?" + q;
  }
  function shareScore(sc, S) {
    var who = S.isOwner ? "I'm" : ((S.label || shortAddr(S.address)) + " is");
    var posTxt = sc.lbRank ? (" ranked #" + sc.lbRank) : "";
    var text = who + posTxt + " a " + sc.rank.title + " on @HumanityCards with a Historian Score of " +
      fmt(sc.total) + "! 🏛️ " + sc.uniques + "/" + sc.totalFigures + " figures collected.\n\n" +
      SITE + "/collection?wallet=" + encodeURIComponent(S.address || "");
    var enc = encodeURIComponent(text);
    var web = "https://x.com/intent/tweet?text=" + enc;
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      setTimeout(function () { window.location.href = web; }, 500);
      window.location.href = "twitter://post?message=" + enc;
    } else {
      window.open(web, "_blank", "noopener,noreferrer");
    }
  }

  // ============================================================ COUNT-UP
  function animateScore(host) {
    if (reduceMotion) return;
    var el = host.querySelector(".gx-score[data-count]");
    if (!el) return;
    var target = parseInt(el.getAttribute("data-count"), 10) || 0, start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / 1000);
      el.textContent = fmt(Math.round(ease(p) * target));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(function () { el.textContent = fmt(target); }, 1200);
  }

  // ============================================================ MOUNT
  // host: the DOM node to render into. owned: card array. S: showcase state.
  // Computes the collection score immediately (no network), renders, then
  // fetches lifetime game points and re-renders the total + game panel.
  function mount(host, owned, S) {
    if (!host) return;
    var auth = window.useAuth ? window.useAuth() : null;
    var wallet = window.useWallet ? window.useWallet() : null;
    var isMe = S && S.isOwner;
    // only fetch game points for the connected owner (token/wallet identity);
    // a viewed wallet may have legacy wallet-keyed games — try those by ?wallet.
    var idOpts = {};
    if (isMe && auth && auth.signedIn && auth.token) idOpts.token = auth.token;
    else if (S && S.address) idOpts.wallet = S.address;

    function build(gamePoints, gameStats) {
      var sc = SCORE.compute(owned, { gamePoints: gamePoints, gameStats: gameStats, now: Date.now() });
      lastScore = sc;
      host.innerHTML = "";
      host.appendChild(ScoreHero(sc, S, {}));
      host.appendChild(RarityBreakdown(sc));
      host.appendChild(CatchEmAll(sc));
      host.appendChild(SetProgress(sc));
      host.appendChild(Achievements(sc));
      animateScore(host);
      // reveal-on-scroll: reuse the showcase's IntersectionObserver if exposed
      if (window.HCX_SHOWCASE && window.HCX_SHOWCASE.observeReveals) window.HCX_SHOWCASE.observeReveals(host);
      else host.querySelectorAll(".reveal").forEach(function (n) { n.classList.add("in"); });
      // fetch this player's leaderboard position in the background
      fetchRank(S, sc, host);
    }

    var lastScore = null;
    // first paint — collection only (instant)
    build(0, {});
    // then enrich with game points
    SCORE.gamePointsFor(idOpts).then(function (res) {
      if (res && (res.points || Object.keys(res.stats || {}).length)) build(res.points, res.stats);
    }).catch(function () {});
  }

  // fetch the player's Historian-Score leaderboard rank and surface it; also
  // push the freshly-computed score up so the board stays warm.
  function fetchRank(S, sc, host) {
    if (!S || !S.address || S.isDemo) return;
    var base = lbApiBase();
    // publish our computed score (best-effort), then read back our rank
    var auth = window.useAuth ? window.useAuth() : null;
    var headers = { "content-type": "application/json" };
    if (S.isOwner && auth && auth.signedIn && auth.token) headers["Authorization"] = "Bearer " + auth.token;
    var body = {
      wallet: S.address,
      collection_score: sc.collectionScore,
      game_points: sc.gamePoints,
      achievement_points: sc.achievementPoints,
      total: sc.total,
      unique_count: sc.uniques,
      breakdown: { m: sc.tiers.mythic, l: sc.tiers.legendary, e: sc.tiers.epic, r: sc.tiers.rare,
        un: sc.tiers.uncommon, c: sc.tiers.common, rank: sc.rank.title, ri: sc.rankIndex,
        sets: Object.keys(sc.completedSetIds).length }
    };
    fetch(base, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.rank) {
          sc.lbRank = j.rank;
          var sub = host.querySelector(".gx-ranksub");
          // append the board position inline
          if (sub && sub.textContent.indexOf("Leaderboard") < 0) {
            sub.appendChild(document.createTextNode(" · #" + j.rank + " all-time"));
          }
        }
      }).catch(function () {});
  }
  function lbApiBase() {
    var onIpfs = /\.eth(\.limo)?$/.test(location.hostname) || location.hostname.indexOf(".ipfs.") >= 0;
    return onIpfs ? "https://humanitycards.vercel.app/api/leaderboard-hc" : "/api/leaderboard-hc";
  }

  window.HCX_GAMIFY = { mount: mount, shareScore: shareScore, ogScoreUrl: ogScoreUrl };
})();
