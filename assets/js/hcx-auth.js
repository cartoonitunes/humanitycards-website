/* hcx-auth.js — Google Sign-In (the primary identity for games + leaderboards).
 *
 * Uses Google Identity Services (the gsi/client library loaded in index.html).
 * The ID-token JWT it returns is the credential: we decode it client-side for
 * the display name + avatar, keep the raw token in localStorage for session
 * persistence, and send it to /api/scores as a Bearer token (the server
 * verifies it and reads the stable `sub` as the user id). The email is read
 * from the token only enough to never be stored or shown.
 *
 * The session state lives in the `auth` store (hcx-ui.js); this file is the
 * GSI logic + the sign-in button, name-choice modal and profile menu, mirroring
 * how hcx-chain.js backs the wallet store. Everything degrades quietly: if the
 * library never loads (offline, blocked), the games still play signed-out.
 *
 * NOTE: GOOGLE_CLIENT_ID is injected at deploy time. Until Julian provides it,
 * the placeholder below is the single string to find-and-replace.
 */
(function () {
  "use strict";
  var CLIENT_ID = "PLACEHOLDER_GOOGLE_CLIENT_ID";

  var h = window.h, INK = window.INK, DIM = window.DIM, FAINT = window.FAINT,
      PANEL = window.PANEL, RULE = window.RULE, COPPER = window.COPPER, MONO = window.MONO, SANS = window.SANS;
  var auth = window.useAuth();

  // Same API base resolution as hcx-scores.js: same-origin on Vercel, the
  // canonical Vercel API when served from an IPFS/eth.limo gateway.
  var host = location.hostname;
  var ON_IPFS = host.indexOf("eth.limo") !== -1 || host.indexOf("ipfs") !== -1;
  var API = ON_IPFS ? "https://humanitycards.vercel.app/api/scores" : "/api/scores";

  var TOKEN_KEY = "hcx_g_token";
  function nameKey(sub) { return "hcx_g_name_" + sub; }

  // ---- JWT decode (display fields only; the server does the real verify) ----
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    var pad = s.length % 4; if (pad) s += "====".slice(pad);
    return atob(s);
  }
  function decodeJwt(t) {
    try {
      var parts = String(t).split("."); if (parts.length < 2) return null;
      var bin = b64urlDecode(parts[1]);
      var pct = bin.split("").map(function (c) { return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join("");
      return JSON.parse(decodeURIComponent(pct));
    } catch (e) { return null; }
  }

  function gsiReady() {
    return !!(window.google && window.google.accounts && window.google.accounts.id);
  }

  // ---- session ----
  function applySession(token, payload, displayName) {
    auth.set({
      signedIn: true, token: token, sub: payload.sub,
      googleName: payload.given_name || payload.name || "Historian",
      picture: payload.picture || null,
      displayName: displayName || null,
      needsName: false
    });
  }

  // Reconcile the chosen name with the server (handles a fresh device / cleared
  // cache, where the local name cache is empty but the player named themselves
  // before). No stored name and no cache → first sign-in: prompt for one.
  function reconcileName(payload) {
    var cached = localStorage.getItem(nameKey(payload.sub));
    fetch(API + "?whoami=1", { headers: { Authorization: "Bearer " + auth.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var name = (j && j.display_name) || cached || null;
        if (name) {
          localStorage.setItem(nameKey(payload.sub), name);
          auth.set({ displayName: name, needsName: false });
        } else {
          auth.set({ displayName: null, needsName: true });
          openNameModal({ initial: payload.given_name || "", allowSkip: true });
        }
      })
      .catch(function () {
        // offline / API down: fall back to the local cache; only prompt if we
        // truly have nothing for this account.
        if (cached) auth.set({ displayName: cached, needsName: false });
        else { auth.set({ needsName: true }); openNameModal({ initial: payload.given_name || "", allowSkip: true }); }
      });
  }

  // GSI credential callback (button click, One Tap, and silent auto-select).
  function onCredential(resp) {
    var token = resp && resp.credential;
    var payload = token && decodeJwt(token);
    if (!payload || !payload.sub) return;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    applySession(token, payload, localStorage.getItem(nameKey(payload.sub)));
    reconcileName(payload);
  }

  // Restore a still-valid token on load (no network). Google JWTs last ~1h; an
  // expired one is cleared and One Tap auto-select silently refreshes it.
  function restore() {
    var token; try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }
    if (!token) return false;
    var p = decodeJwt(token);
    if (!p || !p.sub || !p.exp || p.exp * 1000 <= Date.now()) {
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      return false;
    }
    applySession(token, p, localStorage.getItem(nameKey(p.sub)));
    return true;
  }

  function signOut() {
    try { if (gsiReady()) window.google.accounts.id.disableAutoSelect(); } catch (e) {}
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    auth.set({ signedIn: false, token: null, sub: null, googleName: null, picture: null, displayName: null, needsName: false });
    closeProfileMenu();
  }

  // ---- name (leaderboard display name) ----
  var NAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;
  function randomHistorian() { return "Historian_" + Math.floor(1000 + Math.random() * 9000); }

  function setName(name) {
    if (!auth.token) return Promise.resolve({ status: 401, body: { error: "auth required" } });
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth.token },
      body: JSON.stringify({ action: "set_name", name: name })
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; }, function () { return { status: r.status, body: {} }; });
    }).then(function (res) {
      if (res.status === 200 && res.body.display_name) {
        var nm = res.body.display_name;
        if (auth.sub) { try { localStorage.setItem(nameKey(auth.sub), nm); } catch (e) {} }
        auth.set({ displayName: nm, needsName: false });
        if (window.HCX_SCORES && window.HCX_SCORES.refreshAll) window.HCX_SCORES.refreshAll();
      }
      return res;
    }).catch(function () { return { status: 0, body: {} }; });
  }

  // First sign-in name picker (and "Change name" later). Modal on <body> so it
  // survives the route/chrome re-renders.
  function openNameModal(opts) {
    opts = opts || {};
    var overlay, msg, input, saving = false;
    function close() { if (overlay) overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape" && opts.allowSkip) doSkip(); }
    function setMsg(t, color) { msg.textContent = t || ""; msg.style.color = color || "#d0563a"; }

    function save() {
      if (saving) return;
      var name = (input.value || "").trim();
      if (!NAME_RE.test(name)) { setMsg("3–20 characters: letters, numbers, spaces, _ or -.", "#d0563a"); return; }
      saving = true; setMsg("Saving…", DIM);
      setName(name).then(function (res) {
        saving = false;
        if (res.status === 200) { close(); window.toast("You're on the board as " + res.body.display_name + ".", "ok"); }
        else if (res.status === 409) setMsg("That name's taken — try another.", "#d0563a");
        else setMsg("Couldn't save that — try again.", "#d0563a");
      });
    }
    function doSkip() {
      if (saving) return;
      saving = true; setMsg("Assigning a name…", DIM);
      (function attempt(tries) {
        setName(randomHistorian()).then(function (res) {
          if (res.status === 200) { close(); }
          else if (res.status === 409 && tries < 4) attempt(tries + 1);
          else { saving = false; close(); }   // give up quietly — they can rename later
        });
      })(0);
    }

    input = h("input", { value: opts.initial || "", maxlength: "20", placeholder: "Your leaderboard name",
      onInput: function () { setMsg(""); },
      style: { width: "100%", boxSizing: "border-box", background: "#0c0c10", border: "1px solid " + RULE, borderRadius: "8px",
        padding: "12px 14px", font: "600 15px/1 " + MONO, color: INK, outline: "none", letterSpacing: ".02em" },
      onFocus: function (e) { e.target.style.borderColor = COPPER; }, onBlur: function (e) { e.target.style.borderColor = RULE; } });
    msg = h("div", { style: { minHeight: "16px", marginTop: "10px", font: "600 11.5px/1.4 " + SANS, color: "#d0563a" } });

    overlay = h("div", { className: "detail-overlay", style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(6,6,9,.84)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "fadeUp .22s ease" },
      onClick: function (e) { if (e.target === overlay && opts.allowSkip) doSkip(); } },
      h("div", { style: { maxWidth: "440px", width: "100%", background: PANEL, border: "1px solid " + RULE, borderRadius: "12px",
        padding: "26px 28px", boxShadow: "0 40px 100px -30px #000" } },
        window.Kicker({ color: COPPER }, opts.allowSkip ? "Welcome" : "Leaderboard name"),
        h("h2", { style: { margin: "10px 0 6px", font: "700 24px/1.1 " + MONO, color: INK } },
          opts.allowSkip ? "Choose your leaderboard name" : "Change your name"),
        h("p", { style: { margin: "0 0 18px", font: "400 13.5px/1.6 " + SANS, color: DIM } },
          "This is the name other players see on the board. You can change it any time — your email is never shown."),
        input, msg,
        h("div", { style: { marginTop: "18px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
          window.Btn({ onClick: save }, opts.allowSkip ? "Save name" : "Save"),
          opts.allowSkip
            ? window.Btn({ variant: "ghost", size: "sm", onClick: doSkip }, "Skip — pick one for me")
            : window.Btn({ variant: "ghost", size: "sm", onClick: close }, "Cancel"))));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
  }
  function changeName() { closeProfileMenu(); openNameModal({ initial: auth.displayName || auth.googleName || "", allowSkip: false }); }

  // ---- the "Sign in with Google" button (rendered by GSI) ----
  // One persistent node, reused across nav re-renders so the rendered button
  // isn't rebuilt (and One Tap state isn't disturbed) on every route change.
  var gbtn = null, gbtnRendered = false;
  function renderGoogleButton() {
    if (!gbtn || gbtnRendered || !gsiReady()) return;
    try {
      window.google.accounts.id.renderButton(gbtn, {
        type: "standard", theme: "filled_black", size: "large", shape: "pill",
        text: "signin_with", logo_alignment: "left"
      });
      gbtnRendered = true;
    } catch (e) {}
  }
  function signInButton() {
    if (!gbtn) {
      gbtn = document.createElement("div");
      gbtn.className = "hcx-gsi-btn";
      gbtn.style.display = "inline-flex";
      gbtn.style.minHeight = "40px";
      gbtn.style.alignItems = "center";
    }
    renderGoogleButton();
    // Fallback affordance while the GSI library is still loading (or blocked):
    // a tappable label that triggers One Tap. Replaced once the button renders.
    if (!gbtnRendered && !gbtn.firstChild) {
      gbtn.appendChild(window.Btn({ size: "sm", onClick: promptSignIn }, "Sign in with Google"));
    }
    return gbtn;
  }
  function promptSignIn() {
    if (gsiReady()) { try { window.google.accounts.id.prompt(); } catch (e) {} }
  }

  // ---- profile menu (signed-in) ----
  var menuEl = null;
  function closeProfileMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener("keydown", menuKey); document.removeEventListener("click", menuAway, true); }
  }
  function menuKey(e) { if (e.key === "Escape") closeProfileMenu(); }
  function menuAway(e) { if (menuEl && !menuEl.contains(e.target) && !menuEl._anchor.contains(e.target)) closeProfileMenu(); }

  function menuRow(label, onClick, color) {
    return h("button", { onClick: onClick,
      style: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
        padding: "11px 16px", font: "600 12.5px/1 " + MONO, letterSpacing: ".04em", color: color || INK, borderRadius: "6px" },
      onMouseEnter: function (e) { e.currentTarget.style.background = "#ffffff0a"; },
      onMouseLeave: function (e) { e.currentTarget.style.background = "none"; } }, label);
  }

  function openProfileMenu(anchor) {
    if (menuEl) { closeProfileMenu(); return; }
    var w = window.useWallet();
    var rect = anchor.getBoundingClientRect();
    menuEl = h("div", { style: { position: "fixed", top: (rect.bottom + 8) + "px", right: Math.max(8, window.innerWidth - rect.right) + "px",
      zIndex: 220, minWidth: "210px", background: "#121218", border: "1px solid " + RULE, borderRadius: "10px",
      padding: "6px", boxShadow: "0 24px 60px -20px #000, 0 0 0 1px #ffffff08", animation: "fadeUp .16s ease" } },
      h("div", { style: { padding: "10px 16px 8px" } },
        h("div", { style: { font: "700 13px/1.2 " + MONO, color: INK, wordBreak: "break-word" } }, auth.displayName || auth.googleName || "Player"),
        h("div", { style: { marginTop: "3px", font: "600 9.5px/1 " + MONO, letterSpacing: ".14em", color: FAINT } }, "SIGNED IN WITH GOOGLE")),
      window.DottedRule({ style: { margin: "4px 8px" } }),
      menuRow("Change name", changeName),
      w.connected
        ? menuRow("Wallet · " + window.shortAddr(w.address), function () { closeProfileMenu(); w.toggle(); }, COPPER)
        : menuRow("Link wallet", function () { closeProfileMenu(); w.toggle(); }, COPPER),
      window.DottedRule({ style: { margin: "4px 8px" } }),
      menuRow("Sign out", signOut, "#d0563a"));
    menuEl._anchor = anchor;
    document.body.appendChild(menuEl);
    document.addEventListener("keydown", menuKey);
    // capture phase so a click anywhere (including nav re-render targets) closes
    setTimeout(function () { document.addEventListener("click", menuAway, true); }, 0);
  }

  // ---- GSI bootstrap ----
  function initGsi() {
    if (!gsiReady()) return;
    try {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: onCredential,
        auto_select: true,
        cancel_on_tap_outside: false,
        itp_support: true
      });
    } catch (e) { return; }
    auth.set({ ready: true });
    renderGoogleButton();
    auth.notify();                 // nav swaps the loading affordance for the real button
    // Restore a live token; otherwise let One Tap silently re-issue one for a
    // returning user (auto_select), or show the prompt for a new visitor.
    if (!restore()) {
      try { window.google.accounts.id.prompt(); } catch (e) {}
    }
  }

  // GSI calls this global when the library finishes loading; also cover the
  // case where the (async) library was already ready before this script ran.
  window.onGoogleLibraryLoad = initGsi;
  if (gsiReady()) initGsi();

  window.HCX_AUTH = {
    signInButton: signInButton, promptSignIn: promptSignIn, signOut: signOut,
    openProfileMenu: openProfileMenu, closeProfileMenu: closeProfileMenu,
    changeName: changeName, openNameModal: openNameModal, setName: setName
  };
})();
