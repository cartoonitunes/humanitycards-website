# HumanityCards

A game site for **HumanityCards (HCX)**: 239 historical figures minted as fully
on-chain cards on a 2018 pre-standard Ethereum contract.

- **Original contract:** `0xbc9b96e7aa6afea664f9d5fdda168518ee20f2cc`
- **Deployed:** 13 March 2018 (pre–ERC-721)

This is a faithful vanilla-JS implementation of the Claude Design prototype. No
framework, no build step, no `package.json`. It is a single-page app with hash
routing — open `index.html` or serve the folder with any static host.

## Architecture

The site was prototyped in React (Babel standalone) and ported to plain DOM. The
data and on-chain card generators are reused verbatim from the design bundle; the
React components were rewritten as vanilla functions over a tiny hyperscript
helper (`h()` in `hcx-ui.js`) that mirrors `React.createElement`.

```
index.html                         SPA shell: design's <style> (keyframes,
                                   pack CSS, responsive) + script chain
assets/js/
  card-helpers.js   (design)       on-chain-safe SVG primitives (guilloche, grain)
  card-variants.js  (design)       the Ledger card SVG generator
  bios.js           (design)       role + one-line bio per figure
  data.js           (design)       239-figure catalogue + game data (window.HCX)
  hcx-ui.js                        h() runtime, palette, wallet+router stores, Btn/Stat/…
  hcx-cards.js                     Card / CardBack / ScarcityBadge / CardGrid
  hcx-nav.js                       Nav (mobile burger), Footer
  hcx-landing.js                   hero, provenance band, stat bar, COLLECT/PLAY
  hcx-pack.js                      the 6-stage Pack Opener (the star feature)
  hcx-collection.js                My Collection, Roster, detail modal, filters
  hcx-games.js                     Play hub, Timeline, Battle, Draft, Assassination
  hcx-components.js                System (component library) + Mobile frame view
  hcx-app.js                       router + wallet wiring + mount
```

The old per-page files (`packs.html`, `timeline.html`, …) are kept as redirect
stubs that forward to the matching hash route (e.g. `packs.html` → `/#packs`).

## Routes

- `#home` — landing: "Play history.", provenance, COLLECT + PLAY
- `#packs` — Pack Opening: sealed → tear → suspense → flip → celebrate → details,
  with effects (glow, rays, gold shower, flash, confetti) scaling to scarcity
- `#collection` — My Collection (wallet-gated, demo connect toggle)
- `#roster` — all 239, search + filter + sort + paginate
- `#play` — game hub
- `#timeline` — daily, login-gated, Wordle-style (4 tries, streaks, countdown)
- `#battle` — 1v1 stat duel vs the house
- `#draft` — five-figure council for the day's category
- `#assassination` — play figures bound by history to strike a council
- `#components` — design system; `#mobile` — phone-frame previews

## Design notes

- Scarcity is spoken in **supply counts only** (`1 OF 1` … `1 OF 50`), never
  tiers. The card accent ink interpolates continuously toward vermilion as a
  figure grows scarcer (`card-helpers.js` `rarity()`).
- The game is called **Battle** — there is no "Top Trumps" anywhere.
- Wallet connect is a demo toggle (persisted to `localStorage`); games run on
  random cards, or your owned deck (`window.HCX.OWNED`) when connected.
