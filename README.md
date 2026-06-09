# HumanityCards

A game site for **HumanityCards (HCX)**: 239 historical figures minted on a 2018
pre-standard ERC721 contract, with art generated entirely on-chain.

- **Original contract:** `0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc`
- **Wrapper (ERC-721, wHCX):** `0xf6f722590af5f791f68d0ed88d27b72dde1c70ca`

Pure static site. No framework, no build step, no `package.json`. Open
`index.html` or serve the folder with any static host.

## Structure: Collect and Play

The site is split into two sections, reflected in the nav.

### Collect

| Page | What it is |
| --- | --- |
| `packs.html` | **Pack Opening** — the mining loop reframed. Practice packs use the real remaining-supply odds; an optional on-chain path calls `mineCard()` behind a confirmation. Also lists the rarest "chase cards" with live pull odds. |
| `collection.html` | **My Collection** — on-chain holdings read from the wrapper, plus every figure pulled in practice packs. |
| `roster.html` | **Roster** — browse all 239 figures, filter by rarity, search by name, sort. |

### Play

| Page | Game | Notes |
| --- | --- | --- |
| `timeline.html` | **Timeline** | Order 5 figures by birth year. Daily seed = same puzzle for everyone. Streaks. Holding a card unlocks Hard (6) and Insane (7). |
| `battle.html` | **Battle** | Pick a stat, higher wins. Owned cards are dealt into your deck. |
| `draft.html` | **Draft Battles** | Daily category, shared draft pool, greedy AI opponent. Your owned cards join your side of the pool, tagged. |
| `assassin.html` | **Assassination** | Play a figure with a historical edge for an instant kill, else win on influence. Played with your collection when connected. |

## Owned cards in games

When a wallet holding HumanityCards is connected, those cards feed into Battle,
Draft, and Assassination. Without a wallet (or with an empty one) the games deal
random loaner cards instead. Each game page shows a badge: **Playing with your
collection** vs **Playing with random loaner cards**.

## Chain integration

- Read-only by default over `https://ethereum-rpc.publicnode.com` (swap for
  Rarible later in `assets/js/config.js`).
- Wallet connection is optional. Connecting reads ownership from the wrapper and
  unlocks holder-only features.
- The **only** state-changing call is `mineCard()` on Pack Opening, and it is
  never signed or broadcast without an explicit confirmation modal.

## Card art

`assets/js/card.js` renders cards client-side in the on-chain CardRenderer
style (500x700, near-black ground, monospace type, rarity-encoded `hsl()`
accent: hotter red = rarer). The accent curve is fitted to the real on-chain art
in `humanity-card-samples/`.

## Structure

```
index.html
packs.html  collection.html  roster.html          (Collect)
timeline.html  battle.html  draft.html  assassin.html   (Play)
assets/
  css/hc.css
  js/
    config.js          RPC, contract addresses, ABIs
    roster.js          239 figures: supply, birth year, influence, controversy
    hc.js              rarity model, colors, derived stats, RNG, nav, ownership helpers
    card.js            on-chain-styled SVG renderer + mini card + modal
    wallet.js          ethers v5 connect, ownership reads, gated mineCard()
    relationships.js   assassination edge graph
    game-*.js          one file per Play game
    page-roster.js     roster browser
    page-collection.js collection page
```

## Data note

Birth years and the influence/controversy stats are curated approximations for
gameplay, not a historical record. Derived stats (era, rarity, legacy) are
computed from on-chain supply so they stay consistent with the deck.
