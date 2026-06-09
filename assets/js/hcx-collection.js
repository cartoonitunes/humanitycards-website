/* hcx-collection.js — vanilla port of collection.jsx. My Collection (wallet
 * states) + Roster (search/filter/sort/paginate) + detail modal. */
(function () {
  "use strict";
  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      BG = window.BG, PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;

  function PlayingWith(gameMode) {
    var w = window.useWallet();
    return h("div", { style: { display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 14px",
      borderRadius: "30px", border: "1px solid " + RULE, background: PANEL,
      font: "600 11px/1 " + MONO, letterSpacing: ".12em", textTransform: "uppercase", color: DIM } },
      h("span", { style: { width: "7px", height: "7px", borderRadius: "50%",
        background: w.connected ? "#5fae6e" : "#7a7468", boxShadow: w.connected ? "0 0 8px #5fae6e" : "none" } }),
      w.connected ? "Playing with your collection" : (gameMode ? "Playing with random cards" : "Wallet not connected"));
  }

  // ---- detail modal (mounted on body) ----
  function openDetail(f) {
    if (!f) return;
    var accent = window.rarityAccent(f), H = window.HCX;
    var stats = [["Influence", f.stats.influence], ["Intellect", f.stats.intellect], ["Dominion", f.stats.dominion], ["Legacy", f.stats.legacy]];
    var overlay;
    function close() { if (overlay) overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay = h("div", { onClick: close, style: { position: "fixed", inset: 0, zIndex: 120, background: "rgba(6,6,9,.82)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "fadeUp .22s ease" } },
      h("div", { onClick: function (e) { e.stopPropagation(); }, className: "detail-modal",
        style: { display: "grid", gridTemplateColumns: "300px 1fr", gap: "30px", maxWidth: "760px", width: "100%",
          background: PANEL, border: "1px solid " + RULE, borderRadius: "12px", padding: "28px", boxShadow: "0 40px 100px -30px #000" } },
        h("div", null, window.Card({ figure: f, glow: true })),
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
            window.Kicker({ color: accent }, window.scarcityLabel(f)),
            h("button", { onClick: close, style: { background: "none", border: "none", color: DIM, cursor: "pointer", font: "400 22px/1 " + MONO } }, "×")),
          h("h2", { style: { margin: "12px 0 4px", font: "700 30px/1.05 " + MONO, color: INK } }, f.name),
          h("div", { style: { font: "400 13px/1 " + SANS, color: DIM, marginBottom: f.bio ? "14px" : "20px" } },
            (f.role ? f.role + " · " : "") + "Born " + H.eraLabel(f.born) + " · Human No. " + f.humanId),
          f.bio ? h("p", { style: { margin: "0 0 20px", font: "400 13.5px/1.62 " + SANS, color: "#c3bdae" } }, f.bio) : null,
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 22px", marginBottom: "20px" } },
            stats.map(function (st) {
              return h("div", null,
                h("div", { style: { display: "flex", justifyContent: "space-between", font: "600 10.5px/1 " + MONO, letterSpacing: ".1em", color: DIM, marginBottom: "6px" } },
                  h("span", null, st[0].toUpperCase()), h("span", { style: { color: INK } }, String(st[1]))),
                h("div", { style: { height: "4px", borderRadius: "2px", background: "#ffffff10", overflow: "hidden" } },
                  h("div", { style: { width: st[1] + "%", height: "100%", background: "linear-gradient(90deg," + COPPER + "," + accent + ")" } })));
            })),
          window.DottedRule({ style: { margin: "4px 0 16px" } }),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
            miniStat("Card Number", f.cardId), miniStat("Max Supply", f.maxSupply, accent),
            miniStat("Minted", f.minted + " / " + f.maxSupply), miniStat("Edition", f.minted >= f.maxSupply ? "Minted out" : "Open")),
          h("div", { style: { marginTop: "20px", font: "400 10.5px/1.5 " + MONO, color: FAINT, wordBreak: "break-all" } }, f.contract + " · " + f.deployed))));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }
  function miniStat(label, value, accent) {
    return h("div", null,
      h("div", { style: { font: "600 9.5px/1 " + MONO, letterSpacing: ".14em", color: DIM, marginBottom: "6px" } }, label.toUpperCase()),
      h("div", { style: { font: "600 15px/1 " + MONO, color: accent || INK } }, String(value)));
  }

  function FilterBar(props) {
    return h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
      props.options.map(function (o) {
        var active = props.value === o.id;
        return h("button", { onClick: function () { props.onChange(o.id); },
          style: { font: "600 11px/1 " + MONO, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer",
            padding: "8px 13px", borderRadius: "30px", border: "1px solid " + (active ? COPPER : RULE),
            background: active ? COPPER + "1a" : "transparent", color: active ? INK : DIM, transition: "all .18s" } }, o.label);
      }));
  }

  function sortFigs(figs, mode) {
    var a = figs.slice();
    if (mode === "scarce") a.sort(function (x, y) { return x.maxSupply - y.maxSupply; });
    else if (mode === "name") a.sort(function (x, y) { return x.name.localeCompare(y.name); });
    else if (mode === "era") a.sort(function (x, y) { return x.born - y.born; });
    else if (mode === "human") a.sort(function (x, y) { return x.humanId - y.humanId; });
    return a;
  }

  // ---- My Collection ----
  function CollectionPage() {
    var w = window.useWallet();
    var sort = "scarce";
    var owned = window.HCX.OWNED;
    var host = h("div", null);
    function render() {
      host.innerHTML = "";
      var body;
      if (!w.connected) body = CollectionEmpty(w.toggle);
      else {
        var figs = sortFigs(owned, sort);
        body = h("div", { style: { marginTop: "28px" } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "24px" } },
            h("div", { style: { font: "400 13px/1 " + SANS, color: DIM } }, owned.length + " cards · " + owned.filter(function (f) { return f.maxSupply <= 3; }).length + " scarce"),
            FilterBar({ value: sort, onChange: function (v) { sort = v; render(); }, options: [
              { id: "scarce", label: "Scarcest" }, { id: "name", label: "A–Z" }, { id: "era", label: "Oldest" }] })),
          window.CardGrid({ figures: figs, hoverInfo: true, onSelect: openDetail }));
      }
      host.appendChild(window.Section({ style: { paddingTop: "40px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" } },
          h("div", null,
            window.Kicker(null, "My Collection"),
            h("h1", { style: { margin: "14px 0 0", font: "700 clamp(34px,5vw,52px)/1 " + MONO, color: INK } }, w.connected ? "Your cards" : "Your collection")),
          w.connected ? PlayingWith() : null),
        body));
    }
    render();
    return host;
  }

  function CollectionEmpty(onConnect) {
    var preview = [window.HCX.byName("Napoleon"), window.HCX.byName("Einstein"), window.HCX.byName("Cleopatra"), window.HCX.byName("Nikola Tesla")];
    return h("div", { style: { position: "relative", marginTop: "30px", borderRadius: "12px", overflow: "hidden", border: "1px solid " + RULE } },
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "26px", padding: "44px", filter: "blur(3px) saturate(.7)", opacity: 0.5, pointerEvents: "none" } },
        preview.map(function (f) { return window.Card({ figure: f }); })),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px",
        background: "radial-gradient(60% 80% at 50% 50%, rgba(11,11,14,.5), rgba(11,11,14,.92))" } },
        window.Kicker(null, "No wallet connected"),
        h("h2", { style: { margin: "16px 0 10px", font: "700 clamp(24px,4vw,34px)/1.1 " + MONO, color: INK, maxWidth: "16ch" } }, "Connect to see your collection"),
        h("p", { style: { margin: "0 0 24px", maxWidth: "380px", font: "400 14px/1.6 " + SANS, color: DIM } }, "Your owned cards are read straight from the blockchain. This is a preview of how they'll sit."),
        window.Btn({ onClick: onConnect }, "Connect Wallet")));
  }

  // ---- Roster ----
  var ROSTER_PAGE = 48;
  function RosterPage() {
    var H = window.HCX, all = H.FIGURES;
    var filter = "all", sort = "human", limit = ROSTER_PAGE, query = "";
    var mintedOut = all.filter(function (f) { return f.minted >= f.maxSupply; }).length;
    var scarceCount = all.filter(function (f) { return f.maxSupply <= 7; }).length;

    var input = h("input", { value: "", placeholder: "Search 239 humans…",
      onInput: function (e) { query = e.target.value; limit = ROSTER_PAGE; update(); },
      style: { width: "100%", boxSizing: "border-box", background: PANEL, border: "1px solid " + RULE, borderRadius: "30px",
        padding: "11px 16px 11px 32px", font: "400 13px/1 " + SANS, color: INK, outline: "none" },
      onFocus: function (e) { e.target.style.borderColor = COPPER; }, onBlur: function (e) { e.target.style.borderColor = RULE; } });
    var clearBtn = h("button", { onClick: function () { query = ""; input.value = ""; limit = ROSTER_PAGE; update(); input.focus(); }, "aria-label": "Clear",
      style: { position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: DIM, cursor: "pointer", font: "400 16px/1 " + MONO, display: "none" } }, "×");
    var searchBox = h("div", { style: { position: "relative", flex: "1 1 240px", maxWidth: "320px" } },
      h("span", { style: { position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", font: "400 13px/1 " + MONO, color: FAINT } }, "⌕"),
      input, clearBtn);

    var filterBarWrap = h("div", null);
    var sortBarWrap = h("div", null);
    var countWrap = h("div", { style: { font: "400 12.5px/1 " + SANS, color: DIM } });
    var results = h("div", null);

    function update() {
      clearBtn.style.display = query ? "block" : "none";
      var q = query.trim().toLowerCase();
      var figs = all.filter(function (f) {
        if (q && f.name.toLowerCase().indexOf(q) < 0 && (!f.role || f.role.toLowerCase().indexOf(q) < 0)) return false;
        if (filter === "scarce") return f.maxSupply <= 7;
        if (filter === "mintedout") return f.minted >= f.maxSupply;
        if (filter === "open") return f.minted < f.maxSupply;
        return true;
      });
      figs = sortFigs(figs, sort);
      var totalMatched = figs.length;
      var shown = figs.slice(0, limit);

      filterBarWrap.innerHTML = ""; filterBarWrap.appendChild(FilterBar({ value: filter, onChange: function (v) { filter = v; limit = ROSTER_PAGE; update(); }, options: [
        { id: "all", label: "All" }, { id: "scarce", label: "Scarce ≤7" }, { id: "open", label: "Open" }, { id: "mintedout", label: "Minted Out" }] }));
      sortBarWrap.innerHTML = ""; sortBarWrap.appendChild(FilterBar({ value: sort, onChange: function (v) { sort = v; limit = ROSTER_PAGE; update(); }, options: [
        { id: "human", label: "By Number" }, { id: "era", label: "By Era" }, { id: "scarce", label: "By Scarcity" }, { id: "name", label: "A–Z" }] }));
      countWrap.textContent = totalMatched + (q ? " match" + (totalMatched === 1 ? "" : "es") : " humans");

      results.innerHTML = "";
      if (totalMatched === 0) {
        results.appendChild(h("div", { style: { padding: "70px 20px", textAlign: "center", border: "1px dashed " + RULE, borderRadius: "10px" } },
          h("div", { style: { font: "700 18px/1 " + MONO, color: INK, marginBottom: "8px" } }, "No humans found"),
          h("div", { style: { font: "400 13px/1.5 " + SANS, color: DIM } }, "Nothing matches “" + query + "”. Try another name or clear the search.")));
      } else {
        results.appendChild(window.CardGrid({ figures: shown, min: 168, gap: "22px", hoverInfo: true, onSelect: openDetail }));
        if (limit < totalMatched) {
          results.appendChild(h("div", { style: { textAlign: "center", marginTop: "40px" } },
            window.Btn({ variant: "ghost", onClick: function () { limit += ROSTER_PAGE; update(); } }, "Show more · " + (totalMatched - limit) + " remaining")));
        }
      }
    }

    var page = h("div", null,
      window.Section({ style: { paddingTop: "40px" } },
        window.Kicker(null, "Roster"),
        h("h1", { style: { margin: "14px 0 6px", font: "700 clamp(34px,5vw,52px)/1 " + MONO, color: INK } }, "The catalogue"),
        h("p", { style: { margin: "0 0 26px", font: "400 14px/1.6 " + SANS, color: DIM, maxWidth: "560px" } },
          all.length + " humans minted into cards · " + scarceCount + " scarce (1-of-7 or rarer) · " + mintedOut + " editions minted out."),
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "18px" } },
          searchBox, filterBarWrap),
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "26px" } },
          countWrap, sortBarWrap),
        results));
    update();
    return page;
  }

  Object.assign(window, { CollectionPage: CollectionPage, RosterPage: RosterPage, openDetail: openDetail, PlayingWith: PlayingWith, FilterBar: FilterBar, sortFigs: sortFigs });
})();
