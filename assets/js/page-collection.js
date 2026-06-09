/* My Collection. Two sections: on-chain holdings read from the wrapper, and
 * practice pulls stored locally by the pack game. */
(function () {
  "use strict";
  var HC = window.HC, el = HC.el;
  HC.mountNav("collection.html");

  var ownedGrid = document.getElementById("owned-grid");
  var ownedEmpty = document.getElementById("owned-empty");
  var pullGrid = document.getElementById("pull-grid");
  var pullEmpty = document.getElementById("pull-empty");

  function renderOwned() {
    var s = HC.wallet.state;
    ownedGrid.innerHTML = "";
    ownedEmpty.innerHTML = "";
    if (!HC.wallet.isConnected()) {
      document.getElementById("owned-status").textContent = "Wallet not connected";
      document.getElementById("owned-count").textContent = "";
      var cta = el("div", { class: "empty" }, [
        el("div", { style: "margin-bottom:14px", text: "Connect a wallet to see the HumanityCards it holds." }),
        el("button", { class: "btn btn-primary", text: "Connect Wallet", onclick: function () { HC.wallet.connect(); } })
      ]);
      ownedEmpty.appendChild(cta);
      return;
    }
    var owned = HC.ownedHumans();
    var bal = s.ownedBalance != null ? s.ownedBalance : owned.length;
    document.getElementById("owned-status").textContent = HC.wallet.short(s.address);
    document.getElementById("owned-count").textContent = "· " + bal + " held";
    if (!owned.length) {
      ownedEmpty.appendChild(el("div", { class: "empty" }, [
        bal ? "Reading your " + bal + " card" + (bal > 1 ? "s" : "") + "…"
            : "This wallet holds no HumanityCards yet. Mint one on the Packs page."
      ]));
      return;
    }
    owned.forEach(function (h) { ownedGrid.appendChild(HC.card.mini(h, { owned: true })); });
  }

  function renderPulls() {
    var coll = HC.load("pk:coll", []);
    pullGrid.innerHTML = "";
    pullEmpty.innerHTML = "";
    document.getElementById("pull-count").textContent = coll.length ? "· " + coll.length + " pulled" : "";
    if (!coll.length) {
      pullEmpty.appendChild(el("div", { class: "empty" }, [
        el("div", { style: "margin-bottom:14px", text: "No pulls yet. Open a pack to start your collection." }),
        el("a", { class: "btn btn-primary", href: "packs.html", text: "Open a pack" })
      ]));
      return;
    }
    var counts = {}; coll.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts)
      .sort(function (a, b) { return HC.byId[b].tierRank - HC.byId[a].tierRank || HC.byId[a].max - HC.byId[b].max; })
      .forEach(function (id) {
        pullGrid.appendChild(HC.card.mini(HC.byId[id], { count: counts[id] }));
      });
  }

  HC.wallet.onChange(function () { renderOwned(); });
  renderPulls();
})();
