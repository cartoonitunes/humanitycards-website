/* hcx-showcase.js — Collection Showcase ("digital trophy case").
 *
 * Standalone page (collection.html?wallet=0x… or an ENS name). Reads ANY
 * wallet's HumanityCards straight from the chain (read-only — no connection
 * required to view), and presents them as a premium, shareable trophy case.
 *
 * Data flow (all read-only, via the shared hcx-chain.js helpers):
 *   1. resolve ?wallet= (0x address or ENS name) -> checksum address
 *   2. HCX_CHAIN.refreshMinted()  -> live maxSupply / minted for every human
 *   3. HCX_CHAIN.loadOwned(addr)  -> owned figures (unwrapped + wrapped),
 *      each carrying its real cardId. Group by figure / list per-token.
 *
 * It reuses the site's Card renderer (window.Card) and palette; the rarity-tier
 * treatment (gold/purple/blue glow, badges, stacks) lives in collection.css. */
(function () {
  "use strict";
  var h = window.h, HCX = window.HCX, CH = window.HCX_CHAIN;
  var DIM = window.DIM, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  var SITE = "https://humanitycards.vercel.app";
  var OPENSEA = HCX.OPENSEA;

  // ---- rarity tiers (mapped onto the real contract supply distribution:
  // 1,3,5,10,20,30,50,100,200). Spec colours; thresholds adapted so every
  // real maxSupply lands in a tier. ----
  var TIERS = {
    legendary: { key: "legendary", name: "Legendary", color: "#FFD700", text: "#0B0B0E", score: 100, rank: 0 },
    epic:      { key: "epic",      name: "Epic",      color: "#A855F7", text: "#ffffff", score: 40,  rank: 1 },
    rare:      { key: "rare",      name: "Rare",      color: "#3B82F6", text: "#ffffff", score: 15,  rank: 2 },
    common:    { key: "common",    name: "Common",    color: "#8A8475", text: "#0B0B0E", score: 5,   rank: 3 }
  };
  var TIER_ORDER = ["legendary", "epic", "rare", "common"];
  function tierOf(maxSupply) {
    if (maxSupply <= 3) return TIERS.legendary;
    if (maxSupply <= 10) return TIERS.epic;
    if (maxSupply <= 30) return TIERS.rare;
    return TIERS.common;
  }

  var MILESTONES = [
    [10, "Curious Collector"], [25, "Dedicated Historian"], [50, "History Enthusiast"],
    [100, "Master Curator"], [150, "Grand Archivist"], [200, "Keeper of Ages"], [239, "The Completionist"]
  ];

  var SORTS = [
    { id: "rarity", label: "By Rarity" },
    { id: "name", label: "By Name (A–Z)" },
    { id: "human", label: "By Human Number" },
    { id: "era", label: "By Era" }
  ];

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- state ----
  var S = {
    address: null,        // checksum address being viewed
    label: null,          // ENS name or short address for display
    isOwner: false,       // connected wallet === viewed address
    owned: [],            // figure clones with cardId (per-token)
    view: "collection",   // collection | card
    sort: "rarity",
    filters: {},          // tier-key -> true (empty = all)
    status: "loading"     // loading | ready | empty | error | invalid | connect
  };

  var root;               // main host below the nav

  // ---------------------------------------------------------------- ENS
  var _ens = null;
  function ensProvider() {
    if (_ens) return _ens;
    var E = window.ethers; if (!E) return null;
    var Ctor = E.providers.StaticJsonRpcProvider || E.providers.JsonRpcProvider;
    try { _ens = new Ctor("https://ethereum-rpc.publicnode.com", 1); } catch (e) { _ens = null; }
    return _ens;
  }
  var ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
  function looksEns(s) { return /\.[a-z0-9-]+$/i.test(s) && !ADDR_RE.test(s); }

  function resolveTarget(raw) {
    var E = window.ethers;
    if (!raw) return Promise.resolve(null);
    raw = raw.trim();
    if (ADDR_RE.test(raw)) {
      try { return Promise.resolve(E.utils.getAddress(raw)); } catch (e) { return Promise.resolve(false); }
    }
    if (looksEns(raw)) {
      var p = ensProvider();
      if (!p) return Promise.resolve(false);
      return p.resolveName(raw).then(function (a) { return a || false; }, function () { return false; });
    }
    return Promise.resolve(false);   // not an address, not an ENS name
  }

  function reverseEns(addr) {
    var p = ensProvider();
    if (!p) return Promise.resolve(null);
    return p.lookupAddress(addr).then(function (n) { return n || null; }, function () { return null; });
  }

  // ---------------------------------------------------------------- helpers
  function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function Card(f, opts) {
    opts = opts || {};
    var t = tierOf(f.maxSupply);
    var wrap = h("div", {
      className: "card-wrap card-wrap--" + t.key + (opts.stacked ? " stacked" : ""),
      tabIndex: "0", role: "button",
      "aria-label": f.name + " — " + t.name + " HumanityCard" + (f.cardId != null ? ", token " + f.cardId : ""),
      onClick: function () { openDetail(f, opts); },
      onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(f, opts); } }
    },
      opts.stacked ? h("div", { className: "phantom p2" }) : null,
      opts.stacked ? h("div", { className: "phantom p1" }) : null,
      window.Card({ figure: f, badge: false, glow: false }),
      h("div", { className: "rarity-badge " + t.key }, t.name),
      (opts.token && f.cardId != null) ? h("div", { className: "token-chip" }, "#" + f.cardId) : null,
      (opts.count && opts.count > 1) ? h("div", { className: "count-badge" }, "×" + opts.count) : null
    );
    return wrap;
  }

  // ---------------------------------------------------------------- stats
  function computeStats() {
    var owned = S.owned;
    var byFig = {};                  // humanId -> { figure, count }
    var tierCount = { legendary: 0, epic: 0, rare: 0, common: 0 };
    owned.forEach(function (f) {
      tierCount[tierOf(f.maxSupply).key]++;
      var g = byFig[f.humanId] || (byFig[f.humanId] = { figure: f, count: 0 });
      g.count++;
    });
    var uniques = Object.keys(byFig).length;

    var score = 0;
    owned.forEach(function (f) { score += tierOf(f.maxSupply).score; });
    // +50 for each figure where you own the full set (every edition)
    var fullSets = 0;
    Object.keys(byFig).forEach(function (id) {
      var g = byFig[id];
      if (g.count >= g.figure.maxSupply) { fullSets++; score += 50; }
    });
    // +200 if you hold at least one of every rarity tier
    var allTiers = TIER_ORDER.every(function (k) { return tierCount[k] > 0; });
    if (allTiers && owned.length) score += 200;

    return {
      total: owned.length, uniques: uniques, tiers: tierCount,
      score: score, fullSets: fullSets, allTiers: allTiers, byFig: byFig
    };
  }

  // group owned -> sorted/filtered list of { figure, count } (collection view)
  function grouped(st) {
    var arr = Object.keys(st.byFig).map(function (id) { return st.byFig[id]; });
    return sortList(filterList(arr, function (g) { return g.figure; }), function (g) { return g.figure; });
  }
  function tokenList(st) {
    return sortList(filterList(S.owned.slice(), function (f) { return f; }), function (f) { return f; });
  }
  function filterList(list, pick) {
    var keys = Object.keys(S.filters);
    if (!keys.length) return list;
    return list.filter(function (item) { return S.filters[tierOf(pick(item).maxSupply).key]; });
  }
  function sortList(list, pick) {
    var a = list.slice();
    a.sort(function (x, y) {
      var fx = pick(x), fy = pick(y);
      if (S.sort === "rarity") return fx.maxSupply - fy.maxSupply || fx.humanId - fy.humanId;
      if (S.sort === "name") return fx.name.localeCompare(fy.name);
      if (S.sort === "human") return fx.humanId - fy.humanId;
      if (S.sort === "era") return fx.born - fy.born;
      return 0;
    });
    return a;
  }

  // ============================================================ RENDER
  function render() {
    if (!root) return;
    root.innerHTML = "";
    if (S.status === "loading") return root.appendChild(LoadingView());
    if (S.status === "invalid") return root.appendChild(InvalidView());
    if (S.status === "error") return root.appendChild(ErrorView());
    if (S.status === "connect") return root.appendChild(ConnectView());

    var st = computeStats();
    var frag = h("div", null);

    frag.appendChild(Hero(st));
    if (S.status === "empty" || !S.owned.length) {
      frag.appendChild(EmptyView());
      root.appendChild(wrapSection(frag));
      runReveals();
      return;
    }

    frag.appendChild(StatsBar(st));

    // trophy shelf — legendary + epic only
    var trophies = S.owned.filter(function (f) { var k = tierOf(f.maxSupply).key; return k === "legendary" || k === "epic"; });
    // de-dupe by figure for the shelf, scarcest first, cap 8
    var seen = {}, shelf = [];
    trophies.sort(function (a, b) { return a.maxSupply - b.maxSupply; }).forEach(function (f) {
      if (!seen[f.humanId]) { seen[f.humanId] = 1; shelf.push(f); }
    });
    shelf = shelf.slice(0, 8);
    if (shelf.length) frag.appendChild(TrophyShelf(shelf));

    frag.appendChild(Controls(st));
    var gridHost = h("div", { id: "grid-host" });
    frag.appendChild(gridHost);
    frag.appendChild(MeterSection(st));
    frag.appendChild(FooterCTA());

    root.appendChild(wrapSection(frag));
    renderGrid();
    runReveals();
    animateCounts();
    animateMeter();
    setupSticky();
  }

  function wrapSection(node) { return h("div", { className: "wrap" }, node); }

  // ---------------------------------------------------------------- hero
  function Hero(st) {
    var copyBtn;
    var hero = h("div", { className: "hero reveal" },
      h("div", { className: "kicker" }, S.isOwner ? "My Collection" : "Collection"),
      h("h1", null, S.isOwner ? "Your collection" : ("Collection of " + (S.label || shortAddr(S.address)))),
      h("button", { className: "addr", title: "Copy address",
        onClick: function () { copyText(S.address); window.toast && window.toast("Address copied", "ok"); } },
        S.isOwner ? [h("span", { className: "dot" }), "Connected · " + shortAddr(S.address)] : shortAddr(S.address)),
      h("div", { className: "share-row" },
        h("button", { className: "share-btn", onClick: shareTwitter }, "Share on 𝕏"),
        copyBtn = h("button", { className: "share-btn", onClick: function () { copyLink(copyBtn); } }, "Copy Link"),
        h("button", { className: "share-btn", onClick: downloadCard }, "Download Card"))
    );
    return hero;
  }

  // ---------------------------------------------------------------- stats bar
  function statCard(label, value, bottom, cls) {
    return h("div", { className: "stat", role: "group", "aria-label": label + ": " + value },
      h("div", { className: "top" }, label),
      h("div", { className: "val" + (cls ? " " + cls : ""), "data-count": String(value) }, reduceMotion ? fmt(value) : "0"),
      h("div", { className: "bot" }, bottom));
  }
  function StatsBar(st) {
    return h("div", { className: "stats reveal", role: "group", "aria-label": "Collection statistics" },
      statCard("Cards", st.total, "owned"),
      statCard("Unique", st.uniques, "figures"),
      statCard("Legendary", st.tiers.legendary, "cards", "leg"),
      statCard("Epic", st.tiers.epic, "cards", "epic"),
      h("div", { className: "stat score", role: "group", "aria-label": "Score: " + st.score },
        h("div", { className: "top" }, "Score"),
        h("div", { className: "val", "data-count": String(st.score) }, reduceMotion ? fmt(st.score) : "0"),
        h("div", { className: "bot" }, "points")));
  }

  // ---------------------------------------------------------------- trophy
  function TrophyShelf(shelf) {
    return h("div", { className: "reveal" },
      h("div", { className: "divider" }),
      h("div", { className: "trophy-sec" },
        h("div", { className: "trophy-label" }, "Trophy Shelf"),
        h("div", { className: "trophy-shelf", "aria-label": "Your rarest cards" },
          shelf.map(function (f) { return Card(f, { token: false }); }))),
      h("div", { className: "divider" }));
  }

  // ---------------------------------------------------------------- controls
  function Controls(st) {
    function tog(view) {
      return h("button", { className: S.view === view ? "active" : "", onClick: function () { setView(view); } },
        view === "collection" ? "Collection View" : "Card View");
    }
    var controls = h("div", { className: "controls reveal", id: "controls" },
      h("div", { className: "toggle", role: "tablist" }, tog("collection"), tog("card")),
      h("div", { className: "ctl-right" }, SortDD(), FilterDD()));
    return controls;
  }

  function dropdown(buttonLabel, menuBuilder) {
    var open = false;
    var menu = h("div", { className: "dd-menu", style: { display: "none" } });
    var btn = h("button", { "aria-haspopup": "true",
      onClick: function (e) { e.stopPropagation(); open = !open; menu.style.display = open ? "block" : "none"; if (open) rebuild(); } },
      h("span", null, buttonLabel.get()), h("span", { className: "chev" }, "▾"));
    function close() { open = false; menu.style.display = "none"; }
    function refreshLabel() { btn.firstChild.textContent = buttonLabel.get(); }
    function rebuild() { menu.innerHTML = ""; menuBuilder(menu, refreshLabel, close, rebuild); }
    document.addEventListener("click", close);
    var wrap = h("div", { className: "dd" }, btn, menu);
    rebuild();
    return wrap;
  }

  function SortDD() {
    return dropdown(
      { get: function () { var s = SORTS.filter(function (o) { return o.id === S.sort; })[0]; return s ? s.label : "Sort"; } },
      function (menu, refresh, close) {
        SORTS.forEach(function (o) {
          menu.appendChild(h("button", { className: S.sort === o.id ? "sel" : "",
            onClick: function () { S.sort = o.id; refresh(); close(); renderGrid(); } },
            o.label, S.sort === o.id ? h("span", { className: "check" }, "✓") : null));
        });
      });
  }

  function FilterDD() {
    return dropdown(
      { get: function () { var n = Object.keys(S.filters).length; return n ? "Filter (" + n + ")" : "Filter"; } },
      function (menu, refresh, close, rebuild) {
        // multi-select: each toggle stays open, refreshing label + ticks live.
        function opt(label, sel, dot, apply) {
          return h("button", { className: sel ? "sel" : "",
            onClick: function (e) { e.stopPropagation(); apply(); refresh(); rebuild(); renderGrid(); } },
            dot ? h("span", { className: "tier-dot " + dot }) : null, label,
            sel ? h("span", { className: "check" }, "✓") : null);
        }
        menu.appendChild(opt("All", !Object.keys(S.filters).length, null, function () { S.filters = {}; }));
        TIER_ORDER.forEach(function (k) {
          menu.appendChild(opt(TIERS[k].name, !!S.filters[k], k, function () {
            if (S.filters[k]) delete S.filters[k]; else S.filters[k] = true;
          }));
        });
      });
  }

  // ---------------------------------------------------------------- grid
  var _debounce;
  function renderGrid() {
    var host = document.getElementById("grid-host");
    if (!host) return;
    clearTimeout(_debounce);
    _debounce = setTimeout(function () { paintGrid(host); }, 60);
  }
  function paintGrid(host) {
    var st = computeStats();
    var items, build;
    if (S.view === "collection") {
      items = grouped(st);
      build = function (g) { return Card(g.figure, { stacked: g.count > 1, count: g.count }); };
    } else {
      items = tokenList(st);
      build = function (f) { return Card(f, { token: true }); };
    }
    host.innerHTML = "";
    if (!items.length) {
      host.appendChild(h("div", { className: "state-box", style: { padding: "60px 20px" } },
        h("h2", { style: { fontSize: "18px" } }, "Nothing matches"),
        h("p", null, "No cards match the current filters. Clear them to see the full collection.")));
      return;
    }
    var grid = h("div", { className: "card-grid" });
    items.forEach(function (item, i) {
      var node = build(item);
      if (!reduceMotion) {
        node.classList.add("card-wrap--entering");
        node.style.animationDelay = Math.min(i * 30, 300) + "ms";
      }
      grid.appendChild(node);
    });
    host.appendChild(grid);
  }

  function setView(v) {
    if (S.view === v) return;
    S.view = v;
    // update toggle active state
    var toggle = document.querySelector("#controls .toggle");
    if (toggle) {
      var btns = toggle.querySelectorAll("button");
      btns[0].className = v === "collection" ? "active" : "";
      btns[1].className = v === "card" ? "active" : "";
    }
    renderGrid();
  }

  // ---------------------------------------------------------------- meter
  function MeterSection(st) {
    var pct = Math.round((st.uniques / HCX.HUMANS_TOTAL) * 100);
    var next = MILESTONES.filter(function (m) { return st.uniques < m[0]; })[0];
    return h("div", { className: "meter-sec reveal" },
      h("div", { className: "label" }, "Collection Progress"),
      h("div", { className: "meter-head" },
        h("div", { className: "count" }, st.uniques + " of " + HCX.HUMANS_TOTAL + " humans"),
        h("div", { className: "pct" }, pct + "%")),
      h("div", { className: "meter-track" }, h("div", { className: "meter-fill", "data-pct": String(pct) })),
      next
        ? h("div", { className: "meter-next" }, "Next milestone: " + next[0] + " humans — ", h("b", null, "“" + next[1] + "”"))
        : h("div", { className: "meter-next" }, h("b", null, "“The Completionist”"), " — every human collected. Legendary."));
  }

  // ---------------------------------------------------------------- footer cta
  function FooterCTA() {
    return h("div", { className: "foot-cta reveal" },
      h("h2", null, S.isOwner ? "Grow your collection" : "Start your own collection"),
      h("div", { className: "row" },
        h("a", { className: "btn", href: SITE + "/#packs" }, "Open Packs"),
        h("a", { className: "btn btn--ghost", href: OPENSEA, target: "_blank", rel: "noopener noreferrer" }, "Browse OpenSea ↗")));
  }

  // ---------------------------------------------------------------- empty
  function EmptyView() {
    var preview = ["Moses", "Joan of Arc", "Einstein", "Cleopatra", "Napoleon"]
      .map(function (n) { return HCX.byName(n); }).filter(Boolean);
    var ghosts = h("div", { className: "ghost-fan", "aria-hidden": "true" },
      preview.map(function (f) {
        return h("div", { className: "gcard" }, window.Card({ figure: f, badge: false, glow: false }));
      }));
    var someoneElse = !S.isOwner;
    return h("div", { className: "empty reveal" },
      ghosts,
      h("div", { className: "veil" }),
      h("div", { className: "inner" },
        h("div", { className: "kicker" }, someoneElse ? "Empty" : "No cards yet"),
        h("h2", null, someoneElse ? "This wallet has no cards" : "Start your collection"),
        h("p", null, someoneElse
          ? "There's nothing here yet. Explore the full roster of 239 historical figures and start your own."
          : "History's greatest figures are waiting. Open a pack or pick one up on the secondary market."),
        h("div", { className: "row" },
          someoneElse
            ? h("a", { className: "btn", href: SITE + "/#roster" }, "View Full Roster")
            : h("a", { className: "btn", href: SITE + "/#packs" }, "Open Your First Pack"),
          h("a", { className: "btn btn--ghost", href: OPENSEA, target: "_blank", rel: "noopener noreferrer" }, "Browse on OpenSea ↗"))));
  }

  // ---------------------------------------------------------------- connect
  function ConnectView() {
    return h("div", { className: "wrap" },
      h("div", { className: "hero", style: { paddingTop: "48px" } },
        h("div", { className: "kicker" }, "Collection Showcase"),
        h("h1", null, "View any collection"),
        h("p", { style: { maxWidth: "460px", font: "400 16px/1.6 " + SANS, color: DIM, margin: "8px 0 24px" } },
          "Connect your wallet to see your own HumanityCards, or open a shared link to view anyone's collection — no connection needed."),
        h("div", { className: "row", style: { display: "flex", gap: "14px", flexWrap: "wrap" } },
          h("button", { className: "btn", onClick: connectWallet }, "Connect Wallet"),
          h("a", { className: "btn btn--ghost", href: SITE + "/#roster" }, "Browse Roster"))));
  }

  // ---------------------------------------------------------------- loading / error / invalid
  function LoadingView() {
    var stats = h("div", { className: "stats" });
    for (var i = 0; i < 5; i++) stats.appendChild(h("div", { className: "skeleton skel-stat" + (i === 4 ? " score" : "") }));
    var grid = h("div", { className: "card-grid", style: { marginTop: "32px" } });
    var n = window.innerWidth < 768 ? 6 : 12;
    for (var j = 0; j < n; j++) grid.appendChild(h("div", { className: "skeleton skel-card" }));
    return h("div", { className: "wrap" },
      h("div", { className: "hero" },
        h("div", { className: "kicker" }, "Loading"),
        h("h1", null, S.label ? ("Collection of " + S.label) : "Reading the chain…"),
        h("div", { style: { font: "400 13px/1.5 " + SANS, color: DIM } }, shortAddr(S.address || ""))),
      stats, grid);
  }
  function ErrorView() {
    return h("div", { className: "wrap" },
      h("div", { className: "state-box" },
        h("div", { className: "ico" }, "⚠"),
        h("h2", null, "Couldn't load collection"),
        h("p", null, "We had trouble reading the blockchain. This usually resolves itself in a moment."),
        h("button", { className: "btn btn--ghost", onClick: function () { S.status = "loading"; render(); loadData(); } }, "Try Again")));
  }
  function InvalidView() {
    return h("div", { className: "wrap" },
      h("div", { className: "state-box" },
        h("div", { className: "ico" }, "⚠"),
        h("h2", null, "Address not found"),
        h("p", null, "This doesn't look like a valid Ethereum address or ENS name. Double-check the URL."),
        h("a", { className: "btn btn--ghost", href: SITE + "/" }, "Back to Home")));
  }

  // ============================================================ DETAIL MODAL
  function openDetail(f, opts) {
    opts = opts || {};
    var t = tierOf(f.maxSupply);
    var overlay, sheet, startY = null, curY = 0;
    function close() {
      if (!overlay) return;
      overlay.classList.add("closing");
      document.removeEventListener("keydown", onKey);
      setTimeout(function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 240);
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    var cardBox = h("div", { className: "m-card" },
      h("div", { className: "card-wrap card-wrap--" + t.key, style: { cursor: "default" } },
        window.Card({ figure: f, badge: false, glow: false }),
        h("div", { className: "rarity-badge " + t.key }, t.name)));

    var rarityLine = t.name + (f.cardId != null ? "  ·  Token #" + f.cardId : "")
      + (opts.count && opts.count > 1 ? "  ·  ×" + opts.count + " owned" : "");

    var cells = [
      ["Human Number", f.humanId],
      ["Max Supply", f.maxSupply],
      ["Minted", (f.minted != null ? f.minted : "?") + " / " + f.maxSupply],
      [f.cardId != null ? "Token ID" : "Rarity", f.cardId != null ? "#" + f.cardId : t.name],
      ["Era", f.era || (HCX.lifespan ? HCX.lifespan(f) : "")],
      ["Status", f.wrapped ? "Wrapped (wHCX)" : (f.owned ? "Unwrapped (2018)" : "—")]
    ];

    var modal = h("div", { className: "modal", role: "dialog", "aria-modal": "true", "aria-label": f.name + " detail",
      onClick: function (e) { e.stopPropagation(); } },
      h("div", { className: "drag" }),
      h("button", { className: "close", "aria-label": "Close", onClick: close }, "×"),
      cardBox,
      h("div", { style: { minWidth: 0 } },
        h("h2", { className: "m-name" }, f.name),
        h("div", { className: "m-rarity", style: { color: t.color } }, rarityLine),
        f.bio ? h("p", { className: "m-bio" }, f.bio)
              : h("p", { className: "m-bio" }, (f.role ? f.role + ". " : "") + "Human No. " + f.humanId + " in the HumanityCards roster."),
        h("div", { className: "m-grid" }, cells.map(function (c) {
          return h("div", { className: "m-cell" }, h("div", { className: "k" }, c[0]), h("div", { className: "v" }, String(c[1])));
        })),
        h("div", { className: "m-links" },
          h("a", { href: OPENSEA, target: "_blank", rel: "noopener noreferrer" }, "View on OpenSea ↗"),
          h("a", { href: "https://etherscan.io/address/" + (f.wrapped ? HCX.WRAPPER : f.contract), target: "_blank", rel: "noopener noreferrer" },
            "View on Etherscan ↗"))));

    overlay = h("div", { className: "overlay", onClick: close }, modal);

    // mobile: swipe-down-to-dismiss on the sheet
    modal.addEventListener("touchstart", function (e) { if (e.touches[0]) startY = e.touches[0].clientY; }, { passive: true });
    modal.addEventListener("touchmove", function (e) {
      if (startY == null || modal.scrollTop > 0) return;
      curY = e.touches[0].clientY - startY;
      if (curY > 0) { modal.style.transform = "translateY(" + curY + "px)"; }
    }, { passive: true });
    modal.addEventListener("touchend", function () {
      if (curY > modal.offsetHeight * 0.3) { close(); }
      else { modal.style.transform = ""; }
      startY = null; curY = 0;
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    // focus trap entry
    var closeBtn = modal.querySelector(".close"); if (closeBtn) closeBtn.focus();
  }

  // ============================================================ SHARE
  function ogImageUrl(st) {
    st = st || computeStats();
    // top 5 rarest figures (scarcest first), de-duped by figure
    var seen = {}, top = [];
    S.owned.slice().sort(function (a, b) { return a.maxSupply - b.maxSupply || a.humanId - b.humanId; }).forEach(function (f) {
      if (!seen[f.humanId] && top.length < 5) { seen[f.humanId] = 1; top.push(f.name + "|" + tierOf(f.maxSupply).key); }
    });
    var q = "wallet=" + encodeURIComponent(S.address || "")
      + "&label=" + encodeURIComponent(S.label || shortAddr(S.address || ""))
      + "&n=" + st.total + "&u=" + st.uniques
      + "&l=" + st.tiers.legendary + "&e=" + st.tiers.epic
      + "&r=" + st.tiers.rare + "&c=" + st.tiers.common
      + "&score=" + st.score
      + "&top=" + encodeURIComponent(top.join(","));
    return SITE + "/api/og-collection?" + q;
  }
  function shareUrl() {
    return SITE + "/collection?wallet=" + encodeURIComponent(S.address || "");
  }
  function shareTwitter() {
    var st = computeStats();
    var who = S.isOwner ? "My" : ((S.label || shortAddr(S.address)) + "'s");
    var text = who + " HumanityCards collection — " + st.total + " cards, "
      + st.tiers.legendary + " Legendary 👑\n\nScore: " + fmt(st.score);
    var url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(shareUrl());
    window.open(url, "_blank", "noopener");
  }
  function copyLink(btn) {
    copyText(shareUrl());
    var prev = btn.textContent;
    btn.textContent = "Copied!"; btn.classList.add("flash-ok");
    setTimeout(function () { btn.textContent = prev; btn.classList.remove("flash-ok"); }, 2000);
  }
  function downloadCard() {
    var url = ogImageUrl();
    window.toast && window.toast("Generating share image…");
    fetch(url).then(function (r) { if (!r.ok) throw new Error("og " + r.status); return r.blob(); }).then(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "humanitycards-" + (S.label || shortAddr(S.address)) + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }).catch(function () {
      // fall back to opening the image in a new tab
      window.open(url, "_blank", "noopener");
    });
  }
  function copyText(t) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    } catch (e) {}
    var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  // ---------------------------------------------------------------- meta tags
  function updateMeta(st) {
    var who = S.isOwner ? "My" : ((S.label || shortAddr(S.address)) + "'s");
    var title = who + " HumanityCards Collection";
    var desc = st.total + " cards · " + st.uniques + " unique figures · "
      + st.tiers.legendary + " Legendary · Score " + fmt(st.score);
    var img = ogImageUrl(st);
    document.title = title + " — HumanityCards";
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", shareUrl());
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
  }
  function setMeta(attr, key, val) {
    var el = document.head.querySelector("meta[" + attr + "='" + key + "']");
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", val);
  }

  // ============================================================ ANIMATIONS
  function animateCounts() {
    if (reduceMotion) return;
    var els = root.querySelectorAll(".stat .val[data-count]");
    Array.prototype.forEach.call(els, function (el, i) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      setTimeout(function () { countUp(el, target, 800); }, i * 90);
      // guarantee the final value lands even if requestAnimationFrame is
      // throttled (e.g. a backgrounded tab) — correctness over animation.
      setTimeout(function () { el.textContent = fmt(target); }, i * 90 + 1150);
    });
  }
  function countUp(el, target, dur) {
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = fmt(Math.round(ease(p) * target));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function animateMeter() {
    var fill = root.querySelector(".meter-fill");
    if (!fill) return;
    var pct = parseInt(fill.getAttribute("data-pct"), 10) || 0;
    if (reduceMotion) { fill.style.width = pct + "%"; return; }
    requestAnimationFrame(function () { setTimeout(function () { fill.style.width = pct + "%"; }, 120); });
  }
  function runReveals() {
    var els = root.querySelectorAll(".reveal");
    if (reduceMotion) { Array.prototype.forEach.call(els, function (e) { e.classList.add("in"); }); return; }
    if (!("IntersectionObserver" in window)) { Array.prototype.forEach.call(els, function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -40px 0px", threshold: 0.05 });
    // above-the-fold: stagger in immediately; below: observe
    var idx = 0;
    Array.prototype.forEach.call(els, function (e) {
      var top = e.getBoundingClientRect().top;
      if (top < window.innerHeight) { (function (d) { setTimeout(function () { e.classList.add("in"); }, d); })(idx++ * 90); }
      else io.observe(e);
    });
  }

  // sticky mobile controls
  function setupSticky() {
    var controls = document.getElementById("controls");
    if (!controls) return;
    var anchor = controls.offsetTop;
    function onScroll() {
      if (window.innerWidth > 767) { controls.classList.remove("stuck"); return; }
      controls.classList.toggle("stuck", window.scrollY > anchor - 56);
    }
    window.removeEventListener("scroll", window.__scStick || function () {});
    window.__scStick = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // scroll-to-top button (mounted once)
  function mountToTop() {
    var btn = h("button", { className: "to-top", "aria-label": "Scroll to top",
      onClick: function () { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); } }, "↑");
    document.body.appendChild(btn);
    window.addEventListener("scroll", function () { btn.classList.toggle("show", window.scrollY > 600); }, { passive: true });
  }

  // ============================================================ DATA + BOOT
  function loadData() {
    if (!window.ethers) { S.status = "error"; render(); return; }
    S.status = "loading"; render();
    // refresh live supply/minted, then enumerate ownership.
    CH.refreshMinted().then(function () {
      if (!CH.mintedLive()) { S.status = "error"; render(); return; }
      return CH.loadOwned(S.address).then(function (owned) {
        S.owned = owned || [];
        S.status = S.owned.length ? "ready" : "empty";
        render();
        updateMeta(computeStats());
      });
    }).catch(function () { S.status = "error"; render(); });
  }

  function connectWallet() {
    if (!CH || !CH.connect) return;
    CH.connect().then(function () {
      var w = window.useWallet();
      if (w.connected && w.address) {
        S.address = w.address; S.isOwner = true;
        S.label = null;
        history.replaceState(null, "", "/collection?wallet=" + w.address);
        reverseEns(w.address).then(function (n) { if (n) { S.label = n; if (S.status === "ready" || S.status === "empty") render(); } });
        loadData();
      }
    });
  }

  function boot() {
    root = document.getElementById("sc-root");
    mountToTop();
    wireNav();

    var params = new URLSearchParams(location.search);
    var walletParam = params.get("wallet") || params.get("address");
    var w = window.useWallet();

    // Demo mode (?demo=1): render a representative collection across every tier
    // without a wallet or chain reads — handy for screenshots and QA. Harmless
    // in production: it only fires on the explicit query flag.
    if (params.get("demo")) {
      S.address = "0xDE3010000000000000000000000000000000A1ce";
      S.label = "demo.eth"; S.isOwner = false; S.owned = buildDemo(); S.status = "ready";
      render(); updateMeta(computeStats());
      return;
    }

    function start(addr) {
      S.address = addr;
      S.isOwner = !!(w.connected && w.address && w.address.toLowerCase() === addr.toLowerCase());
      S.label = ADDR_RE.test(walletParam || "") ? null : (looksEns(walletParam || "") ? walletParam : null);
      render();
      // resolve a nicer label in the background
      reverseEns(addr).then(function (n) {
        if (n) { S.label = n; if (S.status === "ready" || S.status === "empty" || S.status === "loading") render(); updateMetaMaybe(); }
      });
      loadData();
    }
    function updateMetaMaybe() { if (S.status === "ready" || S.status === "empty") updateMeta(computeStats()); }

    if (walletParam) {
      S.status = "loading"; render();
      resolveTarget(walletParam).then(function (addr) {
        if (addr === false || !addr) { S.status = "invalid"; render(); return; }
        start(addr);
      });
    } else if (w.connected && w.address) {
      start(w.address);
    } else {
      S.status = "connect"; render();
      // if an eager reconnect lands shortly after, switch to the owner's view
      var w2 = window.useWallet();
      w2.subscribe(function () {
        if (S.status === "connect" && w2.connected && w2.address) {
          S.address = w2.address; S.isOwner = true;
          history.replaceState(null, "", "/collection?wallet=" + w2.address);
          loadData();
          reverseEns(w2.address).then(function (n) { if (n) { S.label = n; render(); } });
        }
      });
    }
  }

  function buildDemo() {
    var legendary = ["Moses", "Jesus", "Muhammad", "Alexander The Great", "Napoleon", "Satoshi Nakamoto", "Abraham"];
    var epic = ["Buddha", "Gengis Khan", "Cleopatra", "Da Vinci", "Nikola Tesla", "Caesar", "Hannibal", "Gandhi"];
    var rare = ["Einstein", "Aristotle", "Plato", "Joan of Arc", "Machiavelli", "Cyrus The Great"];
    var common = ["Trump", "Obama", "Elon Musk", "Michael Jackson", "Marie Curie", "Steve Jobs"];
    var owned = [], cid = 1000;
    [].concat(legendary, epic, rare, common).forEach(function (nm) {
      var f = HCX.byName(nm);
      if (f) owned.push(Object.assign({}, f, { cardId: cid++, owned: true, wrapped: cid % 2 === 0 }));
    });
    // a few duplicates so the collection-view stack indicator shows
    ["Cleopatra", "Napoleon", "Einstein"].forEach(function (nm) {
      var f = HCX.byName(nm); if (f) owned.push(Object.assign({}, f, { cardId: cid++, owned: true, wrapped: true }));
    });
    return owned;
  }

  function wireNav() {
    // active link + wallet chip in the static nav
    var slot = document.getElementById("sc-wallet");
    var w = window.useWallet();
    function paint() {
      if (!slot) return;
      slot.innerHTML = "";
      if (w.connected && w.address) {
        slot.appendChild(h("button", { className: "share-btn", title: "Connected", onClick: function () { CH.disconnect && CH.disconnect(); } },
          h("span", { className: "dot" }), shortAddr(w.address)));
      } else {
        slot.appendChild(h("button", { className: "btn btn--sm", onClick: connectWallet, disabled: w.connecting }, w.connecting ? "Connecting…" : "Connect Wallet"));
      }
    }
    w.subscribe(paint);
    paint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
