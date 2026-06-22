/* api/og-card.js — dynamic Open Graph image for a single HumanityCard.
 *
 * Renders a 1200×630 PNG share card via @vercel/og (Satori + resvg) on the
 * edge: the card artwork on the LEFT, a stats panel on the RIGHT (figure name,
 * token id, real supply / rarity tier, the HumanityCards provenance line, and
 * the current holder). This is what Twitter/Discord/Slack unfurl when someone
 * shares humanitycards.vercel.app/card/N.
 *
 * Two ways in (mirrors og-collection.js):
 *   • FAST — /api/card builds the full query string from its chain read, so the
 *     image is deterministic, instant and CDN-cacheable:
 *       /api/og-card?id=42&name=Cleopatra&max=10&mined=10
 *         &owner=cart00n.eth&wrapped=1
 *   • SCAN — only ?id=N present (a crawler hitting the image URL directly): we
 *     read the card from chain ourselves.
 *
 * Artwork: if the card is wrapped we try its on-chain tokenURI image; otherwise
 * (and on any failure) we draw a branded, tier-coloured card so a preview is
 * never broken. Any hard failure falls back to the static site OG image. */
import { ImageResponse } from "@vercel/og";
import { fetchCard, fetchCardImage, tierOf } from "./_lib/cards.js";

export const config = { runtime: "edge" };

const BG = "#0B0B0E", RULE = "#2A2925", INK = "#ECE7D8", DIM = "#8A8475", MUTED = "#5A5549", COPPER = "#C98A4B";
const MONO = "IBM Plex Mono";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const isZeroAddr = (a) => /^0x0{40}$/i.test(String(a || ""));

function e(type, style, children) { return { type, props: { style, children } }; }
function row(style, children) { return e("div", Object.assign({ display: "flex" }, style), children); }
function col(style, children) { return e("div", Object.assign({ display: "flex", flexDirection: "column" }, style), children); }
function txt(style, s) { return e("div", Object.assign({ display: "flex" }, style), s); }
function num(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : (d || 0); }
function clampStr(s, max) { s = String(s || ""); return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function shortAddr(a) { a = String(a || ""); return a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a; }

// branded fallback card (no on-chain artwork) — echoes the site's card look
function brandedCard(d, t) {
  const name = String(d.name || "").toUpperCase();
  const big = name.length <= 9;
  return col({
    width: "360px", height: "504px", borderRadius: "18px", border: "3px solid " + t.color,
    background: "linear-gradient(165deg, " + t.color + "1F 0%, #0c0d0f 58%)",
    boxShadow: "0 0 60px " + t.color + "44", alignItems: "center", justifyContent: "space-between",
    padding: "30px 22px",
  }, [
    col({ alignItems: "center", gap: "6px" }, [
      txt({ fontSize: "16px", letterSpacing: "8px", color: DIM, fontFamily: MONO, fontWeight: 600 }, "HCX"),
      txt({ fontSize: "13px", letterSpacing: "2px", color: t.color, fontFamily: MONO }, t.name.toUpperCase()),
    ]),
    col({ alignItems: "center", gap: "16px" }, [
      // monogram medallion
      col({
        width: "150px", height: "150px", borderRadius: "75px", alignItems: "center", justifyContent: "center",
        border: "2px solid " + t.color + "88", background: "radial-gradient(circle at 40% 35%, " + t.color + "33, #0b0b0e 70%)",
      }, [txt({ fontSize: "76px", fontWeight: 700, color: INK, fontFamily: MONO }, (name[0] || "H"))]),
      txt({ fontSize: big ? "34px" : "26px", fontWeight: 600, color: INK, fontFamily: MONO, textAlign: "center", lineHeight: 1.1, padding: "0 6px" }, clampStr(name, 22)),
    ]),
    txt({ fontSize: "15px", letterSpacing: "1px", fontWeight: 600, color: t.color, fontFamily: MONO,
      padding: "8px 16px", borderRadius: "5px", border: "1px solid " + t.color + "66" }, "1 OF " + (d.max || "?")),
  ]);
}

function statLine(label, value, color) {
  return row({ alignItems: "center", gap: "12px" }, [
    txt({ fontSize: "15px", letterSpacing: "2px", color: MUTED, fontFamily: MONO, width: "118px" }, label),
    txt({ fontSize: "21px", color: color || INK, fontFamily: MONO, fontWeight: 600 }, value),
  ]);
}

function buildTree(d, artNode) {
  const t = tierOf(d.max);
  const left = artNode || brandedCard(d, t);

  const right = col({ flex: 1, justifyContent: "center", minWidth: 0 }, [
    txt({ fontSize: "16px", letterSpacing: "5px", color: COPPER, fontFamily: MONO, fontWeight: 600 }, "HUMANITYCARDS"),
    txt({ fontSize: d.name && d.name.length > 14 ? "56px" : "72px", fontWeight: 600, color: INK, fontFamily: MONO, lineHeight: 1.02, marginTop: "10px" }, clampStr(d.name || "HumanityCard", 22)),
    // rarity tier chip
    row({ marginTop: "18px" }, [
      txt({ fontSize: "18px", letterSpacing: "2px", fontWeight: 600, color: t.color, fontFamily: MONO,
        padding: "8px 16px", borderRadius: "6px", border: "1px solid " + t.color + "66", background: t.color + "14" },
        t.name.toUpperCase() + " · 1 OF " + (d.max || "?")),
    ]),
    col({ marginTop: "30px", gap: "14px" }, [
      statLine("TOKEN ID", "#" + d.id, INK),
      statLine("MINTED", (d.mined != null ? d.mined : "?") + " of " + (d.max || "?"), DIM),
      statLine("HELD BY", clampStr(d.label || shortAddr(d.owner), 24), COPPER),
    ]),
    row({ marginTop: "30px", alignItems: "center", gap: "12px", flexWrap: "wrap" }, [
      txt({ fontSize: "15px", letterSpacing: "1px", color: DIM, fontFamily: MONO, padding: "5px 12px", borderRadius: "4px", border: "1px solid " + RULE }, "DEPLOYED MARCH 2018"),
      txt({ fontSize: "15px", letterSpacing: "1px", color: DIM, fontFamily: MONO, padding: "5px 12px", borderRadius: "4px", border: "1px solid " + RULE }, "PRE-ERC721"),
    ]),
  ]);

  return col({ width: "1200px", height: "630px", background: BG, padding: "20px", fontFamily: MONO }, [
    col({ width: "100%", height: "100%", borderRadius: "16px", border: "1px solid " + RULE, padding: "44px",
      background: "radial-gradient(ellipse 70% 80% at 18% 50%, " + t.color + "18 0%, " + BG + " 60%)" }, [
      row({ width: "100%", height: "100%", alignItems: "center", gap: "48px" }, [left, right]),
    ]),
  ]);
}

async function loadFonts(base) {
  async function f(file, weight) { const r = await fetch(new URL("/assets/fonts/" + file, base)); return { name: MONO, data: await r.arrayBuffer(), weight, style: "normal" }; }
  return Promise.all([f("IBMPlexMono-Regular.ttf", 400), f("IBMPlexMono-SemiBold.ttf", 600)]);
}

export default async function handler(req) {
  let url; try { url = new URL(req.url); } catch (e) { return new Response("bad url", { status: 400 }); }
  const q = url.searchParams;
  const id = q.get("id");

  try {
    let d;
    if (q.get("name")) {
      // FAST path — /api/card supplied the resolved data
      d = {
        id: num(id), name: q.get("name"), max: num(q.get("max")), mined: q.get("mined") != null ? num(q.get("mined")) : null,
        owner: q.get("owner") || "", label: q.get("owner") || "", wrapped: q.get("wrapped") === "1",
      };
      if (ADDR_RE.test(d.owner)) d.label = shortAddr(d.owner);   // raw address -> short form
    } else if (id != null && /^\d+$/.test(id)) {
      const c = await Promise.race([fetchCard(id), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000))]).catch(() => null);
      if (!c) throw new Error("no card");
      d = Object.assign({ label: isZeroAddr(c.owner) ? "—" : shortAddr(c.owner) }, c);
    } else {
      throw new Error("no id");
    }

    // try real artwork only when the card is wrapped (others have none on-chain)
    let artNode = null;
    if (d.wrapped) {
      const img = await Promise.race([fetchCardImage(d.id), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null);
      if (img) {
        artNode = e("img", { src: img, width: 360, height: 504, style: { width: "360px", height: "504px", borderRadius: "18px", objectFit: "cover", border: "3px solid " + tierOf(d.max).color } });
      }
    }

    return new ImageResponse(buildTree(d, artNode), {
      width: 1200, height: 630,
      fonts: await loadFonts(url),
      headers: { "cache-control": "public, no-transform, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    try {
      const r = await fetch(new URL("/assets/og-image.png", url));
      return new Response(r.body, { status: 200, headers: { "content-type": "image/png", "cache-control": "public, s-maxage=300" } });
    } catch (e) { return new Response("og error", { status: 500 }); }
  }
}
