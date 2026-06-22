/* api/_lib/eth.js — tiny Ethereum helpers for the edge functions.
 *
 * Two jobs, no wallet/ethers dependency (edge-safe, pure):
 *   1. recoverPersonalSign(message, sig) — EIP-191 personal_sign address
 *      recovery, so /api/profile can prove a caller controls a wallet before
 *      letting them set its display name.
 *   2. resolveEns(address) — ENS reverse resolution over public JSON-RPC, with
 *      the mandatory forward-confirmation step (a reverse record only counts if
 *      the name resolves back to the same address). Used to fill the ENS cache.
 *
 * Crypto comes from @noble (keccak + secp256k1); RPC is raw eth_call. */
import { keccak_256 } from "@noble/hashes/sha3.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

// ---- hex / bytes ----------------------------------------------------------
const HEX = "0123456789abcdef";
export function bytesToHex(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) s += HEX[b[i] >> 4] + HEX[b[i] & 15];
  return s;
}
export function hexToBytes(h) {
  h = String(h || "").replace(/^0x/i, "");
  if (h.length % 2) h = "0" + h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
const enc = (s) => new TextEncoder().encode(s);

export const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

// EIP-55 checksum address from a 0x-prefixed (any case) address.
export function toChecksum(addr) {
  const lower = String(addr || "").toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(lower)) return null;
  const hash = bytesToHex(keccak_256(enc(lower)));
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

// ---- personal_sign recovery (EIP-191) -------------------------------------
// Returns the lowercase 0x address that produced `sig` over `message`, or null.
export function recoverPersonalSign(message, sig) {
  try {
    const msg = enc(String(message));
    const prefixed = concat(enc("\x19Ethereum Signed Message:\n" + msg.length), msg);
    const digest = keccak_256(prefixed);

    const bytes = hexToBytes(sig);   // Ethereum wire format: r(32) ‖ s(32) ‖ v(1)
    if (bytes.length !== 65) return null;
    let v = bytes[64];
    if (v >= 27) v -= 27;            // 27/28 -> 0/1
    if (v !== 0 && v !== 1) return null;
    // @noble's "recovered" layout is recid-FIRST: recid(1) ‖ r(32) ‖ s(32).
    const recovered = new Uint8Array(65);
    recovered[0] = v;
    recovered.set(bytes.subarray(0, 64), 1);

    const point = secp256k1.Signature.fromBytes(recovered, "recovered").recoverPublicKey(digest);
    const pub = point.toBytes(false);            // 65 bytes, 0x04 || X || Y
    const addr = keccak_256(pub.subarray(1)).subarray(-20);
    return "0x" + bytesToHex(addr);
  } catch (e) {
    return null;
  }
}

// ---- ENS reverse resolution ----------------------------------------------
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const SEL_RESOLVER = "0178b8bf";   // resolver(bytes32)
const SEL_NAME = "691f3431";       // name(bytes32)
const SEL_ADDR = "3b3b57de";       // addr(bytes32)
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"];

function namehash(name) {
  let node = new Uint8Array(32);   // 0x00..00
  if (name) {
    const labels = name.split(".");
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = keccak_256(enc(labels[i]));
      node = keccak_256(concat(node, labelHash));
    }
  }
  return bytesToHex(node);
}

async function ethCall(to, data) {
  let lastErr;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
          params: [{ to, data: "0x" + data }, "latest"] }),
      });
      if (!res.ok) { lastErr = new Error("rpc " + res.status); continue; }
      const j = await res.json();
      if (j.error) { lastErr = new Error(j.error.message || "rpc error"); continue; }
      return (j.result || "0x").replace(/^0x/, "");
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("rpc unreachable");
}

function isZero(hex) { return !hex || /^0*$/.test(hex); }
function decodeAddress(hex) {
  if (!hex || hex.length < 64) return null;
  const a = "0x" + hex.slice(24, 64);
  return ADDR_RE.test(a) ? a.toLowerCase() : null;
}
// ABI-decode a single returned `string` (offset, length, data).
function decodeString(hex) {
  if (!hex || hex.length < 128) return null;
  const len = parseInt(hex.slice(64, 128), 16);
  if (!len || len > 512) return null;
  const data = hex.slice(128, 128 + len * 2);
  try { return new TextDecoder().decode(hexToBytes(data)); } catch (e) { return null; }
}

async function resolverFor(node) {
  const r = await ethCall(ENS_REGISTRY, SEL_RESOLVER + node);
  if (isZero(r)) return null;
  return decodeAddress(r);
}

// Reverse-resolve `address` to its ENS name, then forward-confirm the name
// points back at the same address. Returns the name (e.g. "julian.eth") or null.
export async function resolveEns(address) {
  const addr = String(address || "").toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(addr)) return null;

  const reverseNode = namehash(addr + ".addr.reverse");
  const reverseResolver = await resolverFor(reverseNode);
  if (!reverseResolver) return null;

  const nameHex = await ethCall(reverseResolver, SEL_NAME + reverseNode);
  const name = decodeString(nameHex);
  if (!name || !/\.[a-z0-9-]+$/i.test(name)) return null;

  // forward confirmation: name -> resolver -> addr() must equal `address`
  const fwdNode = namehash(name.toLowerCase());
  const fwdResolver = await resolverFor(fwdNode);
  if (!fwdResolver) return null;
  const fwdHex = await ethCall(fwdResolver, SEL_ADDR + fwdNode);
  const fwd = decodeAddress(fwdHex);
  if (!fwd || fwd !== "0x" + addr) return null;

  return name;
}
