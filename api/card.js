/* api/card.js — server-rendered page for /card/[tokenId].
 *
 * vercel.json rewrites /card/:id here. Reads the card from chain (figure name,
 * real supply / rarity, mint count, current holder + ENS) so social crawlers
 * (Twitter/Discord/Slack — no JS) get correct per-card Open Graph tags pointing
 * at /api/og-card, and humans get a tasteful standalone card view with links
 * back into the collection. Self-contained (no client JS) so it's instant and
 * can never loop against cleanUrls.
 *
 * og:title       = "[Name] - HumanityCards #[id]"
 * og:description = "Token ID #N · 1 of [supply] · Deployed March 2018 · Pre-ERC721"
 * og:image       = /api/og-card?… (1200×630)
 * twitter:card   = summary_large_image */
import { fetchCard, tierOf } from "./_lib/cards.js";
import { resolveEns } from "./_lib/eth.js";

export const config = { runtime: "edge" };

const SITE = "https://humanitycards.vercel.app";
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shortAddr = (a) => (a && a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a || "");
const isZeroAddr = (a) => /^0x0{40}$/i.test(String(a || ""));
const holderLabel = (card, label) => (isZeroAddr(card.owner) ? "—" : (label || shortAddr(card.owner)));

function buildMeta(card, label) {
  if (!card) {
    return {
      title: "HumanityCards", desc: "239 historical figures, on-chain since 2018.",
      img: SITE + "/api/og-collection", url: SITE + "/collection", card: null,
    };
  }
  const t = tierOf(card.max);
  const ownerParam = holderLabel(card, label);
  const imgQ = "id=" + card.id
    + "&name=" + encodeURIComponent(card.name)
    + "&max=" + card.max + "&mined=" + card.mined
    + "&owner=" + encodeURIComponent(ownerParam)
    + (card.wrapped ? "&wrapped=1" : "");
  return {
    title: card.name + " - HumanityCards #" + card.id,
    desc: "Token ID #" + card.id + " · 1 of " + card.max + " · Deployed March 2018 · Pre-ERC721",
    img: SITE + "/api/og-card?" + imgQ,
    url: SITE + "/card/" + card.id,
    card, label, tier: t,
  };
}

function page(m) {
  const t = esc(m.title), d = esc(m.desc), img = esc(m.img), url = esc(m.url);
  const c = m.card, tier = m.tier;
  const holder = c ? esc(holderLabel(c, m.label)) : "";
  const accent = tier ? tier.color : "#C98A4B";

  const shareText = c
    ? "From my collection:\n\n" + c.name + "\nToken ID #" + c.id + "\nHumanityCards\nDeployed March 2018, pre-ERC721\n\n" + url
    : "";
  const shareWeb = "https://x.com/intent/tweet?text=" + encodeURIComponent(shareText);

  const body = c ? `
  <main class="card-page">
    <a class="back" href="/collection">← Collection</a>
    <div class="card-hero">
      <img class="og" src="${img}" width="1200" height="630" alt="${esc(c.name)} — HumanityCards #${c.id}"/>
    </div>
    <h1>${esc(c.name)}</h1>
    <div class="tier" style="color:${accent};border-color:${accent}66;background:${accent}14">
      ${esc(tier.name.toUpperCase())} · 1 of ${c.max}
    </div>
    <dl class="facts">
      <div><dt>Token ID</dt><dd>#${c.id}</dd></div>
      <div><dt>Minted</dt><dd>${c.mined} of ${c.max}</dd></div>
      <div><dt>Held by</dt><dd>${holder}</dd></div>
      <div><dt>Status</dt><dd>${c.wrapped ? "Wrapped (wHCX)" : "Unwrapped (2018)"}</dd></div>
    </dl>
    <p class="prov">HumanityCards · Deployed March 2018 · Pre-ERC721</p>
    <div class="cta">
      <a class="btn primary" href="${esc(shareWeb)}" target="_blank" rel="noopener noreferrer">Share on 𝕏</a>
      <a class="btn" href="https://opensea.io/collection/wrappedhumanitycards" target="_blank" rel="noopener noreferrer">OpenSea ↗</a>
      <a class="btn" href="/collection">View collection</a>
    </div>
  </main>` : `
  <main class="card-page">
    <h1>Card not found</h1>
    <p class="prov">That token id isn't in the HumanityCards roster.</p>
    <div class="cta"><a class="btn primary" href="/collection">View collection</a></div>
  </main>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<meta name="theme-color" content="#0b0b0e"/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='11' y='3' width='42' height='58' rx='6' fill='%230c0d0f' stroke='%23c98a4b' stroke-width='3'/%3E%3Ctext x='32' y='41' font-family='Menlo,Consolas,monospace' font-size='24' font-weight='700' text-anchor='middle' fill='%23ece7d8'%3EH%3Ctspan fill='%23c98a4b'%3EC%3C/tspan%3E%3C/text%3E%3C/svg%3E"/>
<link rel="canonical" href="${url}"/>
<meta property="og:site_name" content="HumanityCards"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${url}"/>
<meta property="og:title" content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${t}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:image" content="${img}"/>
<style>
  :root{--bg:#0B0B0E;--card:#121216;--ink:#ECE7D8;--dim:#8A8475;--rule:#2A2925;--copper:#C98A4B;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(201,138,75,.10),var(--bg) 60%);color:var(--ink);font-family:var(--mono);-webkit-font-smoothing:antialiased;min-height:100vh}
  .card-page{max-width:760px;margin:0 auto;padding:32px 20px 64px;display:flex;flex-direction:column;align-items:center;text-align:center}
  .back{align-self:flex-start;color:var(--dim);text-decoration:none;font-size:14px;letter-spacing:.04em;margin-bottom:20px}
  .back:hover{color:var(--ink)}
  .card-hero{width:100%;border-radius:16px;overflow:hidden;border:1px solid var(--rule);box-shadow:0 40px 100px -30px #000}
  .card-hero .og{display:block;width:100%;height:auto}
  h1{font-size:clamp(28px,7vw,46px);font-weight:600;margin:28px 0 0;letter-spacing:.01em}
  .tier{display:inline-block;margin-top:14px;padding:7px 16px;border:1px solid;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.08em}
  .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);border-radius:10px;overflow:hidden;margin:28px 0 0;width:100%;max-width:520px}
  .facts>div{background:var(--card);padding:14px 16px;text-align:left}
  .facts dt{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0}
  .facts dd{margin:6px 0 0;font-size:15px;font-weight:600;color:var(--ink)}
  .prov{color:var(--dim);font-size:13px;letter-spacing:.05em;margin:22px 0 0}
  .cta{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:26px}
  .btn{font:600 14px/1 var(--mono);color:var(--ink);text-decoration:none;padding:12px 20px;border:1px solid var(--rule);border-radius:8px;transition:border-color .15s,background .15s}
  .btn:hover{border-color:var(--copper)}
  .btn.primary{background:var(--copper);color:#0b0b0e;border-color:var(--copper)}
  .btn.primary:hover{filter:brightness(1.08)}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export default async function handler(req) {
  let id = "";
  try { id = (new URL(req.url).searchParams.get("id") || "").trim(); } catch (e) {}

  let card = null, label = null;
  if (/^\d+$/.test(id)) {
    card = await fetchCard(id).catch(() => null);
    if (card && card.owner && !/^0x0{40}$/i.test(card.owner)) {
      label = await resolveEns(card.owner).catch(() => null);
    }
  }

  const html = page(buildMeta(card, label));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": card ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=60",
    },
  });
}
