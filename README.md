# HumanityCards

A game site for **HumanityCards (HCX)**: 239 historical figures minted on a 2018
pre-standard ERC721 contract, with art generated entirely on-chain.

- **Original contract:** `0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc`
- **Wrapper (ERC-721, wHCX):** `0xf6f722590af5f791f68d0ed88d27b72dde1c70ca`

Pure static site. No framework, no build step, no `package.json`. Open
`index.html` or serve the folder with any static host.

## Games

| Page | Game | Notes |
| --- | --- | --- |
| `timeline.html` | **Timeline** | Order 5 figures by birth year. Daily seed = same puzzle for everyone. Streaks. Holding a card unlocks Hard (6) and Insane (7). |
| `battle.html` | **Top Trumps Battle** | Pick a stat, beat the AI. Owned cards fold into your deck. |
| `packs.html` | **Pack Opening** | The mining loop reframed. Practice packs use the real remaining-supply odds; an optional on-chain path calls `mineCard()` behind a confirmation. |
| `draft.html` | **Draft Battles** | Daily category, shared draft pool, greedy AI opponent. |
| `assassin.html` | **Assassination** | Play a figure with a historical edge for an instant kill, else win on influence. |

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
index.html  timeline.html  battle.html  packs.html  draft.html  assassin.html
assets/
  css/hc.css
  js/
    config.js          RPC, contract addresses, ABIs
    roster.js          239 figures: supply, birth year, influence, controversy
    hc.js              rarity model, colors, derived stats, RNG, helpers
    card.js            on-chain-styled SVG card renderer
    wallet.js          ethers v5 connect, ownership reads, gated mineCard()
    relationships.js   assassination edge graph
    game-*.js          one file per game
```

## Data note

Birth years and the influence/controversy stats are curated approximations for
gameplay, not a historical record. Derived stats (era, rarity, legacy) are
computed from on-chain supply so they stay consistent with the deck.
