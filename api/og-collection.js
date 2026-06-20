/* api/og-collection.js — dynamic Open Graph image for Collection Showcase URLs.
 *
 * Renders a 1200×630 PNG (the format Twitter/Discord/Slack reliably unfurl) via
 * @vercel/og (Satori + resvg) on the edge runtime.
 *
 * Two ways in:
 *   • FAST (in-app): the showcase page passes the already-computed summary in
 *     the query string — deterministic, instant, cacheable. Powers the
 *     "Download Card" button and the client-set <meta> tags:
 *       /api/og-collection?wallet=0x..&label=cart00n.eth
 *         &n=47&u=31&l=2&e=8&r=6&c=31&score=2840
 *         &top=Cleopatra|legendary,Moses|legendary,Tesla|epic,Einstein|epic
 *   • SCAN (crawlers): only ?wallet=0x… is present — the per-request <meta> is
 *     injected by /api/collection. We read the collection from chain via
 *     Multicall3 (verified ~0.7s for the whole roster) and render the real cards.
 *
 * Any failure falls back to the site's static OG image, so a share preview is
 * never broken. Tier model matches hcx-showcase.js: legendary ≤3 · epic ≤10 ·
 * rare ≤30 · common otherwise. Cached hard at the edge (the query string carries
 * the card count, so a changed collection yields a fresh image). */
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const BG = "#0B0B0E", RULE = "#2A2925", INK = "#ECE7D8", DIM = "#8A8475", MUTED = "#5A5549", COPPER = "#C98A4B";
// Supply tiers drive only the card's glow/border colour — no tier names; the
// label is the real supply fraction ("1 OF N").
const TIER = {
  legendary: { color: "#FFD700" },
  epic: { color: "#A855F7" },
  rare: { color: "#3B82F6" },
  common: { color: "#8A8475" },
};
const MONO = "IBM Plex Mono";

// ---- chain (scan path) ----
const ORIG = "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc";
const WRAPPER = "0xf6f722590AF5F791f68d0ED88D27b72dDe1C70CA";
const MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"];
const SEL = { humanNumber: "0xd8c35273", humanInfo: "0x1dd7cf6d", cardInfo: "0x970129be", ownerOf: "0x6352211e", aggregate3: "0x82ad56cb" };
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

const hx = (n) => BigInt(n).toString(16).padStart(64, "0");
const addr32 = (a) => a.replace(/^0x/, "").toLowerCase().padStart(64, "0");
function words(hex) { if (!hex) return []; hex = hex.replace(/^0x/, ""); const w = []; for (let i = 0; i < hex.length; i += 64) w.push(hex.slice(i, i + 64)); return w; }
function encAggregate3(calls) {
  const n = calls.length;
  const elems = calls.map((c) => {
    const data = c.callData.replace(/^0x/, "");
    const padded = data + "0".repeat((64 - (data.length % 64)) % 64);
    return addr32(c.target) + hx(1) + hx(0x60) + hx(data.length / 2) + padded;
  });
  let running = n * 32; const offs = [];
  for (const e2 of elems) { offs.push(hx(running)); running += e2.length / 2; }
  return SEL.aggregate3 + hx(0x20) + hx(n) + offs.join("") + elems.join("");
}
function decAggregate3(hex) {
  const w = words(hex); if (!w.length) return [];
  const arrOff = parseInt(w[0], 16) / 32, len = parseInt(w[arrOff], 16), base = arrOff + 1, out = [];
  for (let i = 0; i < len; i++) {
    const elOff = parseInt(w[base + i], 16) / 32 + base;
    const success = parseInt(w[elOff], 16) === 1;
    const bytesOff = parseInt(w[elOff + 1], 16) / 32 + elOff;
    const blen = parseInt(w[bytesOff], 16);
    out.push({ success, data: "0x" + w.slice(bytesOff + 1).join("").slice(0, blen * 2) });
  }
  return out;
}
function hexToStr(h) {
  try { return decodeURIComponent(h.replace(/(..)/g, "%$1")); }
  catch (e) { let s = ""; for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return s; }
}
function decHumanInfo(hex) {
  const w = words(hex); if (w.length < 3) return null;
  const off = parseInt(w[0], 16), max = parseInt(w[1], 16), mined = parseInt(w[2], 16), len = parseInt(w[off / 32], 16);
  const raw = hex.replace(/^0x/, "").slice((off + 32) * 2, (off + 32) * 2 + len * 2);
  return { name: hexToStr(raw), max, mined };
}
function decCardInfo(hex) { const w = words(hex); if (w.length < 2) return null; return { human: parseInt(w[0], 16), owner: "0x" + w[1].slice(24) }; }
async function rpc(to, data) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
      const j = await r.json();
      if (j && j.result !== undefined) return j.result;
      lastErr = new Error("no result");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("rpc failed");
}
async function multicall(calls, size) {
  size = size || 400; const chunks = [];
  for (let i = 0; i < calls.length; i += size) chunks.push(calls.slice(i, i + size));
  const parts = await Promise.all(chunks.map((ch) => rpc(MC3, encAggregate3(ch)).then(decAggregate3)));
  return parts.flat();
}
function tierOf(max) { return max <= 3 ? "legendary" : max <= 10 ? "epic" : max <= 30 ? "rare" : "common"; }
async function scanWallet(address) {
  const target = address.toLowerCase(), wrapL = WRAPPER.toLowerCase();
  const N = parseInt(await rpc(ORIG, SEL.humanNumber), 16) || 239;
  const hi = await multicall(Array.from({ length: N }, (_, i) => ({ target: ORIG, callData: SEL.humanInfo + hx(i) })));
  const humans = {}; let cardMined = 0;
  hi.forEach((r, i) => { if (r.success) { const d = decHumanInfo(r.data); if (d) { humans[i] = d; cardMined += d.mined; } } });
  if (!cardMined) return null;
  const ci = await multicall(Array.from({ length: cardMined }, (_, t) => ({ target: ORIG, callData: SEL.cardInfo + hx(t) })));
  const owned = [], wc = [];
  ci.forEach((r, t) => {
    if (!r.success) return; const d = decCardInfo(r.data); if (!d) return;
    const o = d.owner.toLowerCase();
    if (o === target) owned.push({ human: d.human });
    else if (o === wrapL) wc.push({ cardId: t, human: d.human });
  });
  if (wc.length) {
    const wr = await multicall(wc.map((w) => ({ target: WRAPPER, callData: SEL.ownerOf + hx(w.cardId) })));
    wr.forEach((r, i) => {
      if (r.success && r.data && r.data !== "0x") {
        const o = "0x" + (words(r.data)[0] || "").slice(24);
        if (o.toLowerCase() === target) owned.push({ human: wc[i].human });
      }
    });
  }
  // summarise
  const counts = { legendary: 0, epic: 0, rare: 0, common: 0 }, seen = {}, perFig = {}, enriched = [];
  let score = 0, uniques = 0;
  owned.forEach((o) => {
    const hm = humans[o.human]; if (!hm) return;
    const k = tierOf(hm.max);
    counts[k]++; score += k === "legendary" ? 100 : k === "epic" ? 40 : k === "rare" ? 15 : 5;
    if (!seen[o.human]) { seen[o.human] = 1; uniques++; enriched.push({ name: hm.name, tier: k, max: hm.max, human: o.human }); }
    (perFig[o.human] = perFig[o.human] || { c: 0, max: hm.max }).c++;
  });
  Object.keys(perFig).forEach((id) => { if (perFig[id].c >= perFig[id].max) score += 50; });
  if (counts.legendary && counts.epic && counts.rare && counts.common && owned.length) score += 200;
  enriched.sort((a, b) => a.max - b.max || a.human - b.human);
  return { n: owned.length, u: uniques, l: counts.legendary, e: counts.epic, r: counts.rare, c: counts.common,
    score, top: enriched.slice(0, 5).map((x) => [x.name, x.max]) };
}

// ---- satori element helpers ----
function e(type, style, children) { return { type, props: { style, children } }; }
function row(style, children) { return e("div", Object.assign({ display: "flex" }, style), children); }
function col(style, children) { return e("div", Object.assign({ display: "flex", flexDirection: "column" }, style), children); }
function txt(style, s) { return e("div", Object.assign({ display: "flex" }, style), s); }
function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : (d || 0); }
function clampStr(s, max) { s = String(s || ""); return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function shortAddr(a) { a = String(a || ""); return a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a; }

function miniCard(name, supply) {
  const t = TIER[tierOf(Number(supply) || 50)];
  const display = clampStr(String(name || "").toUpperCase(), 11);
  return col({
    width: "132px", height: "186px", borderRadius: "8px", border: "2px solid " + t.color,
    background: "linear-gradient(170deg, " + t.color + "14 0%, #0c0d0f 55%)",
    alignItems: "center", justifyContent: "space-between", padding: "16px 8px",
  }, [
    txt({ fontSize: "11px", letterSpacing: "3px", color: DIM, fontFamily: MONO }, "HCX"),
    txt({ fontSize: display.length > 8 ? "16px" : "20px", fontWeight: 600, color: INK, fontFamily: MONO, textAlign: "center", lineHeight: 1.1, padding: "0 4px" }, display),
    txt({ fontSize: "11px", letterSpacing: "1px", fontWeight: 600, color: t.color, fontFamily: MONO, padding: "3px 8px", borderRadius: "3px", border: "1px solid " + t.color + "66" }, "1 OF " + (Number(supply) || "?")),
  ]);
}
function statPart(label, value, color) {
  return txt({ fontSize: "22px", color: color || DIM, fontFamily: MONO, fontWeight: 600 }, value + " " + label);
}

function buildTree(d) {
  const children = [];
  children.push(row({ justifyContent: "space-between", alignItems: "center" }, [
    txt({ fontSize: "16px", letterSpacing: "5px", color: COPPER, fontFamily: MONO, fontWeight: 600 }, "HUMANITYCARDS"),
    txt({ fontSize: "13px", letterSpacing: "2px", color: MUTED, fontFamily: MONO }, "239 FIGURES · ON-CHAIN 2018"),
  ]));
  const title = d.hasData ? (d.label ? d.label + "’s Collection" : "A HumanityCards Collection") : "Collection Showcase";
  children.push(txt({ fontSize: "46px", fontWeight: 600, color: INK, fontFamily: MONO, marginTop: "26px" }, title));

  if (d.hasData && d.top.length) {
    children.push(row({ gap: "16px", marginTop: "30px" }, d.top.map((t) => miniCard(t[0], t[1]))));
  } else if (!d.hasData) {
    children.push(txt({ fontSize: "22px", color: DIM, fontFamily: MONO, marginTop: "20px", lineHeight: 1.5 },
      "A premium trophy case for any wallet — every card shown by its real on-chain supply, scored and ranked."));
    children.push(row({ gap: "16px", marginTop: "30px" },
      [["Cleopatra", 10], ["Tesla", 10], ["Einstein", 20], ["Napoleon", 3], ["Da Vinci", 10]].map((t) => miniCard(t[0], t[1]))));
  }

  if (d.hasData) {
    children.push(row({ marginTop: "auto", alignItems: "center", gap: "14px", flexWrap: "wrap" }, [
      statPart("Cards", commas(d.n), INK),
      txt({ fontSize: "20px", color: RULE, fontFamily: MONO }, "·"),
      statPart("Unique", commas(d.u), DIM),
      txt({ fontSize: "20px", color: RULE, fontFamily: MONO }, "·"),
      statPart("Score", commas(d.score), COPPER),
    ]));
  }
  children.push(txt({ fontSize: "15px", color: MUTED, fontFamily: MONO, marginTop: d.hasData ? "18px" : "auto" }, "humanitycards.vercel.app"));

  return col({ width: "1200px", height: "630px", background: BG, padding: "20px" }, [
    col({ width: "100%", height: "100%", borderRadius: "16px", border: "1px solid " + RULE, padding: "40px",
      background: "radial-gradient(ellipse 70% 60% at 50% 58%, rgba(201,138,75,0.10) 0%, " + BG + " 62%)" }, children),
  ]);
}

async function loadFonts(base) {
  async function f(file, weight) { const r = await fetch(new URL("/assets/fonts/" + file, base)); return { name: MONO, data: await r.arrayBuffer(), weight, style: "normal" }; }
  return Promise.all([f("IBMPlexMono-Regular.ttf", 400), f("IBMPlexMono-SemiBold.ttf", 600)]);
}

export default async function handler(req) {
  let url; try { url = new URL(req.url); } catch (e2) { return new Response("bad url", { status: 400 }); }
  const q = url.searchParams;
  const wallet = (q.get("wallet") || "").trim();
  let label = clampStr(q.get("label") || (wallet ? shortAddr(wallet) : ""), 28);

  try {
    let d;
    const explicit = !!(q.get("n") || q.get("score") || q.get("top"));
    if (explicit) {
      const top = (q.get("top") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
        .map((s) => { const i = s.lastIndexOf("|"); return i > 0 ? [s.slice(0, i), Number(s.slice(i + 1)) || 50] : [s, 50]; });
      d = { hasData: true, label, n: num(q.get("n")), u: num(q.get("u")), l: num(q.get("l")), e: num(q.get("e")), r: num(q.get("r")), c: num(q.get("c")), score: num(q.get("score")), top };
    } else if (ADDR_RE.test(wallet)) {
      const scan = await Promise.race([scanWallet(wallet), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 9500))]).catch(() => null);
      if (scan && scan.n) d = Object.assign({ hasData: true, label }, scan);
      else d = { hasData: false, label }; // empty / failed scan → tasteful generic card
    } else {
      d = { hasData: false, label: "" };
    }

    return new ImageResponse(buildTree(d), {
      width: 1200, height: 630,
      fonts: await loadFonts(url),
      headers: { "cache-control": "public, no-transform, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    try {
      const r = await fetch(new URL("/assets/og-image.png", url));
      return new Response(r.body, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, s-maxage=300" } });
    } catch (e3) { return new Response("og error", { status: 500 }); }
  }
}
