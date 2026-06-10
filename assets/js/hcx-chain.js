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

  // Read RPCs: primary first, then public fallbacks (failover via FallbackProvider).
  var RPCS = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com"
  ];
  var CHAIN_ID = 1;
  var ORIG = H.CA, WRAPPER = H.WRAPPER, MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
  var MAX_GAS = 1000000;            // hard cap so a malformed estimate can't set millions
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
  function mint(cb) {
    cb = cb || {};
    function status(s, d) { if (cb.onStatus) try { cb.onStatus(s, d); } catch (e) {} }
    var E = ethers();

    if (!wallet.connected || !injected()) return Promise.reject(mintErr("not-connected", "Connect a wallet to mint on-chain."));

    status("checking");
    return ensureMainnet().catch(function (e) {
      throw mintErr("wrong-network", isUserReject(e) ? "Network switch cancelled. Mint needs Ethereum Mainnet." : "Please switch to Ethereum Mainnet to mint.");
    }).then(function () {
      // public read RPCs first; if they're all down, fall back to reading the
      // price through the user's own wallet connection
      return getCardPrice().catch(function () {
        return origAt(web3()).getCardPrice().then(function (p) { _price = p; _priceAt = now(); return p; });
      }).catch(function () { throw mintErr("rpc", "Couldn't read the mint price — the Ethereum RPCs aren't responding from your network. Nothing was sent. Check your connection and retry."); });
    }).then(function (price) {
      var anyLeft = H.FIGURES.some(function (f) { return f.minted < f.maxSupply; });
      if (!anyLeft) throw mintErr("sold-out", "Every card is minted out. There is nothing left to mine.");
      var signer = web3().getSigner();
      return signer.getAddress().catch(function () {
        throw mintErr("wallet-rpc", "Couldn't read your wallet's account. Re-connect the wallet and try again. Nothing was sent.");
      }).then(function (from) {
        var c = new E.Contract(ORIG, ABI.original, signer);
        // balance first: an underfunded wallet should read as "insufficient",
        // not "would revert" (estimateGas also fails when value > balance).
        return Promise.all([web3().getBalance(from), web3().getGasPrice()]).catch(function () {
          throw mintErr("wallet-rpc", "Couldn't reach Ethereum through your wallet's connection. Nothing was sent — check your network and try again.");
        }).then(function (bg) {
          var bal = bg[0], gasPrice = bg[1];
          if (bal.lt(price)) throw mintErr("insufficient", "Not enough ETH for the mint price (" + fmtEth(price) + " Ξ) plus gas.");
          return c.estimateGas.mineCard({ value: price }).catch(function () {
            throw mintErr("would-revert", "This transaction would fail on-chain. The price may have changed or the last cards just minted out.");
          }).then(function (est) {
            var gasLimit = est.mul(120).div(100);                 // +20% buffer
            if (gasLimit.gt(E.BigNumber.from(MAX_GAS))) gasLimit = E.BigNumber.from(MAX_GAS); // cap
            var gasCost = gasLimit.mul(gasPrice), maxCost = price.add(gasCost);
            if (bal.lt(maxCost)) throw mintErr("insufficient", "Not enough ETH. You need about " + fmtEth(maxCost) + " Ξ (mint " + fmtEth(price) + " + gas).");
            status("confirm", { price: price, gasCost: gasCost, total: maxCost });
          return c.mineCard({ value: price, gasLimit: gasLimit }).then(function (tx) {
            status("mining", { hash: tx.hash });
            // race the receipt against a timeout so a stuck tx surfaces clearly
            var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(mintErr("timeout", "Transaction is taking longer than expected.", tx.hash)); }, 120000); });
            var waitRcpt = tx.wait(1).catch(function (e) {
              if (e && e.code === "TRANSACTION_REPLACED") { if (e.receipt && e.receipt.status === 1) return e.receipt; throw mintErr("reverted", "The transaction was replaced or dropped.", tx.hash); }
              throw mintErr("tx-failed", "Mint failed on-chain. Someone may have taken the last card of that type.", tx.hash);
            });
            return Promise.race([waitRcpt, timeout]).then(function (receipt) {
              if (!receipt || receipt.status === 0) throw mintErr("reverted", "Mint reverted on-chain. Check the transaction on Etherscan.", tx.hash);
              var humanId = null;
              receipt.logs.forEach(function (log) {
                try { var pl = c.interface.parseLog(log); if (pl.name === "Mined") humanId = Number(pl.args.human); } catch (e) {}
              });
              status("confirmed", { hash: tx.hash });
              var fig = humanId != null ? H.byId(humanId) : null;
              // refresh live state in the background (don't block the reveal)
              refreshMinted().then(function () { if (wallet.address) loadOwned(wallet.address); });
              var serial = fig ? Math.min(fig.maxSupply, fig.minted + 1) : null;
              return { humanId: humanId, figure: fig, txHash: tx.hash, serial: serial };
            });
          }).catch(function (e) {
            if (e.kind) throw e;                                   // already mapped
            if (isUserReject(e)) throw mintErr("rejected", "Transaction cancelled.");
            if (/insufficient funds/i.test(e.message || "")) throw mintErr("insufficient", "Not enough ETH for the mint plus gas.");
            throw mintErr("send-failed", "Couldn't send the transaction. " + ((e && e.message) ? e.message.slice(0, 80) : "Please try again."));
          });
          });     // close estimateGas().then(est)
        });
      });
    }).catch(function (e) {
      if (e && e.kind) throw e;                                // already mapped
      if (isUserReject(e)) throw mintErr("rejected", "Transaction cancelled.");
      // never surface a raw fetch error ("Load failed", "Failed to fetch")
      if (isNetworkError(e)) throw mintErr("network", "A network request failed before anything was sent — no transaction went out. Check your connection (or your wallet's RPC) and try again.");
      throw mintErr("unknown", "Something unexpected went wrong before sending. Nothing was broadcast. " + ((e && e.message) ? "(" + e.message.slice(0, 70) + ")" : ""));
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
  // UNPREDICTABLE_GAS_LIMIT on revert. Caveat: cloudflare-eth fakes estimates
  // (returned 21k for a reverting wrap), so it sits last in the RPC order and
  // a wrong "approved" only leads to a caught would-revert before any send.
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
      // authoritative approval check through the user's own wallet provider
      return simulateWrap(cardId, wallet.address, web3()).catch(function () { return false; });
    }).then(function (approved) {
      var signer = web3().getSigner();
      var original = new E.Contract(ORIG, ABI.original, signer);
      var wrapper = new E.Contract(WRAPPER, ABI.wrapper, signer);

      function waitFor(tx, step, failMsg) {
        var timeout = new Promise(function (_, rej) { setTimeout(function () {
          rej(wrapErr("timeout", "Transaction is taking longer than expected.", tx.hash, step)); }, 120000); });
        var rcpt = tx.wait(1).catch(function (e) {
          if (e && e.code === "TRANSACTION_REPLACED") { if (e.receipt && e.receipt.status === 1) return e.receipt; throw wrapErr("reverted", "The transaction was replaced or dropped.", tx.hash, step); }
          throw wrapErr("tx-failed", failMsg, tx.hash, step);
        });
        return Promise.race([rcpt, timeout]).then(function (receipt) {
          if (!receipt || receipt.status === 0) throw wrapErr("reverted", failMsg, tx.hash, step);
          return receipt;
        });
      }
      function send(contract, method, args, step, label) {
        return Promise.all([web3().getBalance(wallet.address), web3().getGasPrice()]).catch(function () {
          throw wrapErr("wallet-rpc", "Couldn't reach Ethereum through your wallet's connection. Nothing was sent — check your network and try again.", null, step);
        }).then(function (bg) {
          var bal = bg[0], gasPrice = bg[1];
          return contract.estimateGas[method].apply(null, args).catch(function () {
            throw wrapErr("would-revert", step === "approve"
              ? "The approval would fail on-chain — the card may have just moved."
              : "Wrapping would fail on-chain. If you just approved, give it a few seconds and retry.", null, step);
          }).then(function (est) {
            var gasLimit = est.mul(120).div(100);
            if (gasLimit.gt(E.BigNumber.from(MAX_GAS))) gasLimit = E.BigNumber.from(MAX_GAS);
            var gasCost = gasLimit.mul(gasPrice);
            if (bal.lt(gasCost)) throw wrapErr("insufficient", "Not enough ETH for gas (about " + fmtEth(gasCost) + " Ξ for the " + label + ").", null, step);
            status("confirm-" + step, { gasCost: gasCost });
            return contract[method].apply(null, args.concat([{ gasLimit: gasLimit }]));
          }).catch(function (e) {
            if (e.kind) throw e;
            if (isUserReject(e)) throw wrapErr("rejected", (step === "approve" ? "Approval" : "Wrap") + " cancelled.", null, step);
            if (/insufficient funds/i.test(e.message || "")) throw wrapErr("insufficient", "Not enough ETH for gas.", null, step);
            throw wrapErr("send-failed", "Couldn't send the " + label + ". " + ((e && e.message) ? e.message.slice(0, 80) : "Please try again."), null, step);
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
    isUserReject: isUserReject, fmtEth: fmtEth, init: init,
    etherscanTx: function (h) { return "https://etherscan.io/tx/" + h; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
