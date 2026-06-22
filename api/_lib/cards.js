/* api/_lib/cards.js — read a single HumanityCard from chain (edge-safe).
 *
 * Given a token id, returns the figure name, rarity (real max supply), mint
 * count, current owner and wrapped status — everything /api/card and
 * /api/og-card need to render a per-card page + share image. Pure raw eth_call
 * over the same public RPCs the rest of the site uses; no ethers dependency.
 *
 * Card model (matches hcx-chain.js / og-collection.js):
 *   • original (pre-ERC721) contract holds the canonical card ledger:
 *       getCardInfo(tokenId)  -> (uint16 human, address owner)
 *       getHumanInfo(human)   -> (string name, uint8 max, uint256 mined)
 *   • a card owned by the WRAPPER is wrapped (wHCX, ERC721) — its live holder is
 *     wrapper.ownerOf(tokenId), and wrapper.tokenURI(tokenId) carries artwork.
 *
 * Rarity tier names mirror hcx-sets.js (mapped onto the real supply
 * distribution 1,3,5,10,20,30,50,100,200). */

const ORIG = "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc";
const WRAPPER = "0xf6f722590AF5F791f68d0ED88D27b72dDe1C70CA";
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"];
const SEL = {
  getCardInfo: "0x970129be",
  getHumanInfo: "0x1dd7cf6d",
  getHumanNumber: "0xd8c35273",
  ownerOf: "0x6352211e",
  tokenURI: "0xc87b56dd",
};

export const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const WRAP_L = WRAPPER.toLowerCase();

// rarity tiers (named scarcity) — keep in lockstep with hcx-sets.js TIERS.
const TIERS = {
  mythic:    { key: "mythic",    name: "Mythic",    color: "#E9C46A" },
  legendary: { key: "legendary", name: "Legendary", color: "#FFD700" },
  epic:      { key: "epic",      name: "Epic",      color: "#A855F7" },
  rare:      { key: "rare",      name: "Rare",      color: "#3B82F6" },
  uncommon:  { key: "uncommon",  name: "Uncommon",  color: "#63A92C" },
  common:    { key: "common",    name: "Common",    color: "#8A8475" },
};
export function tierKey(max) {
  const s = Number(max) || 0;
  if (s <= 3) return "mythic";
  if (s <= 5) return "legendary";
  if (s <= 10) return "epic";
  if (s <= 20) return "rare";
  if (s <= 50) return "uncommon";
  return "common";
}
export function tierOf(max) { return TIERS[tierKey(max)]; }
export { TIERS, WRAPPER, ORIG };

const hexid = (n) => BigInt(n).toString(16).padStart(64, "0");

async function ethCall(to, data) {
  let lastErr;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to, data }, "latest"] }),
      });
      if (!res.ok) { lastErr = new Error("rpc " + res.status); continue; }
      const j = await res.json();
      if (j.error) { lastErr = new Error(j.error.message || "rpc error"); continue; }
      return (j.result || "0x");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("rpc unreachable");
}

function words(hex) {
  hex = String(hex || "").replace(/^0x/, "");
  const w = [];
  for (let i = 0; i < hex.length; i += 64) w.push(hex.slice(i, i + 64));
  return w;
}
function hexToStr(h) {
  let s = "";
  for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}
function decCardInfo(hex) {
  const w = words(hex);
  if (w.length < 2 || /^0*$/.test(w.join(""))) return null;
  return { human: parseInt(w[0], 16), owner: "0x" + w[1].slice(24) };
}
function decHumanInfo(hex) {
  const w = words(hex);
  if (w.length < 3) return null;
  const off = parseInt(w[0], 16), max = parseInt(w[1], 16), mined = parseInt(w[2], 16);
  const len = parseInt(w[off / 32] || "0", 16);
  const raw = String(hex).replace(/^0x/, "").slice((off + 32) * 2, (off + 32) * 2 + len * 2);
  return { name: hexToStr(raw), max, mined };
}
function decAddress(hex) {
  const w = words(hex);
  if (!w.length) return null;
  const a = "0x" + w[0].slice(24);
  return ADDR_RE.test(a) ? a.toLowerCase() : null;
}

// Read a card by token id. Returns { id, human, name, max, mined, owner,
// wrapped } or null if the token doesn't exist.
export async function fetchCard(id) {
  let ci;
  try { ci = decCardInfo(await ethCall(ORIG, SEL.getCardInfo + hexid(id))); }
  catch (e) { ci = null; }
  if (!ci) return null;

  let hi = null;
  try { hi = decHumanInfo(await ethCall(ORIG, SEL.getHumanInfo + hexid(ci.human))); }
  catch (e) { hi = null; }
  if (!hi) return null;

  let owner = ci.owner, wrapped = false;
  if (owner.toLowerCase() === WRAP_L) {
    wrapped = true;
    try {
      const o = decAddress(await ethCall(WRAPPER, SEL.ownerOf + hexid(id)));
      if (o) owner = o;
    } catch (e) { /* keep wrapper as holder */ }
  }

  return { id: Number(id), human: ci.human, name: hi.name, max: hi.max, mined: hi.mined, owner, wrapped };
}

// Best-effort artwork URL from the wrapper's tokenURI metadata. Only wrapped
// cards have one; unwrapped 2018 cards return null (the OG image then draws a
// branded card). Returns an http(s)/ipfs-gateway image URL, or null.
export async function fetchCardImage(id) {
  let uri;
  try { uri = await ethCall(WRAPPER, SEL.tokenURI + hexid(id)); }
  catch (e) { return null; }
  const w = words(uri);
  if (w.length < 2) return null;
  const len = parseInt(w[1], 16);
  if (!len || len > 4096) return null;
  const raw = String(uri).replace(/^0x/, "").slice(128, 128 + len * 2);
  let s = hexToStr(raw).trim();
  if (!s) return null;
  try {
    if (s.startsWith("data:application/json")) {
      const i = s.indexOf(",");
      const body = s.slice(i + 1);
      s = s.includes(";base64,") ? atob(body) : decodeURIComponent(body);
    }
    if (s.startsWith("ipfs://")) s = "https://ipfs.io/ipfs/" + s.slice(7);
    let img = null;
    if (s.startsWith("{")) { const m = JSON.parse(s); img = m && m.image; }
    else if (/^https?:|^data:/.test(s)) img = s;          // tokenURI was the image directly
    if (!img) return null;
    if (img.startsWith("ipfs://")) img = "https://ipfs.io/ipfs/" + img.slice(7);
    // Satori only rasterises png/jpeg reliably; skip svg/other to avoid a broken card.
    if (/^https?:/.test(img) || /^data:image\/(png|jpe?g)/.test(img)) return img;
    return null;
  } catch (e) { return null; }
}
