/* hcx-chain.js — real on-chain integration (ethers v5).
 *
 * Reads (public RPC):
 *   - live minted counts:  original.getHumanInfo(i) -> (name, max, mined)
 *   - mint price:          original.getCardPrice()
 *   - ownership:           scan original.getCardInfo(0..cardMined-1) -> (human,owner);
 *                          unwrapped = owner==you; wrapped = owner==WRAPPER then
 *                          wrapper.ownerOf(cardId)==you. (Verified on mainnet: the
 *                          wrapper is NOT ERC721Enumerable, and its tokenId equals
 *                          the wrapped card's original cardId.)
 * Writes (injected wallet only, never without an explicit click + confirm):
 *   - mint:                original.mineCard{value: price}
 *
 * Multicall3 (0xcA11…CA11) batches the read scans. Everything degrades to the
 * static snapshot in data.js if the RPC is unreachable. */
(function () {
  "use strict";
  var H = window.HCX, wallet = window.useWallet();

  // Read RPCs: primary first, then public fallbacks (manual failover below).
  // Rarible's node is POST-only JSON-RPC on the page path (GET returns 405 —
  // don't let that fool you); verified from browser context with CORS, block
  // reads and contract calls. llamarpc (Cloudflare challenge pages) and
  // cloudflare-eth (fabricated estimates) remain dropped.
  var RPCS = [
    "https://rarible.com/nodes/ethereum-node",
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org"
  ];
  var CHAIN_ID = 1;
  var ORIG = H.CA, WRAPPER = H.WRAPPER, MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
  var MAX_GAS = 1000000;            // hard cap for the simple wrap/approve sends so a malformed estimate can't set millions
  // mineCard() picks its card with a loop over up to humanNumber (239) humans,
  // seeded by block.timestamp — so its gas is pseudo-random PER BLOCK and the
  // estimate from one block badly mispredicts the gas the tx needs a block or
  // two later. Measured across 120 blocks at current state: ~130k–1.27M, hard
  // ceiling ~239 iterations (~1.3M). The old est×1.2 capped at 1,000,000 sat
  // below the p90 (~1.16M) → frequent out-of-gas reverts that burned the whole
  // limit (Julian's failed mint at 1.12M needed). Send a fixed, generous limit
  // instead; unused gas is refunded, so over-providing only matters on a revert
  // (which this prevents). FLOOR comfortably clears the 239-iteration worst case.
  var MINT_GAS_FLOOR = 1900000, MINT_GAS_CAP = 2500000;
  var MINTED_TTL = 60000, PRICE_TTL = 30000;

  var ABI = {
    original: [
      "function mineCard() payable returns (bool)",
      "function getCardPrice() view returns (uint256)",
      "function getHumanNumber() view returns (uint256)",
      "function getHumanInfo(uint256 i) view returns (string name, uint8 max, uint256 mined)",
      "function getCardInfo(uint256 tokenId) view returns (uint16 human, address owner)",
      "function balanceOf(address owner) view returns (uint256)",
      "function approve(address to, uint256 tokenId)",            // pre-ERC721: per-card, enables takeOwnership
      "event Mined(address indexed owner, uint16 human)"
    ],
    wrapper: [
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function wrap(uint256 cardId)",                            // pulls the card via takeOwnership, mints wHCX 1:1
      "event Wrapped(uint256 indexed cardId, address indexed account)"
    ],
    mc3: ["function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns (tuple(bool success,bytes returnData)[])"]
  };

  function ethers() { return window.ethers; }
  function ready() { return !!ethers(); }

  // StaticJsonRpcProvider with a pinned network: no per-call eth_chainId probe,
  // so a slow/unreachable endpoint can't stall reads. Manual failover (below)
  // switches to the next RPC only when the active one errors.
  var _providers = null, _readIdx = 0;
  function providers() {
    if (!_providers && ready()) {
      var E = ethers(), Ctor = E.providers.StaticJsonRpcProvider || E.providers.JsonRpcProvider;
      _providers = RPCS.map(function (url) { return new Ctor(url, CHAIN_ID); });
    }
    return _providers || [];
  }
  function readProvider() { var ps = providers(); return ps[_readIdx] || ps[0] || null; }
  // Run fn(provider) against the active RPC; on failure advance to the next and
  // retry, up to one full pass over the endpoint list.
  function withFailover(fn) {
    var ps = providers();
    if (!ps.length) return Promise.reject(new Error("no provider"));
    var tries = 0;
    function attempt() {
      var idx = (_readIdx + tries) % ps.length;
      return Promise.resolve().then(function () { return fn(ps[idx]); }).then(
        function (res) { _readIdx = idx; return res; },
        function (err) { tries++; if (tries >= ps.length) throw err; return attempt(); });
    }
    return attempt();
  }
  function origAt(p) { return new (ethers().Contract)(ORIG, ABI.original, p); }
  function mc3At(p) { return new (ethers().Contract)(MC3, ABI.mc3, p); }
  function iface(which) { return new (ethers().utils.Interface)(ABI[which]); }

  var _cardMined = null;          // total minted (sum of getHumanInfo.mined)
  var _mintedAt = 0;              // last successful refresh (ms) for TTL caching
  var _inFlight = null;           // dedupe concurrent refreshes

  // Refresh minted counts only if the cache is stale (or forced). One batched
  // Multicall3 call — never 239 separate requests. Non-blocking; the UI renders
  // from the snapshot in data.js and updates when this resolves.
  function ensureMinted(force) {
    if (!force && _mintedAt && (now() - _mintedAt) < MINTED_TTL) return Promise.resolve();
    if (_inFlight) return _inFlight;
    _inFlight = refreshMinted().then(function () { _inFlight = null; }, function () { _inFlight = null; });
    return _inFlight;
  }
  function now() { return new Date().getTime(); }

  // ---- live minted counts -------------------------------------------------
  function refreshMinted() {
    if (!ready()) return Promise.resolve();
    var oi = iface("original"), figs = H.FIGURES;
    var calls = figs.map(function (f) { return { target: ORIG, allowFailure: true, callData: oi.encodeFunctionData("getHumanInfo", [f.humanId]) }; });
    return withFailover(function (p) { return chunkedAggregate(mc3At(p), calls, 120); }).then(function (res) {
      var total = 0;
      figs.forEach(function (f, i) {
        var r = res[i]; if (!r || !r.success) { total += f.minted; return; }
        try {
          var d = oi.decodeFunctionResult("getHumanInfo", r.returnData);
          f.minted = d.mined.toNumber();
          f.maxSupply = Number(d.max) || f.maxSupply;
          total += f.minted;
        } catch (e) { total += f.minted; }
      });
      _cardMined = total;
      _mintedAt = now();
      H.recomputeStats();
      wallet.notify();
    }).catch(function () { /* keep snapshot */ });
  }

  function chunkedAggregate(mc, calls, size) {
    var out = [], i = 0;
    function step() {
      if (i >= calls.length) return Promise.resolve(out);
      return mc.aggregate3(calls.slice(i, i + size)).then(function (part) {
        out = out.concat(part); i += size; return step();
      });
    }
    return step();
  }

  // ---- ownership ----------------------------------------------------------
  // Returns the connected wallet's owned figures (unwrapped + wrapped), each a
  // figure clone carrying its real cardId. Verified algorithm; safe on errors.
  function loadOwned(addr) {
    if (!ready() || !addr) { H.OWNED = []; return Promise.resolve([]); }
    addr = addr.toLowerCase();
    wallet.set({ loadingOwned: true });
    var oi = iface("original"), wi = iface("wrapper");
    var startCardMined = _cardMined;
    var pre = startCardMined != null ? Promise.resolve() : refreshMinted();
    return pre.then(function () {
      var cardMined = _cardMined || 0;
      if (!cardMined) return [];
      var calls = [];
      for (var t = 0; t < cardMined; t++) calls.push({ target: ORIG, allowFailure: true, callData: oi.encodeFunctionData("getCardInfo", [t]) });
      return withFailover(function (p) { return chunkedAggregate(mc3At(p), calls, 200); }).then(function (res) {
        var owned = [], wrappedIds = [];
        res.forEach(function (r, t) {
          if (!r || !r.success) return;
          var d;
          try { d = oi.decodeFunctionResult("getCardInfo", r.returnData); } catch (e) { return; }
          var human = Number(d.human), owner = d.owner.toLowerCase();
          if (owner === addr) {
            var f = H.byId(human); if (f) owned.push(Object.assign({}, f, { cardId: t, owned: true }));
          } else if (owner === WRAPPER.toLowerCase()) {
            wrappedIds.push({ tokenId: t, human: human });
          }
        });
        if (!wrappedIds.length) return finalize(owned);
        // resolve wrapped tokens through the wrapper
        var wcalls = wrappedIds.map(function (w) { return { target: WRAPPER, allowFailure: true, callData: wi.encodeFunctionData("ownerOf", [w.tokenId]) }; });
        return withFailover(function (p) { return chunkedAggregate(mc3At(p), wcalls, 200); }).then(function (wres) {
          wres.forEach(function (r, i) {
            if (!r || !r.success) return;
            var o;
            try { o = wi.decodeFunctionResult("ownerOf", r.returnData)[0].toLowerCase(); } catch (e) { return; }
            if (o === addr) { var f = H.byId(wrappedIds[i].human); if (f) owned.push(Object.assign({}, f, { cardId: wrappedIds[i].tokenId, owned: true, wrapped: true })); }
          });
          return finalize(owned);
        });
      });
    }).catch(function () { return finalize([]); });
    function finalize(owned) {
      // de-dupe by cardId, scarcest first
      var seen = {}, out = [];
      owned.forEach(function (f) { if (!seen[f.cardId]) { seen[f.cardId] = 1; out.push(f); } });
      out.sort(function (a, b) { return a.maxSupply - b.maxSupply; });
      H.OWNED = out;
      wallet.set({ loadingOwned: false });
      return out;
    }
  }

  // ---- pending-mint persistence ------------------------------------------
  // Mobile in-app browsers (Coinbase Wallet especially) reload the page the
  // instant the wallet confirms — often BEFORE sendUncheckedTransaction
  // resolves, so the tx hash never reaches our JS to be saved. The fix: write a
  // "pending" record BEFORE the wallet popup (guaranteed to persist), capturing
  // the wallet address and the chain height at send time. On reload the packs
  // page reads this record and, when no hash was captured, recovers the mint by
  // scanning the contract's Mined(owner, humanId) events from that block
  // forward. If the hash DID survive (desktop / fast wallets), the faster
  // receipt path is used instead.
  var PENDING_KEY = "hcx_pending_mint";
  function savePendingMintIntent(addr, fromBlock) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({
        wallet: (addr || "").toLowerCase(),
        fromBlock: (fromBlock != null ? fromBlock : null),
        status: "pending", t: now()
      }));
    } catch (e) {}
  }
  function markPendingMintSent(hash) {
    try {
      var rec = JSON.parse(localStorage.getItem(PENDING_KEY) || "null") || {};
      rec.hash = hash; rec.status = "sent";
      localStorage.setItem(PENDING_KEY, JSON.stringify(rec));
    } catch (e) {}
  }
  function clearPendingMint() { try { localStorage.removeItem(PENDING_KEY); } catch (e) {} }
  function pendingMint() {
    try {
      var rec = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      // valid for 24h; needs either a broadcast hash (receipt path) or a wallet
      // address (event-scan path) to be actionable.
      if (rec && (rec.hash || rec.wallet) && (now() - rec.t) < 86400000) return rec;
    } catch (e) {}
    clearPendingMint();
    return null;
  }

  // Resume a previously-broadcast mint by tx hash: poll the public RPCs for the
  // receipt and resolve with the same shape as mint().
  function resumeMint(hash, cb) {
    cb = cb || {};
    function status(s, d) { if (cb.onStatus) try { cb.onStatus(s, d); } catch (e) {} }
    status("mining", { hash: hash });
    return waitForReceiptPublic({ hash: hash }, { interface: iface("original") }, status);
  }

  // Find this wallet's most recent mint by scanning Mined(owner, humanId) logs
  // from `fromBlock` forward (inclusive). owner is indexed, so the node filters
  // server-side by topic; humanId (uint16) rides in the log data. Because
  // `fromBlock` is the chain height captured immediately BEFORE broadcast, any
  // log at/after it is THIS session's mint — never a stale earlier one.
  // Resolves with { humanId, txHash, blockNumber } or null if nothing has
  // landed yet. (Event topic + parsing verified against the live contract:
  // keccak256("Mined(address,uint16)") = 0x7c1f9d0f…e3d1f894.)
  function findRecentMint(addr, fromBlock) {
    if (!ready() || !addr) return Promise.resolve(null);
    var oi = iface("original");
    var topics = oi.encodeFilterTopics("Mined", [addr]);   // [topic0, ownerTopic]
    return withFailover(function (p) {
      return p.getBlockNumber().then(function (latest) {
        var from = (fromBlock != null) ? fromBlock : (latest - 250);
        if (from < 0) from = 0;
        if (latest - from > 5000) from = latest - 5000;     // bound the scan window
        return p.getLogs({ address: ORIG, topics: topics, fromBlock: from, toBlock: "latest" });
      });
    }).then(function (logs) {
      if (!logs || !logs.length) return null;
      logs.sort(function (a, b) { return (a.blockNumber - b.blockNumber) || (a.logIndex - b.logIndex); });
      var last = logs[logs.length - 1], humanId = null;
      try { humanId = Number(oi.parseLog(last).args.human); } catch (e) { return null; }
      return { humanId: humanId, txHash: last.transactionHash, blockNumber: last.blockNumber };
    });
  }

  // Event-scan resume (the Coinbase Wallet case): no hash was captured, so look
  // up the Mined event and build the same result shape mint() returns. Resolves
  // null when nothing has landed yet (the caller polls again); clears the
  // pending record only once a mint is actually found.
  function resolveEventMint(rec, cb) {
    cb = cb || {};
    function status(s, d) { if (cb.onStatus) try { cb.onStatus(s, d); } catch (e) {} }
    if (!rec || !rec.wallet) return Promise.resolve(null);
    return findRecentMint(rec.wallet, rec.fromBlock).then(function (m) {
      if (!m) return null;
      clearPendingMint();
      var fig = (m.humanId != null) ? H.byId(m.humanId) : null;
      refreshMinted().then(function () { if (wallet.address) loadOwned(wallet.address); });
      var serial = fig ? Math.min(fig.maxSupply, fig.minted + 1) : null;
      status("confirmed", { hash: m.txHash });
      return { humanId: m.humanId, figure: fig, txHash: m.txHash, serial: serial };
    });
  }

  var _price = null, _priceAt = 0;
  function getCardPrice(force) {
    if (!ready()) return Promise.reject(new Error("ethers unavailable"));
    if (!force && _price && (now() - _priceAt) < PRICE_TTL) return Promise.resolve(_price);
    return withFailover(function (p) { return origAt(p).getCardPrice(); }).then(function (pr) { _price = pr; _priceAt = now(); return pr; });
  }

  // ---- wallet connect (any EIP-1193 injected provider) --------------------
  // Standard window.ethereum works across MetaMask, Coinbase Wallet, Rainbow,
  // Rabby, Trust, Brave, Frame and any EIP-1193 wallet. When several wallets are
  // installed they expose window.ethereum.providers[]; the default window.ethereum
  // is used (no wallet-specific code, no WalletConnect/heavy SDK).
  function injected() { return (window.ethereum) || null; }
  function isMobile() { return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test((navigator && navigator.userAgent) || ""); }
  var _web3 = null;
  function web3() {
    if (!_web3 && injected() && ready()) _web3 = new (ethers().providers.Web3Provider)(injected(), "any");
    return _web3;
  }

  function connect() {
    if (!ready()) { window.toast("Wallet library failed to load.", "error"); return Promise.resolve(); }
    if (!injected()) {
      window.toast(isMobile()
        ? "No wallet detected. Open this page in your wallet's in-app browser to connect."
        : "No wallet detected. Install an Ethereum wallet extension, then reload.", "error", 5000);
      return Promise.resolve();
    }
    if (wallet.connecting) return Promise.resolve();
    wallet.set({ connecting: true });
    var prov = web3();
    return prov.send("eth_requestAccounts", []).then(function (accts) {
      return prov.getNetwork().then(function (net) {
        var addr = ethers().utils.getAddress(accts[0]);
        wallet.set({ connected: true, address: addr, chainId: net.chainId, connecting: false });
        window.toast("Connected " + window.shortAddr(addr), "ok");
        bindInjectedEvents();
        loadOwned(addr);
        if (net.chainId !== CHAIN_ID) window.toast("Switch to Ethereum Mainnet to mint.", "error", 4200);
      });
    }).catch(function (e) {
      wallet.set({ connecting: false });
      window.toast(isUserReject(e) ? "Connection cancelled." : "Connection failed.", "error");
    });
  }

  function disconnect() {
    H.OWNED = [];
    wallet.set({ connected: false, address: null, chainId: null });
    window.toast("Wallet disconnected.");
  }

  var _bound = false;
  function bindInjectedEvents() {
    if (_bound || !injected() || !injected().on) return;
    _bound = true;
    injected().on("accountsChanged", function (accts) {
      if (!accts || !accts.length) { disconnect(); return; }
      var addr = ethers().utils.getAddress(accts[0]);
      wallet.set({ address: addr }); loadOwned(addr);
    });
    injected().on("chainChanged", function (cid) {
      wallet.set({ chainId: parseInt(cid, 16) });
    });
  }

  function ensureMainnet() {
    var eth = injected();
    if (!eth) return Promise.reject(new Error("No wallet"));
    return web3().getNetwork().then(function (net) {
      if (net.chainId === CHAIN_ID) return true;
      return eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] })
        .then(function () { wallet.set({ chainId: CHAIN_ID }); return true; });
    });
  }

  function isUserReject(e) {
    return e && (e.code === 4001 || e.code === "ACTION_REJECTED" || /user rejected|user denied|rejected the request/i.test(e.message || ""));
  }
  function mintErr(kind, message, txHash) { var e = new Error(message); e.kind = kind; e.txHash = txHash; return e; }
  function fmtEth(wei) { try { return (+ethers().utils.formatEther(wei)).toFixed(4); } catch (e) { return "?"; } }

  // ---- the bulletproof mint flow -----------------------------------------
  // cb.onStatus(state, data) is called through the lifecycle. Resolves with
  // { humanId, figure, txHash, serial } or rejects with an Error carrying .kind
  // (and .txHash when a tx was broadcast). Never broadcasts without the caller
  // having already gathered explicit user intent (the Mint button).
  // The wallet provider is used ONLY to switch chains and sign/send — every
  // read (price, balance, gas price, estimate, receipt) goes through the
  // public RPCs with failover. Some wallets' internal RPC transport fails from
  // this page (fetch-based transports surface as Safari's "Load failed"), so
  // nothing in the flow may depend on the wallet for data.
  function logStep(flow, step, e) {
    try { console.warn("[HCX " + flow + "] failed at step '" + step + "':", (e && (e.message || e.code)) || e); } catch (x) {}
  }
  function mint(cb) {
    cb = cb || {};
    function status(s, d) { if (cb.onStatus) try { cb.onStatus(s, d); } catch (e) {} }
    var E = ethers();

    if (!wallet.connected || !injected()) return Promise.reject(mintErr("not-connected", "Connect a wallet to mint on-chain."));
    var from = wallet.address;

    status("checking");
    return ensureMainnet().catch(function (e) {
      logStep("mint", "network-switch", e);
      throw mintErr("wrong-network", isUserReject(e) ? "Network switch cancelled. Mint needs Ethereum Mainnet." : "Please switch to Ethereum Mainnet to mint.");
    }).then(function () {
      return getCardPrice().catch(function (e) {
        logStep("mint", "read-price", e);
        throw mintErr("rpc", "Couldn't read the mint price (step: price read) — the public Ethereum RPCs aren't responding from your network. Nothing was sent.");
      });
    }).then(function (price) {
      var anyLeft = H.FIGURES.some(function (f) { return f.minted < f.maxSupply; });
      if (!anyLeft) throw mintErr("sold-out", "Every card is minted out. There is nothing left to mine.");
      // balance first: an underfunded wallet should read as "insufficient",
      // not "would revert" (estimateGas also fails when value > balance).
      return withFailover(function (p) { return Promise.all([p.getBalance(from), p.getGasPrice(), p.getBlockNumber()]); }).catch(function (e) {
        logStep("mint", "balance/gas read", e);
        throw mintErr("rpc", "Couldn't read your balance and the gas price (step: balance/gas) — the public RPCs aren't responding. Nothing was sent.");
      }).then(function (bg) {
        var bal = bg[0], gasPrice = bg[1], blockAtSend = bg[2];   // height captured BEFORE broadcast — the floor for the Mined-event scan
        if (bal.lt(price)) throw mintErr("insufficient", "Not enough ETH for the mint price (" + fmtEth(price) + " Ξ) plus gas.");
        return withFailover(function (p) { return origAt(p).estimateGas.mineCard({ value: price, from: from }); }).catch(function (e) {
          logStep("mint", "estimate", e);
          if (isNetworkError(e)) throw mintErr("rpc", "Couldn't simulate the mint (step: estimate) — the public RPCs aren't responding. Nothing was sent.");
          throw mintErr("would-revert", "This transaction would fail on-chain (step: estimate). The price may have changed or the last cards just minted out. Nothing was sent.");
        }).then(function (est) {
          // estimateGas above already served its real purpose: it's the
          // would-revert / sold-out / wrong-price check (mineCard throws on
          // those). Its returned VALUE, though, is the gas for one block's
          // random card pick and can't predict the tx's actual block — so size
          // the limit off a fixed floor that clears the 239-iteration worst
          // case, taking est×1.5 only when that happens to be larger (capped).
          var buffered = est.mul(150).div(100);
          var floor = E.BigNumber.from(MINT_GAS_FLOOR);
          var gasLimit = buffered.gt(floor) ? buffered : floor;
          if (gasLimit.gt(E.BigNumber.from(MINT_GAS_CAP))) gasLimit = E.BigNumber.from(MINT_GAS_CAP);
          var gasCost = gasLimit.mul(gasPrice), maxCost = price.add(gasCost);
          if (bal.lt(maxCost)) throw mintErr("insufficient", "Not enough ETH. You need about " + fmtEth(maxCost) + " Ξ (mint " + fmtEth(price) + " + gas).");
          status("confirm", { price: price, gasCost: gasCost, total: maxCost });
          // Persist the pending-mint INTENT before the wallet popup. Coinbase
          // Wallet's in-app browser frequently reloads the page the instant the
          // user confirms — before the send below resolves — so the hash may
          // never reach us. This record (wallet + block height) lets the packs
          // page recover the mint from chain events on reload.
          savePendingMintIntent(from, blockAtSend);
          // ---- the ONLY wallet interaction: sign + broadcast. ----
          // sendUncheckedTransaction, not contract.mineCard(): ethers'
          // JsonRpcSigner.sendTransaction pre-fetches eth_blockNumber through
          // the WALLET, which breaks on wallets with broken RPC transports.
          // Unchecked sends just eth_accounts + eth_sendTransaction.
          var oi = iface("original");
          return web3().getSigner().sendUncheckedTransaction({
            to: ORIG, value: price, gasLimit: gasLimit,
            data: oi.encodeFunctionData("mineCard", [])
          }).catch(function (e) {
            // Reaching this catch means nothing was broadcast (no hash returned),
            // and the page did NOT reload — so drop the intent we just saved,
            // otherwise the next load would hunt for a mint that never happened.
            clearPendingMint();
            logStep("mint", "send", e);
            if (isUserReject(e)) throw mintErr("rejected", "Transaction cancelled.");
            if (/insufficient funds/i.test(e.message || "")) throw mintErr("insufficient", "Not enough ETH for the mint plus gas.");
            throw mintErr("send-failed", "Your wallet couldn't broadcast the transaction (step: send). " + ((e && e.message) ? "(" + e.message.slice(0, 70) + ")" : "Please try again."));
          }).then(function (hash) {
            markPendingMintSent(hash);
            status("mining", { hash: hash });
            return waitForReceiptPublic({ hash: hash }, { interface: oi }, status);
          });
        });
      });
    }).catch(function (e) {
      if (e && e.kind) throw e;                                // already mapped
      if (isUserReject(e)) throw mintErr("rejected", "Transaction cancelled.");
      logStep("mint", "unmapped", e);
      if (isNetworkError(e)) throw mintErr("network", "A network request failed before anything was sent — no transaction went out. Check your connection and try again.");
      throw mintErr("unknown", "Something unexpected went wrong before sending. Nothing was broadcast. " + ((e && e.message) ? "(" + e.message.slice(0, 70) + ")" : ""));
    });
  }

  // Receipt via the PUBLIC RPCs (poll every 4s), so confirmation never depends
  // on the wallet's transport. The wallet's own tx.wait runs in parallel as a
  // bonus (it detects speed-ups/replacements); its errors are ignored.
  // Dual-path receipt wait: the wallet's tx.wait runs as best effort (it
  // detects speed-ups/replacements; its errors are ignored) while public RPC
  // polling is the dependable path. Rejects only on timeout.
  function awaitReceipt(tx, mkTimeoutErr) {
    var deadline = now() + 120000;
    return new Promise(function (resolve, reject) {
      var done = false;
      function settle(fn, v) { if (!done) { done = true; fn(v); } }
      if (tx.wait) tx.wait(1).then(function (r) { settle(resolve, r); }, function (e) {
        if (e && e.code === "TRANSACTION_REPLACED" && e.receipt && e.receipt.status === 1) settle(resolve, e.receipt);
      });
      (function poll() {
        if (done) return;
        if (now() > deadline) { settle(reject, mkTimeoutErr()); return; }
        withFailover(function (p) { return p.getTransactionReceipt(tx.hash); }).then(function (r) {
          if (r && r.blockNumber != null) settle(resolve, r);
          else setTimeout(poll, 4000);
        }, function () { setTimeout(poll, 4000); });
      })();
    });
  }

  function waitForReceiptPublic(tx, c, status) {
    return awaitReceipt(tx, function () {
      return mintErr("timeout", "Transaction is taking longer than expected. It may still confirm — check Etherscan.", tx.hash);
    }).then(function (receipt) {
      clearPendingMint();   // final receipt either way — nothing left to resume
      if (!receipt || receipt.status === 0) throw mintErr("reverted", "Mint reverted on-chain. Check the transaction on Etherscan.", tx.hash);
      var humanId = null;
      receipt.logs.forEach(function (log) {
        try { var pl = c.interface.parseLog(log); if (pl.name === "Mined") humanId = Number(pl.args.human); } catch (e) {}
      });
      if (status) status("confirmed", { hash: tx.hash });
      var fig = humanId != null ? H.byId(humanId) : null;
      refreshMinted().then(function () { if (wallet.address) loadOwned(wallet.address); });
      var serial = fig ? Math.min(fig.maxSupply, fig.minted + 1) : null;
      return { humanId: humanId, figure: fig, txHash: tx.hash, serial: serial };
    });
  }

  // Live gas price in gwei via the public RPCs (for the indicator under the
  // mint button). Pure read — the wallet is never touched.
  function getGasGwei() {
    if (!ready()) return Promise.reject(new Error("ethers unavailable"));
    return withFailover(function (p) { return p.getGasPrice(); }).then(function (wei) {
      return parseFloat(ethers().utils.formatUnits(wei, "gwei"));
    });
  }

  // WebKit reports failed fetches as the bare "Load failed"; Chromium as
  // "Failed to fetch". Map them all so raw transport errors never reach the UI.
  function isNetworkError(e) {
    var s = ((e && e.message) || "") + " " + ((e && e.code) || "");
    return /load failed|failed to fetch|networkerror|network error|timeout|econn|nonetwork|missing response|could not detect network|SERVER_ERROR|TIMEOUT/i.test(s);
  }

  // ---- the wrap flow -------------------------------------------------------
  // The 2018 contract pre-dates ERC-721: wrapping needs (1) original.approve(
  // WRAPPER, cardId) so the wrapper may call takeOwnership, then (2)
  // wrapper.wrap(cardId). The original exposes no approval getter, so approval
  // state is detected by simulating wrap() from the owner: it succeeds iff the
  // caller owns the card AND the wrapper is approved (verified on mainnet).
  // Both transactions are sent only after the caller's explicit click; each is
  // estimated, balance-checked and capped like the mint flow.

  // A revert from the simulation IS the answer (not approved) — never fail
  // over on it. Only transport errors move to the next RPC.
  // Why estimateGas and not eth_call: ethers 5.7's provider.call returns the
  // REVERT DATA ("0x") instead of throwing, and wrap() returns nothing, so
  // success and revert are indistinguishable. estimateGas throws
  // UNPREDICTABLE_GAS_LIMIT on revert. (cloudflare-eth used to fake estimates —
  // returned 21k for a reverting wrap — and has since been dropped from the
  // RPC list; even so, a wrong "approved" from a misbehaving node only leads
  // to a caught would-revert before any send.)
  function isRevertError(e) {
    if (!e) return false;
    if (e.code === "CALL_EXCEPTION" || e.code === "UNPREDICTABLE_GAS_LIMIT") return true;
    var s = ((e.message || "") + " " + (e.body || "") + " " + JSON.stringify(e.error || {})).toLowerCase();
    return s.indexOf("execution reverted") >= 0 || s.indexOf("revert") >= 0;
  }
  function simulateWrap(cardId, fromAddr, prov) {
    var w = new (ethers().Contract)(WRAPPER, ABI.wrapper, prov);
    return w.estimateGas.wrap(cardId, { from: fromAddr })
      .then(function () { return true; },
            function (e) { if (isRevertError(e)) return false; throw e; });
  }
  function checkWrapApproval(cardId) {
    if (!ready() || !wallet.address) return Promise.resolve(false);
    var ps = providers(), i = 0, from = wallet.address;
    function attempt() {
      if (i >= ps.length) return Promise.resolve(false);  // all transports down → assume unapproved (safe)
      return simulateWrap(cardId, from, ps[i]).catch(function () { i++; return attempt(); });
    }
    return attempt();
  }

  function wrapCard(cardId, cb) {
    cb = cb || {};
    function status(s, d) { if (cb.onStatus) try { cb.onStatus(s, d); } catch (e) {} }
    function wrapErr(kind, message, txHash, step) { var e = mintErr(kind, message, txHash); e.step = step; return e; }
    var E = ethers();

    if (!wallet.connected || !injected()) return Promise.reject(wrapErr("not-connected", "Connect a wallet to wrap."));

    status("checking");
    return ensureMainnet().catch(function (e) {
      throw wrapErr("wrong-network", isUserReject(e) ? "Network switch cancelled. Wrapping needs Ethereum Mainnet." : "Please switch to Ethereum Mainnet to wrap.");
    }).then(function () {
      // confirm current on-chain owner before sending anything
      return withFailover(function (p) { return origAt(p).getCardInfo(cardId); }).catch(function () {
        throw wrapErr("rpc", "Couldn't read the card's owner. Check your connection and retry.");
      });
    }).then(function (info) {
      if ((info.owner || "").toLowerCase() !== wallet.address.toLowerCase())
        throw wrapErr("not-owner", "Card #" + cardId + " isn't owned by the connected wallet — it may have just moved or already been wrapped.");
      // approval check via the public RPCs (revert-aware); the wallet provider
      // is never used for reads — some wallets' RPC transports fail from here
      return checkWrapApproval(cardId);
    }).then(function (approved) {
      var signer = web3().getSigner();
      var original = new E.Contract(ORIG, ABI.original, signer);
      var wrapper = new E.Contract(WRAPPER, ABI.wrapper, signer);

      function waitFor(tx, step, failMsg) {
        return awaitReceipt(tx, function () {
          return wrapErr("timeout", "Transaction is taking longer than expected. It may still confirm — check Etherscan.", tx.hash, step);
        }).then(function (receipt) {
          if (!receipt || receipt.status === 0) throw wrapErr("reverted", failMsg, tx.hash, step);
          return receipt;
        });
      }
      function send(contract, method, args, step, label) {
        // reads via public RPCs only; the wallet is just the signer
        return withFailover(function (p) { return Promise.all([p.getBalance(wallet.address), p.getGasPrice()]); }).catch(function (e) {
          logStep("wrap", step + ": balance/gas read", e);
          throw wrapErr("rpc", "Couldn't read your balance and the gas price (step: balance/gas) — the public RPCs aren't responding. Nothing was sent.", null, step);
        }).then(function (bg) {
          var bal = bg[0], gasPrice = bg[1];
          return withFailover(function (p) {
            return contract.connect(p).estimateGas[method].apply(null, args.concat([{ from: wallet.address }]));
          }).catch(function (e) {
            logStep("wrap", step + ": estimate", e);
            if (isNetworkError(e)) throw wrapErr("rpc", "Couldn't simulate the " + label + " (step: estimate) — the public RPCs aren't responding. Nothing was sent.", null, step);
            throw wrapErr("would-revert", step === "approve"
              ? "The approval would fail on-chain — the card may have just moved."
              : "Wrapping would fail on-chain. If you just approved, give it a few seconds and retry.", null, step);
          }).then(function (est) {
            var gasLimit = est.mul(120).div(100);
            if (gasLimit.gt(E.BigNumber.from(MAX_GAS))) gasLimit = E.BigNumber.from(MAX_GAS);
            var gasCost = gasLimit.mul(gasPrice);
            if (bal.lt(gasCost)) throw wrapErr("insufficient", "Not enough ETH for gas (about " + fmtEth(gasCost) + " Ξ for the " + label + ").", null, step);
            status("confirm-" + step, { gasCost: gasCost });
            // unchecked send: only eth_accounts + eth_sendTransaction touch
            // the wallet (see the mint flow note about broken wallet RPCs)
            return web3().getSigner().sendUncheckedTransaction({
              to: contract.address, gasLimit: gasLimit,
              data: contract.interface.encodeFunctionData(method, args)
            }).then(function (hash) { return { hash: hash }; });
          }).catch(function (e) {
            if (e.kind) throw e;
            if (isUserReject(e)) throw wrapErr("rejected", (step === "approve" ? "Approval" : "Wrap") + " cancelled.", null, step);
            if (/insufficient funds/i.test(e.message || "")) throw wrapErr("insufficient", "Not enough ETH for gas.", null, step);
            logStep("wrap", step + ": send", e);
            throw wrapErr("send-failed", "Your wallet couldn't broadcast the " + label + " (step: send). " + ((e && e.message) ? "(" + e.message.slice(0, 70) + ")" : "Please try again."), null, step);
          });
        });
      }

      var approveStep = approved ? Promise.resolve(null)
        : send(original, "approve", [WRAPPER, cardId], "approve", "approval")
            .then(function (tx) { status("approving", { hash: tx.hash });
              return waitFor(tx, "approve", "The approval failed on-chain."); })
            .then(function (r) { status("approved", { hash: r.transactionHash }); return r; });

      return approveStep.then(function () {
        return send(wrapper, "wrap", [cardId], "wrap", "wrap transaction")
          .then(function (tx) { status("wrapping", { hash: tx.hash });
            return waitFor(tx, "wrap", "The wrap failed on-chain — the card may have moved."); })
          .then(function (receipt) {
            status("wrapped", { hash: receipt.transactionHash });
            if (wallet.address) loadOwned(wallet.address);   // refresh; re-renders via wallet.notify
            return { txHash: receipt.transactionHash, cardId: cardId };
          });
      });
    });
  }

  // ---- init: eager reconnect only (no popup). Minted counts are loaded
  // lazily via ensureMinted() once the UI has painted — not eagerly on load. ---
  function init() {
    var eth = injected();
    if (eth && ready()) {
      try {
        eth.request({ method: "eth_accounts" }).then(function (accts) {
          if (accts && accts.length) {
            web3().getNetwork().then(function (net) {
              var addr = ethers().utils.getAddress(accts[0]);
              wallet.set({ connected: true, address: addr, chainId: net.chainId });
              bindInjectedEvents();
              loadOwned(addr);
            });
          }
        }).catch(function () {});
      } catch (e) {}
    }
  }

  window.HCX_CHAIN = {
    connect: connect, disconnect: disconnect, ensureMainnet: ensureMainnet,
    mintedLive: function () { return _mintedAt > 0; },       // true once live counts have been read
    getCardPrice: getCardPrice, refreshMinted: refreshMinted, ensureMinted: ensureMinted, loadOwned: loadOwned,
    mint: mint, wrapCard: wrapCard, checkWrapApproval: checkWrapApproval,
    pendingMint: pendingMint, resumeMint: resumeMint, clearPendingMint: clearPendingMint,
    findRecentMint: findRecentMint, resolveEventMint: resolveEventMint,
    getGasGwei: getGasGwei,
    isUserReject: isUserReject, fmtEth: fmtEth, init: init,
    etherscanTx: function (h) { return "https://etherscan.io/tx/" + h; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
