/* hcx-ui.js — vanilla port of ui.jsx + the tiny runtime that replaces React.
 * h() is a hyperscript helper: h(tag, props, ...children) -> DOM node, mirroring
 * React.createElement so the component ports read almost identically. */
(function () {
  "use strict";

  // ---- palette + fonts (from ui.jsx + cards.jsx) ----
  var INK = "#ece7d8", DIM = "#8a8475", FAINT = "#5f5a4e",
      BG = "#0b0b0e", PANEL = "#101015", RULE = "#2a2925", COPPER = "#c98a4b";
  var SANS = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
  var MONO = "ui-monospace,'DejaVu Sans Mono','SFMono-Regular',Menlo,monospace";

  // ---- hyperscript ----
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) applyProps(el, props);
    appendKids(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }
  function applyProps(el, props) {
    for (var k in props) {
      var v = props[k];
      if (v == null) continue;
      if (k === "style") { for (var s in v) { if (v[s] != null) try { el.style[s] = v[s]; } catch (e) {} } }
      else if (k === "className" || k === "class") el.className = v;
      else if (k === "dangerouslySetInnerHTML") el.innerHTML = v.__html;
      else if (k === "key" || k === "ref") continue;
      else if (k === "value") el.value = v;
      else if (k === "disabled") { if (v) el.disabled = true; }
      else if (k === "checked") el.checked = !!v;
      else if (k.charCodeAt(0) === 111 && k.charCodeAt(1) === 110 && typeof v === "function") { // "on…"
        var ev = k.slice(2).toLowerCase();
        if (ev === "change" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) ev = "input";
        el.addEventListener(ev, v);
      }
      else el.setAttribute(k, v);
    }
  }
  function appendKids(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false || c === true) continue;
      if (Array.isArray(c)) { appendKids(el, c); continue; }
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  // ---- stores (replace React context) ----
  // Wallet: real connection state. The connect/disconnect logic lives in
  // hcx-chain.js (real injected provider); this store holds state + subscribers
  // so the rest of the UI can read it. notify() re-renders subscribers.
  var walletSubs = [];
  var wallet = {
    connected: false, address: null, chainId: null, connecting: false, loadingOwned: false,
    toggle: function () {
      if (!window.HCX_CHAIN) return;
      if (wallet.connected) window.HCX_CHAIN.disconnect();
      else window.HCX_CHAIN.connect();
    },
    set: function (patch) { Object.assign(wallet, patch); wallet.notify(); },
    notify: function () { walletSubs.forEach(function (f) { try { f(); } catch (e) {} }); },
    subscribe: function (fn) { walletSubs.push(fn); }
  };
  function useWallet() { return wallet; }
  function shortAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }

  // ---- toast (transient status) ----
  function toast(msg, kind, ms) {
    var t = document.getElementById("hcx-toast");
    if (!t) { t = h("div", { id: "hcx-toast", style: {
      position: "fixed", left: "50%", bottom: "26px", transform: "translate(-50%,20px)",
      background: "#16151b", color: INK, border: "1px solid " + RULE, borderRadius: "8px",
      font: "600 12.5px/1.4 " + MONO, letterSpacing: ".02em", padding: "12px 18px", zIndex: 300,
      opacity: 0, transition: "opacity .25s, transform .25s", pointerEvents: "none", maxWidth: "90vw", textAlign: "center",
      boxShadow: "0 18px 50px -20px #000" } });
      document.body.appendChild(t); }
    t.style.borderColor = kind === "error" ? "#d0563a" : kind === "ok" ? "#5fae6e" : RULE;
    t.textContent = msg;
    t.style.opacity = 1; t.style.transform = "translate(-50%,0)";
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.opacity = 0; t.style.transform = "translate(-50%,20px)"; }, ms || 3400);
  }

  // Router: hash based. router.go(route) navigates; subscribers re-render.
  var routerSubs = [];
  var router = {
    route: (location.hash || "#home").slice(1) || "home",
    go: function (r) {
      if (("#" + r) === location.hash) { router.route = r; window.scrollTo(0, 0); routerSubs.forEach(function (f) { f(); }); }
      else location.hash = "#" + r;
    },
    subscribe: function (fn) { routerSubs.push(fn); }
  };
  window.addEventListener("hashchange", function () {
    router.route = (location.hash || "#home").slice(1) || "home";
    window.scrollTo(0, 0);
    routerSubs.forEach(function (f) { f(); });
  });
  function useRouter() { return router; }

  function kids(args) { return Array.prototype.slice.call(args, 1); }

  // ---- primitives (ports of ui.jsx components) ----
  function Kicker(props) {
    props = props || {};
    return h("div", { style: Object.assign({
      font: "600 " + (props.size || 11) + "px/1.4 " + MONO, letterSpacing: ".22em",
      textTransform: "uppercase", color: props.color || COPPER }, props.style || {}) }, kids(arguments));
  }

  function Btn(props) {
    props = props || {};
    var children = kids(arguments);
    var ghost = props.variant === "ghost";
    var sm = props.size === "sm";
    var base = {
      font: "600 " + (sm ? 12 : 13.5) + "px/1 " + MONO, letterSpacing: ".14em",
      textTransform: "uppercase", cursor: "pointer", borderRadius: "4px",
      padding: sm ? "9px 15px" : "14px 24px", transition: "all .2s ease",
      display: "inline-flex", alignItems: "center", gap: "9px", whiteSpace: "nowrap",
      userSelect: "none", textDecoration: "none", border: "1px solid " + RULE
    };
    var st = ghost
      ? Object.assign(base, { background: "transparent", color: INK, border: "1px solid " + RULE })
      : Object.assign(base, { background: "linear-gradient(180deg,#e0a566,#b9772f)", color: "#160d04",
          border: "1px solid #d49a59", boxShadow: "0 8px 22px -12px " + COPPER + "cc, inset 0 1px 0 #ffffff55" });
    st = Object.assign(st, props.style || {});
    if (props.disabled) st = Object.assign({}, st, { opacity: 0.42, cursor: "not-allowed", boxShadow: "none" });
    return h(props.href ? "a" : "button", {
      href: props.href, onClick: props.disabled ? null : props.onClick, style: st,
      onMouseEnter: function (e) { if (props.disabled) return; if (ghost) { e.currentTarget.style.borderColor = COPPER; e.currentTarget.style.color = "#fff"; } else { e.currentTarget.style.filter = "brightness(1.07)"; e.currentTarget.style.transform = "translateY(-1px)"; } },
      onMouseLeave: function (e) { if (props.disabled) return; if (ghost) { e.currentTarget.style.borderColor = RULE; e.currentTarget.style.color = INK; } else { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; } }
    }, children);
  }

  function Stat(props) {
    return h("div", { style: Object.assign({ minWidth: 0 }, props.style || {}) },
      h("div", { style: { font: "700 " + (props.big || 34) + "px/1 " + MONO, letterSpacing: ".01em",
        color: props.accent || INK,
        background: props.gradient ? "linear-gradient(180deg,#f0d2a6,#c98a4b)" : "none",
        WebkitBackgroundClip: props.gradient ? "text" : "border-box",
        WebkitTextFillColor: props.gradient ? "transparent" : "inherit" } }, String(props.value)),
      h("div", { style: { marginTop: "8px", font: "600 10.5px/1.3 " + MONO, letterSpacing: ".2em",
        textTransform: "uppercase", color: DIM } }, props.label));
  }

  function Section(props) {
    props = props || {};
    return h("section", { id: props.id,
      style: Object.assign({ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px,5vw,56px)" }, props.style || {}) }, kids(arguments));
  }

  function DottedRule(props) {
    props = props || {};
    return h("div", { style: Object.assign({ height: "1px",
      background: "repeating-linear-gradient(90deg," + RULE + " 0 2px,transparent 2px 7px)" }, props.style || {}) });
  }

  function Tile(props) {
    props = props || {};
    return h("a", { href: props.href,
      onClick: function (e) { if (props.onClick) { e.preventDefault(); props.onClick(); } },
      style: { display: "block", position: "relative", overflow: "hidden",
        background: PANEL, border: "1px solid " + RULE, borderRadius: "8px",
        padding: "26px 26px 24px", textDecoration: "none", color: INK,
        transition: "border-color .22s, transform .22s, box-shadow .22s", cursor: "pointer" },
      onMouseEnter: function (e) { e.currentTarget.style.borderColor = COPPER + "99"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 22px 50px -30px #000"; },
      onMouseLeave: function (e) { e.currentTarget.style.borderColor = RULE; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }
    }, kids(arguments));
  }

  Object.assign(window, {
    h: h, INK: INK, DIM: DIM, FAINT: FAINT, BG: BG, PANEL: PANEL, RULE: RULE, COPPER: COPPER,
    SANS: SANS, MONO: MONO, useWallet: useWallet, useRouter: useRouter,
    Kicker: Kicker, Btn: Btn, Stat: Stat, Section: Section, DottedRule: DottedRule, Tile: Tile,
    toast: toast, shortAddr: shortAddr
  });
})();
