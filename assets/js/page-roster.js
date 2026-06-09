/* Roster browser. All 239 figures as mini cards, filterable by rarity tier and
 * name, sortable. Owned cards (when a wallet is connected) get a badge. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("roster.html");

  var grid = document.getElementById("roster-grid");
  var noResults = document.getElementById("no-results");
  var searchEl = document.getElementById("search");

  var tierFilter = "all";   // tier key or "all"
  var sortMode = "rarity";
  var query = "";

  // Tier chips: All + each tier (rarest first), with counts.
  var tiers = HC.TIERS.slice().sort(function (a, b) { return b.rank - a.rank; });
  var tierChips = document.getElementById("tier-chips");
  function countTier(key) { return HC.ROSTER.filter(function (h) { return h.tier === key; }).length; }
  function addChip(host, label, active, onClick) {
    var b = el("button", { class: "chip-btn" + (active ? " active" : ""), text: label });
    b.addEventListener("click", onClick);
    host.appendChild(b);
    return b;
  }
  function buildTierChips() {
    tierChips.innerHTML = "";
    addChip(tierChips, "All " + HC.ROSTER.length, tierFilter === "all", function () { tierFilter = "all"; buildTierChips(); render(); });
    tiers.forEach(function (t) {
      addChip(tierChips, t.label + " " + countTier(t.key), tierFilter === t.key, function () { tierFilter = t.key; buildTierChips(); render(); });
    });
  }

  var SORTS = [
    ["rarity", "Rarity", function (a, b) { return a.max - b.max || a.name.localeCompare(b.name); }],
    ["era", "Oldest", function (a, b) { return a.born - b.born; }],
    ["influence", "Influence", function (a, b) { return b.inf - a.inf; }],
    ["name", "A–Z", function (a, b) { return a.name.localeCompare(b.name); }],
    ["minted", "Most mined", function (a, b) { return b.mined - a.mined; }]
  ];
  var sortChips = document.getElementById("sort-chips");
  function buildSortChips() {
    sortChips.innerHTML = "";
    sortChips.appendChild(el("span", { class: "mono mute", style: "font-size:11px;align-self:center", text: "Sort:" }));
    SORTS.forEach(function (s) {
      addChip(sortChips, s[1], sortMode === s[0], function () { sortMode = s[0]; buildSortChips(); render(); });
    });
  }

  function render() {
    var sorter = SORTS.filter(function (s) { return s[0] === sortMode; })[0][2];
    var list = HC.ROSTER.filter(function (h) {
      if (tierFilter !== "all" && h.tier !== tierFilter) return false;
      if (query && h.name.toLowerCase().indexOf(query) === -1) return false;
      return true;
    }).sort(sorter);

    grid.innerHTML = "";
    list.forEach(function (h) {
      grid.appendChild(HC.card.mini(h, { owned: HC.wallet.ownsHuman(h.id) }));
    });
    noResults.style.display = list.length ? "none" : "block";
    document.getElementById("result-count").textContent =
      list.length + " of " + HC.ROSTER.length + " figures";
  }

  searchEl.addEventListener("input", function () { query = searchEl.value.trim().toLowerCase(); render(); });
  HC.wallet.onChange(function () { render(); });

  buildTierChips();
  buildSortChips();
  render();
})();
