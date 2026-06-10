# Final pre-deploy audit — HumanityCards

Date: 2026-06-09 · Auditor: automated browser pass (preview at 1280×800 and
375×812) + static checks. All items verified against the served site, not
just the source.

## Fixes landed in this batch

| # | Item | Status |
|---|------|--------|
| 1 | Nav logo reads **HumanityCards** (one word) | done — gap removed between the two-tone halves; footer uses the same Logo component |
| 2 | Favicon | done — inline SVG data-URI in `<head>`: black card outline, copper border, "H" parchment + "C" copper, Menlo |
| 3 | "Play history." descender clip on mobile | fixed earlier (background-clip:text only paints the padding box; `.12em` bottom padding restores descenders) — re-verified at 375px |
| 4 | HumanityCards title on landing | present — HUMANITYCARDS wordmark between the genesis badge and the hero |
| 5 | Meta tags | full set; descriptions now carry the brand line ("pre-ERC721 NFTs from 2018 on Ethereum… on-chain art") |
| 6 | Score methodology | "How scores work" modal — footer link on every page + "How are these scored?" on Battle |
| 7 | Dynamic minted-out counts | gated on `HCX_CHAIN.mintedLive()`; loading state until live data; recomputes on the re-render `refreshMinted()` triggers |
| 8 | OpenSea link | footer (all pages), landing provenance band, collection page (signed-in and signed-out) |

## Audit checklist results

- **Every page loads, zero console errors/warnings** — PASS. All 9 routes
  (`home packs collection roster play timeline battle draft assassination`)
  render with empty console at desktop and mobile.
- **Mobile 375px: no horizontal overflow, no clipping** — PASS after two
  fixes found by the sweep: the hero card fan overhung the viewport
  (now clipped via `.hero-cards { overflow: hidden }` ≤980px) and the Play
  hub tiles' fixed `120px 1fr` grid couldn't fit the nowrap buttons (single
  column ≤620px). All 9 routes now report `scrollWidth == clientWidth` at
  375px. Hero descenders verified visually.
- **External links `target="_blank"` + `rel="noopener noreferrer"`** — PASS.
  Two pack-reveal Etherscan links had `noopener` only; upgraded. DOM sweep:
  0 external links missing target/rel.
- **No hardcoded data that should be dynamic** — PASS. Minted/minted-out
  counts read live from the contract (snapshot is a labelled fallback:
  "reading live mint counts…" / `~` prefix until live). Card numbers render
  only for real on-chain token ids. Demo pulls invent no serials or hashes
  shown as real.
- **Contract addresses correct + checksummed** — PASS (verified with
  `cast to-check-sum-address`): original
  `0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc`, wrapper
  `0xf6f722590AF5F791f68d0ED88D27b72dDe1C70CA`.
- **Meta tags render** — PASS. title / description / canonical / og:site_name,
  type, url, title, description, image (+w/h/alt) / twitter:card, title,
  description, image all present in the served DOM. og-image.png (1200×630)
  served 200. ⚠ Base URL is `https://humanitycards.vercel.app/` — update
  canonical/og:url/og:image/twitter:image if the production domain differs
  (marked with a comment in index.html).
- **Favicon shows** — PASS (inline SVG data URI; card + HC monogram).
- **Nav reads "HumanityCards"** — PASS (one word; HCX chip separate).
- **vercel.json routes** — PASS for this architecture: the SPA is
  hash-routed (`/#packs` …) so no rewrites are needed; legacy `*.html`
  paths exist as real redirect stubs; `cleanUrls` on; security headers +
  CSP restrict connect-src to the three read RPCs; `/assets/*` is
  immutable-cached, which is why…
- **Cache busting** — PASS. All 14 local script tags carry `?v=9`
  (bumped this batch). Bump on every asset change before deploy.

## Known limitations (accepted)

- Wrap-flow approval detection uses `estimateGas` simulation (the 2018
  contract has no approval getter; `eth_call` is ambiguous under ethers 5.7
  which returns revert data as a successful `0x`). cloudflare-eth fabricates
  estimates for reverting calls, so it sits last in RPC failover order and a
  wrong "approved" can only lead to a caught would-revert — no transaction
  is ever sent on bad data.
- `og:image` references the committed `assets/og-image.png`; regenerate with
  `python3 pipeline/make_og_image.py` if the branding changes.
