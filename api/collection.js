/* api/collection.js — server-rendered shell for /collection so that social
 * crawlers (Twitter/Discord/Slack — which don't run JS) get PER-WALLET Open
 * Graph tags pointing at the dynamic image. vercel.json rewrites /collection
 * here; humans get the exact same page (same CSS/JS) as the static
 * collection.html, only with the <head> meta resolved for ?wallet.
 *
 * Self-contained (no fetch/redirect) so it can never loop against cleanUrls.
 * Keep the <body> below in sync with collection.html — it is intentionally the
 * same shell. */

export const config = { runtime: "edge" };

const SITE = "https://humanitycards.vercel.app";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shortAddr = (a) => (a && a.length >= 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a || "");

function meta(wallet) {
  const valid = ADDR_RE.test(wallet || "");
  if (!valid) {
    return {
      title: "HumanityCards Collection Showcase",
      desc: "View any wallet's HumanityCards collection — 239 historical figures, on-chain since 2018.",
      img: SITE + "/api/og-collection",
      url: SITE + "/collection",
    };
  }
  const who = shortAddr(wallet);
  return {
    title: who + "'s HumanityCards Collection",
    desc: "A trophy case of HumanityCards — Legendary, Epic, Rare and Common figures, scored and ranked. 239 figures on-chain since 2018.",
    img: SITE + "/api/og-collection?wallet=" + encodeURIComponent(wallet),
    url: SITE + "/collection?wallet=" + encodeURIComponent(wallet),
  };
}

function page(m) {
  const t = esc(m.title), d = esc(m.desc), img = esc(m.img), url = esc(m.url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<meta name="theme-color" content="#0b0b0e"/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='11' y='3' width='42' height='58' rx='6' fill='%230c0d0f' stroke='%23c98a4b' stroke-width='3'/%3E%3Ctext x='32' y='41' font-family='Menlo,Consolas,monospace' font-size='24' font-weight='700' text-anchor='middle' fill='%23ece7d8'%3EH%3Ctspan fill='%23c98a4b'%3EC%3C/tspan%3E%3C/text%3E%3C/svg%3E"/>
<link rel="manifest" href="/manifest.json"/>
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="HCX"/>
<meta name="mobile-web-app-capable" content="yes"/>
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
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/assets/css/collection.css?v=1"/>
</head>
<body>
<header class="sc-nav">
  <div class="sc-nav-inner">
    <a class="sc-logo" href="/#home">
      <b>Humanity</b><span class="cu">Cards</span><span class="tag">HCX</span>
    </a>
    <nav class="sc-navlinks" aria-label="Primary">
      <a href="/#packs">Packs</a>
      <a href="/collection" class="active" aria-current="page">Collection</a>
      <a href="/#roster">Roster</a>
      <a href="/#play">Play</a>
    </nav>
    <span id="sc-wallet"></span>
  </div>
</header>

<main id="sc-root"></main>

<footer class="sc-footer">
  <div class="wrap">
    HumanityCards · 239 historical figures, on-chain since 2018 ·
    <a href="/#home">humanitycards</a> ·
    <a href="https://opensea.io/collection/wrappedhumanitycards" target="_blank" rel="noopener noreferrer">OpenSea ↗</a>
  </div>
</footer>

<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js" integrity="sha384-Htz1SE4Sl5aitpvFgr2j0sfsGUIuSXI6t8hEyrlQ93zflEF3a29bH2AvkUROUw7J" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="/assets/js/card-helpers.js?v=24"></script>
<script src="/assets/js/card-variants.js?v=24"></script>
<script src="/assets/js/bios.js?v=24"></script>
<script src="/assets/js/data.js?v=24"></script>
<script src="/assets/js/hcx-ui.js?v=24"></script>
<script src="/assets/js/hcx-chain.js?v=24"></script>
<script src="/assets/js/hcx-cards.js?v=24"></script>
<script src="/assets/js/hcx-showcase.js?v=1"></script>
<script src="/assets/js/sw-register.js?v=24"></script>
</body>
</html>`;
}

export default function handler(req) {
  let wallet = "";
  try { wallet = (new URL(req.url).searchParams.get("wallet") || "").trim(); } catch (e) {}
  const html = page(meta(wallet));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
