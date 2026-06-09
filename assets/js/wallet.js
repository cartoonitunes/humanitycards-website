/* Wallet + chain layer (ethers v5). Read-only by default. The only state
 * changing call is mineCard(), and it is NEVER sent without the user clicking
 * through an explicit confirmation in the UI. */
(function () {
  "use strict";
  var HC = window.HC, CFG = window.HC_CONFIG;

  var state = {
    address: null,
    provider: null,        // injected (MetaMask) provider when connected
    readProvider: null,    // public RPC, always available
    owned: null,           // array of humanIds the connected wallet holds (via wrapper)
    listeners: []
  };

  function emit() { state.listeners.forEach(function (f) { try { f(state); } catch (e) {} }); }
  function onChange(fn) { state.listeners.push(fn); fn(state); }

  function ethers() { return window.ethers; }

  function readProvider() {
    if (!state.readProvider && ethers()) {
      state.readProvider = new (ethers().providers.JsonRpcProvider)(CFG.rpc, CFG.chainId);
    }
    return state.readProvider;
  }

  function short(addr) { return addr.slice(0, 6) + "…" + addr.slice(-4); }

  async function connect() {
    if (!ethers()) { HC.toast("ethers.js failed to load"); return; }
    if (!window.ethereum) {
      HC.toast("No browser wallet found. Install MetaMask to connect.");
      return;
    }
    try {
      var prov = new (ethers().providers.Web3Provider)(window.ethereum, "any");
      await prov.send("eth_requestAccounts", []);
      var signer = prov.getSigner();
      state.address = await signer.getAddress();
      state.provider = prov;
      HC.toast("Connected " + short(state.address));
      emit();
      refreshOwnership();
      window.ethereum.removeAllListeners && window.ethereum.removeAllListeners("accountsChanged");
      window.ethereum.on && window.ethereum.on("accountsChanged", function (a) {
        if (!a || !a.length) { disconnect(); }
        else { state.address = ethers().utils.getAddress(a[0]); state.owned = null; emit(); refreshOwnership(); }
      });
    } catch (e) {
      HC.toast(e && e.code === 4001 ? "Connection rejected" : "Connection failed");
    }
  }

  function disconnect() {
    state.address = null; state.provider = null; state.owned = null;
    HC.toast("Wallet disconnected");
    emit();
  }

  // Read which humans the connected wallet owns, via the ERC-721 wrapper.
  // Maps owned wrapper tokenIds -> humanId by matching against the original
  // contract's card->human mapping is non-trivial pre-standard, so for the stub
  // we surface the raw owned balance and, when possible, humanIds the wrapper
  // exposes. Falls back gracefully to "balance only" on any read error.
  async function refreshOwnership() {
    if (!state.address || !ethers()) return;
    var prov = readProvider();
    if (!prov) return;
    try {
      var wrap = new (ethers().Contract)(CFG.contracts.wrapper, CFG.abi.wrapper, prov);
      var bal = (await wrap.balanceOf(state.address)).toNumber();
      var ids = [];
      // tokenOfOwnerByIndex is enumerable on most wrappers; tolerate absence.
      for (var i = 0; i < bal && i < 50; i++) {
        try {
          var tid = await wrap.tokenOfOwnerByIndex(state.address, i);
          ids.push(tid.toNumber());
        } catch (e) { break; }
      }
      state.ownedBalance = bal;
      state.ownedTokenIds = ids;
      // For gameplay we expose the set of humanIds the player can "field". Pre-
      // standard mapping is ambiguous, so we treat owned tokenIds modulo the
      // roster as a stable, deterministic stand-in until the real index lands.
      state.owned = ids.length
        ? ids.map(function (t) { return HC.ROSTER[t % HC.ROSTER.length].id; })
        : [];
      emit();
    } catch (e) {
      state.owned = [];
      emit();
    }
  }

  async function getCardPrice() {
    var prov = readProvider();
    if (!prov || !ethers()) return null;
    try {
      var c = new (ethers().Contract)(CFG.contracts.original, CFG.abi.original, prov);
      return await c.getCardPrice();
    } catch (e) { return null; }
  }

  // Send a real mineCard() transaction. Caller MUST have shown an explicit
  // confirmation. Returns the parsed Mined human, or throws.
  async function mineCard(priceWei) {
    if (!state.provider) throw new Error("Connect a wallet first");
    var signer = state.provider.getSigner();
    var c = new (ethers().Contract)(CFG.contracts.original, CFG.abi.original, signer);
    var tx = await c.mineCard({ value: priceWei });
    var rcpt = await tx.wait();
    // Decode the Mined event to learn which human was drawn.
    var humanId = null;
    rcpt.logs.forEach(function (log) {
      try {
        var parsed = c.interface.parseLog(log);
        if (parsed.name === "Mined") humanId = Number(parsed.args.humanId);
      } catch (e) {}
    });
    return { txHash: tx.hash, human: humanId != null ? HC.byId[humanId] : null };
  }

  HC.wallet = {
    state: state, onChange: onChange, connect: connect, disconnect: disconnect,
    refreshOwnership: refreshOwnership, getCardPrice: getCardPrice,
    mineCard: mineCard, short: short,
    isConnected: function () { return !!state.address; },
    ownsHuman: function (id) { return state.owned ? state.owned.indexOf(id) !== -1 : false; }
  };

  // Wire the shared nav button once the DOM is ready.
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("hc-wallet-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (state.address) disconnect(); else connect();
    });
    onChange(function (s) {
      if (s.address) {
        btn.textContent = HC.wallet.short(s.address);
        btn.classList.add("connected");
      } else {
        btn.textContent = "Connect Wallet";
        btn.classList.remove("connected");
      }
    });
  });
})();
