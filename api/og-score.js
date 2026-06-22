/* api/og-score.js — dynamic Open Graph image for a player's Historian Score.
 *
 * Renders a 1200×630 PNG share card via @vercel/og (Satori + resvg) on the edge:
 * rank crest + title, the big Historian Score, a collected progress bar, the
 * rarity breakdown, top badges and leaderboard position. The collection page
 * and the share-score button build the query string from the already-computed
 * breakdown, so this is deterministic, instant and CDN-cacheable.
 *
 *   /api/og-score?score=87450&rank=Grand%20Historian&ri=7&u=142&t=239
 *     &col=11350&gp=3500&ap=4000&m=4&l=8&e=22&r=30&un=40&c=38
 *     &badges=The%20Academy|Set%20Master&pos=7&label=cart00n.eth
 *
 * Any failure falls back to the static site OG image so a preview never breaks. */
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const BG = "#0B0B0E", RULE = "#2A2925", INK = "#ECE7D8", DIM = "#8A8475", MUTED = "#5A5549", COPPER = "#C98A4B", CORAL = "#E96F49";
const MONO = "IBM Plex Mono";

// rank title -> accent colour (mirrors hcx-score.js RANKS)
const RANK_COLOR = {
  "Student": "#8A8475", "Scholar": "#63A92C", "Historian": "#3B82F6", "Professor": "#A855F7",
  "Curator": "#FFD700", "Archivist": "#F4B860", "Grand Historian": "#E9C46A", "Immortal": "#FF7A45"
};
const TIERS = [
  { key: "m", name: "Mythic", color: "#E9C46A" },
  { key: "l", name: "Legendary", color: "#FFD700" },
  { key: "e", name: "Epic", color: "#A855F7" },
  { key: "r", name: "Rare", color: "#3B82F6" },
  { key: "un", name: "Uncommon", color: "#63A92C" },
  { key: "c", name: "Common", color: "#8A8475" }
];

function e(type, style, children) { return { type, props: { style, children } }; }
function row(style, children) { return e("div", Object.assign({ display: "flex" }, style), children); }
function col(style, children) { return e("div", Object.assign({ display: "flex", flexDirection: "column" }, style), children); }
function txt(style, s) { return e("div", Object.assign({ display: "flex" }, style), s); }
function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : (d || 0); }
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function clampStr(s, max) { s = String(s || ""); return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function shortAddr(a) { a = String(a || ""); return a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a; }

// hexagon-ish crest via clip isn't available in satori; use a rounded diamond badge
function crest(color, ri) {
  return col({
    width: "92px", height: "92px", borderRadius: "20px", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, " + color + ", " + color + "55)", border: "2px solid " + color,
    boxShadow: "0 0 30px " + color + "55"
  }, [
    txt({ fontSize: "40px", color: "#0b0b0e", fontWeight: 700 }, "★"),
    txt({ fontSize: "13px", color: "#0b0b0e", fontFamily: MONO, fontWeight: 700, marginTop: "-4px" }, "R" + (ri || 1))
  ]);
}

function tierChip(t, n) {
  const on = n > 0;
  return col({
    width: "118px", borderRadius: "10px", padding: "12px 4px", alignItems: "center",
    border: "1px solid " + (on ? t.color + "66" : RULE),
    background: on ? t.color + "1A" : "transparent", opacity: on ? 1 : 0.45
  }, [
    txt({ fontSize: "30px", fontFamily: MONO, fontWeight: 700, color: on ? t.color : MUTED }, String(n)),
    txt({ fontSize: "12px", fontFamily: MONO, letterSpacing: "1px", color: DIM, marginTop: "4px" }, t.name.toUpperCase())
  ]);
}

function buildTree(d) {
  const accent = RANK_COLOR[d.rank] || COPPER;
  const collectedPct = d.t ? Math.max(0, Math.min(100, (d.u / d.t) * 100)) : 0;

  const header = row({ justifyContent: "space-between", alignItems: "center" }, [
    txt({ fontSize: "16px", letterSpacing: "5px", color: COPPER, fontFamily: MONO, fontWeight: 600 }, "HUMANITYCARDS"),
    txt({ fontSize: "13px", letterSpacing: "2px", color: MUTED, fontFamily: MONO }, d.pos ? ("#" + d.pos + " ALL-TIME") : "HISTORIAN SCORE")
  ]);

  const identity = row({ alignItems: "center", gap: "22px", marginTop: "26px" }, [
    crest(accent, d.ri),
    col({}, [
      txt({ fontSize: "26px", color: INK, fontFamily: MONO, fontWeight: 600 }, clampStr(d.label ? (d.label + "’s collection") : "A HumanityCards collection", 34)),
      txt({ fontSize: "30px", color: accent, fontFamily: MONO, fontWeight: 700, marginTop: "4px" }, "★ " + (d.rank || "Student"))
    ])
  ]);

  const score = row({ alignItems: "baseline", gap: "16px", marginTop: "22px" }, [
    txt({ fontSize: "96px", color: INK, fontFamily: MONO, fontWeight: 700, lineHeight: 1 }, commas(d.score)),
    col({ paddingBottom: "12px" }, [
      txt({ fontSize: "15px", color: DIM, fontFamily: MONO, letterSpacing: "2px" }, "HISTORIAN"),
      txt({ fontSize: "15px", color: DIM, fontFamily: MONO, letterSpacing: "2px" }, "SCORE")
    ])
  ]);

  // breakdown line: Collection · Games · Badges
  const parts = row({ gap: "12px", alignItems: "center", marginTop: "8px" }, [
    txt({ fontSize: "20px", fontFamily: MONO, color: COPPER, fontWeight: 600 }, commas(d.col) + " collection"),
    txt({ fontSize: "16px", color: RULE, fontFamily: MONO }, "·"),
    txt({ fontSize: "20px", fontFamily: MONO, color: "#3B82F6", fontWeight: 600 }, commas(d.gp) + " games"),
    txt({ fontSize: "16px", color: RULE, fontFamily: MONO }, "·"),
    txt({ fontSize: "20px", fontFamily: MONO, color: "#A855F7", fontWeight: 600 }, commas(d.ap) + " badges")
  ]);

  // collected progress bar
  const bar = col({ marginTop: "20px" }, [
    row({ justifyContent: "space-between", marginBottom: "6px" }, [
      txt({ fontSize: "15px", fontFamily: MONO, color: DIM }, "COLLECTED"),
      txt({ fontSize: "15px", fontFamily: MONO, color: INK, fontWeight: 600 }, d.u + " / " + d.t + " figures")
    ]),
    e("div", { display: "flex", width: "100%", height: "14px", borderRadius: "8px", background: "#1b1a20", border: "1px solid " + RULE }, [
      e("div", { display: "flex", width: collectedPct + "%", height: "100%", borderRadius: "8px", background: "linear-gradient(90deg," + COPPER + "," + CORAL + ")" }, [])
    ])
  ]);

  const tiers = row({ gap: "10px", marginTop: "22px" }, TIERS.map((t) => tierChip(t, d[t.key] || 0)));

  const footerChildren = [txt({ fontSize: "15px", color: MUTED, fontFamily: MONO }, "humanitycards.vercel.app")];
  if (d.badges && d.badges.length) {
    footerChildren.unshift(row({ gap: "8px", alignItems: "center" }, [
      txt({ fontSize: "14px", color: MUTED, fontFamily: MONO }, "★"),
      txt({ fontSize: "16px", color: DIM, fontFamily: MONO }, clampStr(d.badges.join("  ·  "), 56))
    ]));
  }
  const footer = row({ marginTop: "auto", justifyContent: "space-between", alignItems: "center" }, footerChildren);

  return col({ width: "1200px", height: "630px", background: BG, padding: "20px", fontFamily: MONO }, [
    col({ width: "100%", height: "100%", borderRadius: "16px", border: "1px solid " + RULE, padding: "40px",
      background: "radial-gradient(ellipse 80% 70% at 15% 0%, " + accent + "18 0%, " + BG + " 60%)" },
      [header, identity, score, parts, bar, tiers, footer])
  ]);
}

async function loadFonts(base) {
  async function f(file, weight) { const r = await fetch(new URL("/assets/fonts/" + file, base)); return { name: MONO, data: await r.arrayBuffer(), weight, style: "normal" }; }
  return Promise.all([f("IBMPlexMono-Regular.ttf", 400), f("IBMPlexMono-SemiBold.ttf", 600)]);
}

export default async function handler(req) {
  let url; try { url = new URL(req.url); } catch (e2) { return new Response("bad url", { status: 400 }); }
  const q = url.searchParams;
  try {
    const d = {
      label: clampStr(q.get("label") || (q.get("wallet") ? shortAddr(q.get("wallet")) : ""), 28),
      score: num(q.get("score")), rank: q.get("rank") || "Student", ri: num(q.get("ri"), 1),
      u: num(q.get("u")), t: num(q.get("t"), 239),
      col: num(q.get("col")), gp: num(q.get("gp")), ap: num(q.get("ap")),
      m: num(q.get("m")), l: num(q.get("l")), e: num(q.get("e")), r: num(q.get("r")), un: num(q.get("un")), c: num(q.get("c")),
      pos: q.get("pos") ? num(q.get("pos")) : 0,
      badges: (q.get("badges") || "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3)
    };
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
