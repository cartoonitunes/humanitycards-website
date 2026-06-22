/* hcx-sets.js — the gamification foundation. Tags every figure on the real 2018
 * contract with era / category / continent / gender, defines the collectible
 * "sets" (era, category, women, mini), and maps each card's real on-chain max
 * supply onto a named rarity tier.
 *
 * This is pure static metadata + helpers (window.HCX_SETS). The scoring engine
 * (hcx-score.js) and the UI (hcx-gamify.js, hcx-leaderboard.js) read from it.
 *
 * Rarity tiers are mapped onto the REAL supply distribution of the contract
 * (supplies are 1,3,5,10,20,30,50,100,200) — not invented numbers. The tier
 * NAMES are the game layer; cards still show their honest "1 of N" supply
 * elsewhere on the site. Point values follow the design doc. */
(function () {
  "use strict";
  var HCX = window.HCX;
  if (!HCX) return;

  // ---- rarity tiers (named scarcity, mapped to real max supply) ------------
  // mythic ≤3 · legendary ≤5 · epic ≤10 · rare ≤20 · uncommon ≤50 · common >50
  var TIERS = {
    mythic:    { key: "mythic",    name: "Mythic",    color: "#E9C46A", glow: "rgba(233,196,106,.55)", base: 150, order: 0, prismatic: true },
    legendary: { key: "legendary", name: "Legendary", color: "#FFD700", glow: "rgba(255,215,0,.45)",   base: 100, order: 1 },
    epic:      { key: "epic",      name: "Epic",      color: "#A855F7", glow: "rgba(168,85,247,.40)",  base: 50,  order: 2 },
    rare:      { key: "rare",      name: "Rare",      color: "#3B82F6", glow: "rgba(59,130,246,.35)",  base: 25,  order: 3 },
    uncommon:  { key: "uncommon",  name: "Uncommon",  color: "#63A92C", glow: "rgba(99,169,44,.32)",   base: 15,  order: 4 },
    common:    { key: "common",    name: "Common",    color: "#8A8475", glow: "rgba(138,132,117,.25)", base: 10,  order: 5 }
  };
  var TIER_ORDER = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];
  function tierKey(maxSupply) {
    var s = maxSupply;
    if (s <= 3) return "mythic";
    if (s <= 5) return "legendary";
    if (s <= 10) return "epic";
    if (s <= 20) return "rare";
    if (s <= 50) return "uncommon";
    return "common";
  }
  function tierOf(maxSupply) { return TIERS[tierKey(maxSupply)]; }

  // ---- per-figure classification (humanId -> category / continent / gender)
  // Categories: Conqueror, Monarch, Philosopher, Scientist, Artist,
  // Revolutionary, Statesman, Explorer, Religious, Magnate, Outlaw.
  var CLASS = {
    "0":{c:"Religious",k:"Africa",g:"M"},"1":{c:"Philosopher",k:"Asia",g:"M"},"2":{c:"Scientist",k:"Europe",g:"M"},"3":{c:"Religious",k:"Asia",g:"M"},"4":{c:"Explorer",k:"Europe",g:"M"},"5":{c:"Religious",k:"Asia",g:"M"},"6":{c:"Scientist",k:"Europe",g:"M"},"7":{c:"Scientist",k:"Europe",g:"M"},"8":{c:"Scientist",k:"Europe",g:"M"},"9":{c:"Monarch",k:"Europe",g:"M"},
    "10":{c:"Scientist",k:"Europe",g:"M"},"11":{c:"Scientist",k:"Europe",g:"M"},"12":{c:"Scientist",k:"Europe",g:"M"},"13":{c:"Religious",k:"Asia",g:"M"},"14":{c:"Religious",k:"Asia",g:"M"},"15":{c:"Scientist",k:"Asia",g:"M"},"16":{c:"Philosopher",k:"Europe",g:"M"},"17":{c:"Scientist",k:"Africa",g:"M"},"18":{c:"Scientist",k:"Europe",g:"M"},"19":{c:"Scientist",k:"Europe",g:"M"},
    "20":{c:"Monarch",k:"Asia",g:"M"},"21":{c:"Monarch",k:"Europe",g:"M"},"22":{c:"Monarch",k:"Europe",g:"M"},"23":{c:"Revolutionary",k:"Europe",g:"M"},"24":{c:"Statesman",k:"Americas",g:"M"},"25":{c:"Philosopher",k:"Europe",g:"M"},"26":{c:"Monarch",k:"Asia",g:"M"},"27":{c:"Conqueror",k:"Asia",g:"M"},"28":{c:"Philosopher",k:"Europe",g:"M"},"29":{c:"Artist",k:"Europe",g:"M"},
    "30":{c:"Scientist",k:"Europe",g:"M"},"31":{c:"Conqueror",k:"Europe",g:"M"},"32":{c:"Conqueror",k:"Europe",g:"M"},"33":{c:"Scientist",k:"Americas",g:"M"},"34":{c:"Monarch",k:"Africa",g:"M"},"35":{c:"Scientist",k:"Americas",g:"M"},"36":{c:"Scientist",k:"Europe",g:"M"},"37":{c:"Statesman",k:"Europe",g:"M"},"38":{c:"Philosopher",k:"Europe",g:"M"},"39":{c:"Revolutionary",k:"Americas",g:"M"},
    "40":{c:"Scientist",k:"Americas",g:"M"},"41":{c:"Scientist",k:"Europe",g:"M"},"42":{c:"Philosopher",k:"Europe",g:"M"},"43":{c:"Artist",k:"Europe",g:"M"},"44":{c:"Scientist",k:"Europe",g:"M"},"45":{c:"Monarch",k:"Asia",g:"M"},"46":{c:"Revolutionary",k:"Americas",g:"M"},"47":{c:"Philosopher",k:"Europe",g:"M"},"48":{c:"Artist",k:"Europe",g:"M"},"49":{c:"Religious",k:"Europe",g:"M"},
    "50":{c:"Monarch",k:"Asia",g:"M"},"51":{c:"Monarch",k:"Asia",g:"M"},"52":{c:"Religious",k:"Africa",g:"M"},"53":{c:"Scientist",k:"Europe",g:"M"},"54":{c:"Scientist",k:"Europe",g:"M"},"55":{c:"Revolutionary",k:"Europe",g:"M"},"56":{c:"Statesman",k:"Africa",g:"M"},"57":{c:"Scientist",k:"Europe",g:"M"},"58":{c:"Statesman",k:"Americas",g:"M"},"59":{c:"Scientist",k:"Europe",g:"M"},
    "60":{c:"Explorer",k:"Europe",g:"M"},"61":{c:"Explorer",k:"Europe",g:"M"},"62":{c:"Statesman",k:"Americas",g:"M"},"63":{c:"Monarch",k:"Europe",g:"F"},"64":{c:"Statesman",k:"Europe",g:"M"},"65":{c:"Conqueror",k:"Europe",g:"M"},"66":{c:"Scientist",k:"Europe",g:"M"},"67":{c:"Scientist",k:"Europe",g:"M"},"68":{c:"Scientist",k:"Europe",g:"M"},"69":{c:"Artist",k:"Europe",g:"M"},
    "70":{c:"Philosopher",k:"Asia",g:"M"},"71":{c:"Philosopher",k:"Europe",g:"M"},"72":{c:"Scientist",k:"Europe",g:"M"},"73":{c:"Statesman",k:"Asia",g:"M"},"74":{c:"Scientist",k:"Europe",g:"M"},"75":{c:"Philosopher",k:"Europe",g:"M"},"76":{c:"Philosopher",k:"Europe",g:"M"},"77":{c:"Philosopher",k:"Europe",g:"M"},"78":{c:"Statesman",k:"Americas",g:"M"},"79":{c:"Statesman",k:"Asia",g:"M"},
    "80":{c:"Religious",k:"Asia",g:"M"},"81":{c:"Revolutionary",k:"Europe",g:"M"},"82":{c:"Monarch",k:"Asia",g:"M"},"83":{c:"Explorer",k:"Europe",g:"M"},"84":{c:"Monarch",k:"Asia",g:"M"},"85":{c:"Monarch",k:"Europe",g:"M"},"86":{c:"Statesman",k:"Asia",g:"M"},"87":{c:"Philosopher",k:"Europe",g:"M"},"88":{c:"Magnate",k:"Americas",g:"M"},"89":{c:"Philosopher",k:"Asia",g:"M"},
    "90":{c:"Religious",k:"Asia",g:"M"},"91":{c:"Monarch",k:"Europe",g:"F"},"92":{c:"Statesman",k:"Europe",g:"M"},"93":{c:"Monarch",k:"Africa",g:"M"},"94":{c:"Monarch",k:"Europe",g:"M"},"95":{c:"Artist",k:"Europe",g:"M"},"96":{c:"Monarch",k:"Europe",g:"M"},"97":{c:"Religious",k:"Asia",g:"M"},"98":{c:"Statesman",k:"Americas",g:"M"},"99":{c:"Statesman",k:"Asia",g:"M"},
    "100":{c:"Statesman",k:"Europe",g:"M"},"101":{c:"Statesman",k:"Asia",g:"M"},"102":{c:"Statesman",k:"Europe",g:"F"},"103":{c:"Statesman",k:"Americas",g:"M"},"104":{c:"Statesman",k:"Europe",g:"M"},"105":{c:"Statesman",k:"Asia",g:"M"},"106":{c:"Statesman",k:"Americas",g:"M"},"107":{c:"Statesman",k:"Africa",g:"M"},"108":{c:"Statesman",k:"Africa",g:"M"},"109":{c:"Magnate",k:"Americas",g:"M"},
    "110":{c:"Magnate",k:"Americas",g:"M"},"111":{c:"Magnate",k:"Americas",g:"M"},"112":{c:"Magnate",k:"Americas",g:"M"},"113":{c:"Revolutionary",k:"Europe",g:"F"},"114":{c:"Monarch",k:"Europe",g:"F"},"115":{c:"Conqueror",k:"Europe",g:"M"},"116":{c:"Magnate",k:"Americas",g:"M"},"117":{c:"Magnate",k:"Americas",g:"M"},"118":{c:"Statesman",k:"Europe",g:"M"},"119":{c:"Monarch",k:"Africa",g:"F"},
    "120":{c:"Conqueror",k:"Europe",g:"M"},"121":{c:"Conqueror",k:"Europe",g:"M"},"122":{c:"Statesman",k:"Europe",g:"M"},"123":{c:"Conqueror",k:"Europe",g:"M"},"124":{c:"Conqueror",k:"Europe",g:"M"},"125":{c:"Philosopher",k:"Europe",g:"M"},"126":{c:"Statesman",k:"Europe",g:"M"},"127":{c:"Statesman",k:"Europe",g:"M"},"128":{c:"Statesman",k:"Americas",g:"F"},"129":{c:"Magnate",k:"Americas",g:"M"},
    "130":{c:"Statesman",k:"Africa",g:"M"},"131":{c:"Statesman",k:"Europe",g:"M"},"132":{c:"Statesman",k:"Americas",g:"M"},"133":{c:"Monarch",k:"Europe",g:"F"},"134":{c:"Monarch",k:"Europe",g:"M"},"135":{c:"Statesman",k:"Americas",g:"M"},"136":{c:"Statesman",k:"Americas",g:"M"},"137":{c:"Statesman",k:"Americas",g:"M"},"138":{c:"Revolutionary",k:"Americas",g:"M"},"139":{c:"Statesman",k:"Europe",g:"M"},
    "140":{c:"Statesman",k:"Asia",g:"M"},"141":{c:"Statesman",k:"Asia",g:"M"},"142":{c:"Statesman",k:"Asia",g:"M"},"143":{c:"Monarch",k:"Africa",g:"M"},"144":{c:"Monarch",k:"Europe",g:"M"},"145":{c:"Statesman",k:"Asia",g:"M"},"146":{c:"Statesman",k:"Asia",g:"M"},"147":{c:"Magnate",k:"Asia",g:"M"},"148":{c:"Conqueror",k:"Europe",g:"M"},"149":{c:"Monarch",k:"Europe",g:"M"},
    "150":{c:"Conqueror",k:"Africa",g:"M"},"151":{c:"Monarch",k:"Europe",g:"M"},"152":{c:"Conqueror",k:"Europe",g:"M"},"153":{c:"Conqueror",k:"Africa",g:"M"},"154":{c:"Religious",k:"Asia",g:"M"},"155":{c:"Magnate",k:"Europe",g:"M"},"156":{c:"Conqueror",k:"Asia",g:"M"},"157":{c:"Revolutionary",k:"Asia",g:"M"},"158":{c:"Artist",k:"Americas",g:"M"},"159":{c:"Artist",k:"Americas",g:"M"},
    "160":{c:"Artist",k:"Europe",g:"M"},"161":{c:"Artist",k:"Europe",g:"M"},"162":{c:"Statesman",k:"Europe",g:"M"},"163":{c:"Artist",k:"Europe",g:"M"},"164":{c:"Monarch",k:"Africa",g:"M"},"165":{c:"Monarch",k:"Africa",g:"F"},"166":{c:"Monarch",k:"Africa",g:"M"},"167":{c:"Monarch",k:"Europe",g:"M"},"168":{c:"Magnate",k:"Americas",g:"M"},"169":{c:"Monarch",k:"Americas",g:"M"},
    "170":{c:"Scientist",k:"Europe",g:"M"},"171":{c:"Statesman",k:"Americas",g:"M"},"172":{c:"Scientist",k:"Europe",g:"F"},"173":{c:"Statesman",k:"Asia",g:"M"},"174":{c:"Statesman",k:"Asia",g:"M"},"175":{c:"Monarch",k:"Africa",g:"M"},"176":{c:"Artist",k:"Americas",g:"M"},"177":{c:"Statesman",k:"Europe",g:"M"},"178":{c:"Monarch",k:"Europe",g:"M"},"179":{c:"Outlaw",k:"Europe",g:"M"},
    "180":{c:"Outlaw",k:"Americas",g:"M"},"181":{c:"Outlaw",k:"Americas",g:"M"},"182":{c:"Monarch",k:"Europe",g:"M"},"183":{c:"Statesman",k:"Europe",g:"M"},"184":{c:"Monarch",k:"Europe",g:"M"},"185":{c:"Monarch",k:"Europe",g:"M"},"186":{c:"Monarch",k:"Europe",g:"M"},"187":{c:"Artist",k:"Europe",g:"M"},"188":{c:"Statesman",k:"Europe",g:"F"},"189":{c:"Artist",k:"Europe",g:"M"},
    "190":{c:"Philosopher",k:"Europe",g:"M"},"191":{c:"Scientist",k:"Europe",g:"M"},"192":{c:"Revolutionary",k:"Asia",g:"M"},"193":{c:"Revolutionary",k:"Americas",g:"M"},"194":{c:"Scientist",k:"Europe",g:"M"},"195":{c:"Monarch",k:"Europe",g:"M"},"196":{c:"Statesman",k:"Europe",g:"M"},"197":{c:"Revolutionary",k:"Asia",g:"M"},"198":{c:"Monarch",k:"Asia",g:"M"},"199":{c:"Scientist",k:"Africa",g:"M"},
    "200":{c:"Statesman",k:"Asia",g:"M"},"201":{c:"Monarch",k:"Africa",g:"M"},"202":{c:"Revolutionary",k:"Americas",g:"M"},"203":{c:"Monarch",k:"Europe",g:"M"},"204":{c:"Revolutionary",k:"Europe",g:"M"},"205":{c:"Statesman",k:"Asia",g:"M"},"206":{c:"Monarch",k:"Europe",g:"M"},"207":{c:"Scientist",k:"Europe",g:"M"},"208":{c:"Statesman",k:"Europe",g:"M"},"209":{c:"Artist",k:"Europe",g:"M"},
    "210":{c:"Explorer",k:"Europe",g:"M"},"211":{c:"Scientist",k:"Europe",g:"M"},"212":{c:"Monarch",k:"Africa",g:"M"},"213":{c:"Statesman",k:"Americas",g:"M"},"214":{c:"Outlaw",k:"Europe",g:"M"},"215":{c:"Revolutionary",k:"Europe",g:"M"},"216":{c:"Statesman",k:"Americas",g:"M"},"217":{c:"Statesman",k:"Americas",g:"M"},"218":{c:"Statesman",k:"Asia",g:"M"},"219":{c:"Monarch",k:"Africa",g:"M"},
    "220":{c:"Statesman",k:"Asia",g:"M"},"221":{c:"Monarch",k:"Europe",g:"M"},"222":{c:"Monarch",k:"Europe",g:"M"},"223":{c:"Revolutionary",k:"Europe",g:"M"},"224":{c:"Scientist",k:"Europe",g:"M"},"225":{c:"Artist",k:"Europe",g:"M"},"226":{c:"Monarch",k:"Europe",g:"M"},"227":{c:"Monarch",k:"Europe",g:"F"},"228":{c:"Revolutionary",k:"Europe",g:"M"},"229":{c:"Monarch",k:"Europe",g:"M"},
    "230":{c:"Magnate",k:"Asia",g:"M"},"231":{c:"Magnate",k:"Americas",g:"M"},"232":{c:"Artist",k:"Americas",g:"M"},"233":{c:"Artist",k:"Americas",g:"M"},"234":{c:"Artist",k:"Europe",g:"M"},"235":{c:"Statesman",k:"Asia",g:"M"},"236":{c:"Statesman",k:"Europe",g:"M"},"237":{c:"Outlaw",k:"Asia",g:"M"},"238":{c:"Outlaw",k:"Europe",g:"M"}
  };

  // ---- era from birth year (data-driven, exact to the design doc ranges) ---
  function eraOf(born) {
    if (born == null) return "Modern";
    if (born < 500) return "Ancient";
    if (born < 1400) return "Medieval";
    if (born < 1600) return "Renaissance";
    if (born < 1800) return "Early Modern";
    if (born < 1940) return "Modern";
    return "Contemporary";
  }
  // Era SET membership (slightly different buckets — the 5 collectible eras)
  function eraSetOf(born) {
    if (born == null) return "modern-era";
    if (born < 500) return "ancient-world";
    if (born < 1400) return "middle-ages";
    if (born < 1600) return "renaissance";
    if (born < 1800) return "enlightenment";
    return "modern-era";
  }

  // ---- decorate every figure with its metadata (idempotent) ----------------
  var FIGS = HCX.FIGURES || [];
  FIGS.forEach(function (f) {
    var cl = CLASS[String(f.humanId)] || { c: "Statesman", k: "Europe", g: "M" };
    f.meta = {
      tier: tierKey(f.maxSupply),
      category: cl.c,
      continent: cl.k,
      gender: cl.g,
      era: eraOf(f.born),
      eraSet: eraSetOf(f.born)
    };
  });

  var TOTAL = FIGS.length;   // real roster size (239), not the doc's "203"

  // ---- mini sets (curated, real figures only) -----------------------------
  // Each is a small completable group; completing one is a flat-bonus "aha".
  var MINI = [
    { id: "the-prophets",   name: "The Prophets",       ids: [0, 5, 13, 154],     flavor: "Moses, Jesus, Muhammad & Abraham — the rarest cards in existence." },
    { id: "the-academy",    name: "The Academy",        ids: [42, 38, 16],        flavor: "Socrates → Plato → Aristotle. Three generations of genius." },
    { id: "first-triumvir", name: "First Triumvirate",  ids: [115, 121, 122],     flavor: "Caesar, Pompey & Crassus carved up the Republic." },
    { id: "the-caesars",    name: "The Twelve Caesars",  ids: [115, 21, 221, 182, 186, 149], flavor: "Caesar, Augustus, Tiberius, Caligula, Claudius & Nero." },
    { id: "current-war",    name: "The Current War",    ids: [33, 170],           flavor: "Edison vs Tesla — AC against DC." },
    { id: "punic-wars",     name: "The Punic Wars",     ids: [150, 153, 152],     flavor: "Hannibal & Hamilcar of Carthage against Scipio of Rome." },
    { id: "conquistadors",  name: "Conquistadors",      ids: [61, 60],            flavor: "Cortés and Pizarro toppled two empires." },
    { id: "the-reformers",  name: "The Reformation",    ids: [23, 55, 190],       flavor: "Luther, Calvin & Erasmus split Christendom." },
    { id: "the-enlightened",name: "The Philosophes",    ids: [71, 75, 47],        flavor: "Voltaire, Rousseau & Descartes — reason over dogma." },
    { id: "lords-of-nile",  name: "Lords of the Nile",  ids: [164, 166, 165, 201, 219, 199], flavor: "Pharaohs & viziers of ancient Egypt." },
    { id: "the-cosmos",     name: "The Cosmos",         ids: [18, 2, 170, 172, 194], flavor: "Newton, Einstein, Tesla, Curie & Hawking." },
    { id: "red-october",    name: "Red October",        ids: [81, 64, 223, 92],   flavor: "Lenin, Stalin, Trotsky & Gorbachev — the Soviet century." },
    { id: "genesis-block",  name: "Genesis Block",      ids: [147, 155],          flavor: "Satoshi & Vitalik — the chain this all lives on." },
    { id: "silicon-valley", name: "Silicon Valley",     ids: [111, 112, 168, 110, 109], flavor: "Jobs, Gates, Musk, Bezos & Zuckerberg." },
    { id: "east-meets-west",name: "East Meets West",    ids: [210, 27],           flavor: "Marco Polo rode to the court of the Khans." }
  ];

  // ---- category sets (the 11 categories -> named sets) ---------------------
  var CATEGORY_SETS = [
    { id: "conquerors",   name: "Conquerors & Commanders", cat: "Conqueror" },
    { id: "crown-throne", name: "Crown & Throne",          cat: "Monarch" },
    { id: "minds",        name: "Beautiful Minds",         cat: "Scientist" },
    { id: "philosophers", name: "Philosophers & Thinkers", cat: "Philosopher" },
    { id: "artists",      name: "The Immortal Artists",    cat: "Artist" },
    { id: "revolution",   name: "Revolutionary Spirits",   cat: "Revolutionary" },
    { id: "statesmen",    name: "Statesmen & Leaders",     cat: "Statesman" },
    { id: "explorers",    name: "Explorers & Navigators",  cat: "Explorer" },
    { id: "faith",        name: "Faith & Spirit",          cat: "Religious" },
    { id: "titans",       name: "Titans of Industry",      cat: "Magnate" },
    { id: "infamous",     name: "The Infamous",            cat: "Outlaw" }
  ];

  var ERA_SETS = [
    { id: "ancient-world", name: "The Ancient World",        blurb: "Before 500 CE" },
    { id: "middle-ages",   name: "The Middle Ages",          blurb: "500 – 1400" },
    { id: "renaissance",   name: "Renaissance & Reformation", blurb: "1400 – 1600" },
    { id: "enlightenment", name: "Age of Enlightenment",     blurb: "1600 – 1800" },
    { id: "modern-era",    name: "The Modern Era",           blurb: "1800 – present" }
  ];

  // ---- build the canonical SET list (each: id, name, kind, bonus, figureIds)
  // kind: "era" | "category" | "women" | "mini"
  // bonusType: "multiplier" (+0.5 per completed set on member cards) | "flat" (+points)
  var SETS = [];
  function figIdsWhere(pred) { return FIGS.filter(pred).map(function (f) { return f.humanId; }); }

  ERA_SETS.forEach(function (e) {
    SETS.push({ id: e.id, name: e.name, kind: "era", blurb: e.blurb,
      bonusType: "multiplier", bonusValue: 0.5,
      figureIds: figIdsWhere(function (f) { return f.meta.eraSet === e.id; }) });
  });
  CATEGORY_SETS.forEach(function (c) {
    SETS.push({ id: c.id, name: c.name, kind: "category", category: c.cat,
      bonusType: "multiplier", bonusValue: 0.5,
      figureIds: figIdsWhere(function (f) { return f.meta.category === c.cat; }) });
  });
  // Women of History — every female figure across all categories
  SETS.push({ id: "women", name: "Women of History", kind: "women",
    bonusType: "multiplier", bonusValue: 0.5,
    figureIds: figIdsWhere(function (f) { return f.meta.gender === "F"; }) });
  // Mini sets — flat bonus
  MINI.forEach(function (m) {
    SETS.push({ id: m.id, name: m.name, kind: "mini", flavor: m.flavor,
      bonusType: "flat", bonusValue: 200, figureIds: m.ids.slice() });
  });

  // figureId -> [setId,...] (only multiplier sets matter for the per-card mult)
  var setsByFigure = {};
  SETS.forEach(function (set) {
    set.figureIds.forEach(function (id) {
      (setsByFigure[id] = setsByFigure[id] || []).push(set.id);
    });
  });
  var setById = {};
  SETS.forEach(function (s) { setById[s.id] = s; });

  // lowest-supply figure (for the "Rarest of Rare" achievement). Ties broken by
  // humanId for determinism. Returns the single scarcest figure currently.
  function rarestFigureId() {
    var best = null;
    FIGS.forEach(function (f) {
      if (!best || f.maxSupply < best.maxSupply || (f.maxSupply === best.maxSupply && f.humanId < best.humanId)) best = f;
    });
    return best ? best.humanId : null;
  }

  window.HCX_SETS = {
    TIERS: TIERS, TIER_ORDER: TIER_ORDER,
    tierKey: tierKey, tierOf: tierOf,
    eraOf: eraOf,
    SETS: SETS, setById: setById, setsByFigure: setsByFigure,
    CATEGORY_SETS: CATEGORY_SETS, ERA_SETS: ERA_SETS, MINI: MINI,
    CLASS: CLASS,
    TOTAL: TOTAL,
    rarestFigureId: rarestFigureId,
    metaOf: function (humanId) { var f = HCX.byId(humanId); return f ? f.meta : null; }
  };
})();
