/* scripts/seed-leaderboard.mjs — pre-populate / refresh the Historian Score
 * leaderboard with EVERY on-chain holder of HumanityCards.
 *
 * The live board (api/leaderboard-hc) only contains wallets that have visited
 * the site and published a client-computed score. This script closes that gap:
 * it enumerates the real holders straight off mainnet (original + wrapper),
 * recomputes each wallet's Historian Score with the SAME engine the browser
 * uses (assets/js/hcx-score.js, loaded here under a tiny window shim so the two
 * can never diverge), and upserts them into `historian_scores`. It also
 * reverse-resolves ENS for each wallet into `hc_profiles` so the board shows
 * names, not 0x… .
 *
 * Safe to run repeatedly (one-time seed AND periodic refresh):
 *   - New holders are inserted with a collection-only score (game points 0 —
 *     they haven't played).
 *   - Existing rows (players who DID visit and published a game-inclusive score)
 *     are never regressed: their game contribution and any game achievements are
 *     preserved; only the collection portion + total are refreshed from chain.
 *
 * Ownership algorithm mirrors assets/js/hcx-chain.js loadOwned():
 *   original.getCardInfo(tokenId) -> (human, owner)
 *     owner == you            -> unwrapped, you hold it
 *     owner == WRAPPER        -> wrapper.ownerOf(tokenId) is the real holder
 *
 * Env: TURSO_URL, TURSO_TOKEN (Vercel env — `vercel env pull` to get them).
 *      Optional HC_RPC (comma-separated RPC URLs), HC_ENS_CAP, HC_DRY=1.
 *
 * Run:  node scripts/seed-leaderboard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { turso, rows } from "../api/_lib/turso.js";
import { resolveEns, ADDR_RE } from "../api/_lib/eth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ORIG = "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc".toLowerCase();
const WRAPPER = "0xf6f722590AF5F791f68d0ED88D27b72dDe1C70CA".toLowerCase();
const ZERO = "0x0000000000000000000000000000000000000000";
const DRY = process.env.HC_DRY === "1";
const ENS_CAP = process.env.HC_ENS_CAP ? parseInt(process.env.HC_ENS_CAP, 10) : Infinity;
const ENS_TTL_MS = 24 * 3600 * 1000;

const RPCS = (process.env.HC_RPC
  ? process.env.HC_RPC.split(",")
  : ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"]
).map((s) => s.trim()).filter(Boolean);

// ---- the scoring engine, loaded from the real browser source ---------------
// data.js -> hcx-sets.js -> hcx-score.js attach to window.{HCX,HCX_SETS,HCX_SCORE}.
function loadEngine() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const f of ["assets/js/data.js", "assets/js/hcx-sets.js", "assets/js/hcx-score.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
  }
  const { HCX, HCX_SETS, HCX_SCORE } = sandbox.window;
  if (!HCX || !HCX_SETS || !HCX_SCORE) throw new Error("failed to load scoring engine");
  return { HCX, SETS: HCX_SETS, SCORE: HCX_SCORE };
}

// ---- minimal eth_call (batched) over public RPC ----------------------------
const selector = (sig) => bytesToHex(keccak_256(new TextEncoder().encode(sig))).slice(0, 8);
function bytesToHex(b) { let s = ""; for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0"); return s; }
const SEL_HUMAN = selector("getHumanInfo(uint256)");
const SEL_CARD = selector("getCardInfo(uint256)");
const SEL_OWNEROF = selector("ownerOf(uint256)");
const u256 = (n) => BigInt(n).toString(16).padStart(64, "0");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Send one JSON-RPC batch. Tries each RPC, several passes with backoff, since
// public nodes intermittently 500 / rate-limit a large batch. Returns result
// hex (no 0x) aligned to `calls` order; "" for a call that reverted / empty.
async function rpcBatch(calls, attempt = 0) {
  const payload = calls.map((c, i) => ({
    jsonrpc: "2.0", id: i, method: "eth_call",
    params: [{ to: c.to, data: "0x" + c.data }, "latest"],
  }));
  let lastErr;
  // rotate which RPC leads each attempt so a flaky node doesn't always go first
  const order = RPCS.map((_, k) => RPCS[(k + attempt) % RPCS.length]);
  for (const rpc of order) {
    try {
      const res = await fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { lastErr = new Error(rpc + " http " + res.status); continue; }
      const data = await res.json();
      if (!Array.isArray(data)) { lastErr = new Error(rpc + " non-array batch reply"); continue; }
      const out = new Array(calls.length).fill("");
      for (const r of data) {
        if (typeof r.id !== "number") continue;
        if (r.error) continue;
        out[r.id] = String(r.result || "0x").replace(/^0x/, "");
      }
      return out;
    } catch (e) { lastErr = e; }
  }
  if (attempt < 5) { await sleep(500 * (attempt + 1)); return rpcBatch(calls, attempt + 1); }
  throw lastErr || new Error("all RPCs unreachable");
}

// chunked batch helper
async function callMany(targets, chunk = 120) {
  const out = [];
  for (let i = 0; i < targets.length; i += chunk) {
    const part = await rpcBatch(targets.slice(i, i + chunk));
    out.push(...part);
    process.stdout.write(`\r    on-chain reads ${Math.min(i + chunk, targets.length)}/${targets.length}   `);
  }
  process.stdout.write("\n");
  return out;
}

const decAddr = (hex) => (hex && hex.length >= 64 ? "0x" + hex.slice(24, 64).toLowerCase() : null);

// Monday 00:00 UTC, YYYY-MM-DD — matches api/leaderboard-hc.js weekStartUTC().
function weekStartUTC() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return m.toISOString().slice(0, 10);
}

// ---- on-chain holder enumeration ------------------------------------------
async function enumerateHolders() {
  // 1. total minted = Σ getHumanInfo(i).mined over the 239 humans
  const humanCalls = [];
  for (let i = 0; i < 239; i++) humanCalls.push({ to: ORIG, data: SEL_HUMAN + u256(i) });
  console.log("  reading minted counts (239 humans)…");
  const humanRes = await callMany(humanCalls);
  let totalCards = 0;
  for (const hex of humanRes) {
    if (hex.length >= 192) totalCards += parseInt(hex.slice(128, 192), 16) || 0;
  }
  console.log(`  total cards minted on-chain: ${totalCards}`);
  if (!totalCards) throw new Error("read zero minted cards — RPC problem, aborting");

  // 2. getCardInfo(tokenId) for every minted tokenId
  const cardCalls = [];
  for (let t = 0; t < totalCards; t++) cardCalls.push({ to: ORIG, data: SEL_CARD + u256(t) });
  console.log(`  reading ownership for ${totalCards} cards…`);
  const cardRes = await callMany(cardCalls);

  // holder -> [humanId, …] (one entry per card; duplicates repeat, as the
  // scoring engine expects). Wrapped cards are resolved in step 3.
  const owned = {};        // addr -> humanId[]
  const wrapped = [];      // { tokenId, human }
  const push = (addr, human) => { (owned[addr] = owned[addr] || []).push(human); };

  cardRes.forEach((hex, t) => {
    if (hex.length < 128) return;
    const human = parseInt(hex.slice(0, 64), 16);
    const owner = decAddr(hex.slice(64, 128));
    if (!owner || owner === ZERO) return;
    if (owner === WRAPPER) wrapped.push({ tokenId: t, human });
    else push(owner, human);
  });

  // 3. resolve wrapped cards through wrapper.ownerOf(tokenId)
  if (wrapped.length) {
    console.log(`  resolving ${wrapped.length} wrapped cards via wrapper…`);
    const wCalls = wrapped.map((w) => ({ to: WRAPPER, data: SEL_OWNEROF + u256(w.tokenId) }));
    const wRes = await callMany(wCalls);
    wRes.forEach((hex, i) => {
      const owner = decAddr(hex);
      if (!owner || owner === ZERO || owner === WRAPPER) return;
      push(owner, wrapped[i].human);
    });
  }

  // drop the contracts themselves if they ever appear as holders
  delete owned[ORIG]; delete owned[WRAPPER];
  return owned;
}

// ---- existing rows: index by address so we can preserve game scores --------
function indexExisting(existingRows) {
  const byAddr = {};
  const better = (a, b) => (!a || (b.total || 0) > (a.total || 0) ? b : a);
  for (const r of existingRows) {
    const keys = new Set();
    if (r.wallet && ADDR_RE.test(r.wallet)) keys.add(r.wallet.toLowerCase());
    if (r.uid && ADDR_RE.test(r.uid)) keys.add(r.uid.toLowerCase());
    for (const k of keys) byAddr[k] = better(byAddr[k], r);
  }
  return byAddr;
}

// ---- ENS resolution with small concurrency ---------------------------------
function ensStale(row) {
  if (!row || !row.ens_updated_at) return true;
  const t = Date.parse(String(row.ens_updated_at).replace(" ", "T") + "Z");
  return !t || Date.now() - t > ENS_TTL_MS;
}
async function pool(items, n, worker) {
  let i = 0, done = 0;
  async function run() { while (i < items.length) { const idx = i++; await worker(items[idx], idx); done++;
    process.stdout.write(`\r    ENS resolved ${done}/${items.length}   `); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  if (items.length) process.stdout.write("\n");
}

async function main() {
  if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
    console.error("Missing TURSO_URL / TURSO_TOKEN. Run `vercel env pull .env` (then source it) or export them.");
    process.exit(1);
  }
  console.log(`HumanityCards leaderboard seeder${DRY ? " (DRY RUN)" : ""}`);
  console.log(`  RPC: ${RPCS.join(", ")}`);

  const { HCX, SETS, SCORE } = loadEngine();
  console.log(`  engine loaded: ${HCX.FIGURES.length} figures, ${SETS.SETS.length} sets`);

  // tables (idempotent — the API creates them too)
  await turso([
    { sql: `CREATE TABLE IF NOT EXISTS historian_scores (uid TEXT PRIMARY KEY, wallet TEXT,
            collection_score INTEGER DEFAULT 0, game_points INTEGER DEFAULT 0, achievement_points INTEGER DEFAULT 0,
            total INTEGER DEFAULT 0, unique_count INTEGER DEFAULT 0, breakdown TEXT,
            week_anchor INTEGER DEFAULT 0, week_start TEXT, updated_at TEXT)` },
    { sql: `CREATE TABLE IF NOT EXISTS hc_profiles (address TEXT PRIMARY KEY, display_name TEXT,
            ens_name TEXT, ens_updated_at TEXT, updated_at TEXT)` },
  ]);

  console.log("\nEnumerating on-chain holders…");
  const owned = await enumerateHolders();
  const holders = Object.keys(owned);
  console.log(`  ${holders.length} unique holder wallets found`);

  // existing score + profile rows (small on first run)
  const exRes = await turso([
    { sql: `SELECT uid, wallet, collection_score, game_points, achievement_points, total FROM historian_scores` },
    { sql: `SELECT address, ens_name, ens_updated_at FROM hc_profiles` },
  ]);
  const existingByAddr = indexExisting(rows(exRes[0]));
  const profByAddr = {};
  rows(exRes[1]).forEach((r) => { profByAddr[String(r.address).toLowerCase()] = r; });

  // ---- compute + upsert Historian Scores ----
  const NOW_FIXED = Date.UTC(2026, 0, 1, 12); // stable, so the time-based "Night Owl" badge never seeds true
  const stmts = [];
  const wk = weekStartUTC();
  let inserts = 0, updates = 0;

  for (const addr of holders) {
    const ownedFigs = owned[addr].map((id) => HCX.byId(id)).filter(Boolean);
    if (!ownedFigs.length) continue;
    const sc = SCORE.compute(ownedFigs, { gamePoints: 0, gameStats: {}, now: NOW_FIXED });
    let bd = JSON.stringify({
      m: sc.tiers.mythic, l: sc.tiers.legendary, e: sc.tiers.epic, r: sc.tiers.rare,
      un: sc.tiers.uncommon, c: sc.tiers.common, rank: sc.rank.title, ri: sc.rankIndex,
      sets: Object.keys(sc.completedSetIds).length,
    });
    if (bd.length > 800) bd = null;

    const ex = existingByAddr[addr];
    if (ex) {
      // preserve the player's game contribution + any game-earned achievements
      const gameContrib = Math.max(0, (ex.total || 0) - (ex.collection_score || 0) - (ex.achievement_points || 0));
      const ach = Math.max(sc.achievementPoints, ex.achievement_points || 0);
      const total = sc.collectionScore + gameContrib + ach;
      stmts.push({
        sql: `UPDATE historian_scores SET collection_score=?, achievement_points=?, total=?, unique_count=?,
              breakdown=?, wallet=COALESCE(wallet, ?), updated_at=datetime('now') WHERE uid=?`,
        args: [sc.collectionScore, ach, total, sc.uniques, bd, addr, ex.uid],
      });
      updates++;
    } else {
      stmts.push({
        sql: `INSERT INTO historian_scores
                (uid, wallet, collection_score, game_points, achievement_points, total, unique_count, breakdown, week_anchor, week_start, updated_at)
              VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(uid) DO UPDATE SET
                collection_score=excluded.collection_score, achievement_points=excluded.achievement_points,
                total=excluded.total, unique_count=excluded.unique_count, breakdown=excluded.breakdown,
                wallet=COALESCE(historian_scores.wallet, excluded.wallet), updated_at=excluded.updated_at`,
        args: [addr, addr, sc.collectionScore, sc.achievementPoints, sc.total, sc.uniques, bd, sc.total, wk],
      });
      inserts++;
    }
  }

  console.log(`\nHistorian Scores: ${inserts} new, ${updates} refreshed`);
  if (!DRY) {
    for (let i = 0; i < stmts.length; i += 40) await turso(stmts.slice(i, i + 40));
    console.log("  written to Turso ✓");
  } else {
    console.log("  (dry run — nothing written)");
  }

  // ---- ENS -> hc_profiles ----
  const need = holders.filter((a) => ensStale(profByAddr[a])).slice(0, ENS_CAP === Infinity ? undefined : ENS_CAP);
  console.log(`\nResolving ENS for ${need.length} wallets (stale/missing of ${holders.length})…`);
  let ensFound = 0;
  await pool(need, 5, async (addr) => {
    let name = null;
    try { name = await resolveEns(addr); } catch (e) { return; } // leave cache untouched on RPC error
    if (name) ensFound++;
    if (DRY) return;
    await turso([{
      sql: `INSERT INTO hc_profiles (address, ens_name, ens_updated_at, updated_at)
            VALUES (?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(address) DO UPDATE SET ens_name=excluded.ens_name, ens_updated_at=excluded.ens_updated_at`,
      args: [addr, name || null],
    }]);
  });
  console.log(`  ${ensFound} ENS names found / cached`);

  console.log(`\nDone${DRY ? " (dry run)" : ""}.`);
}

main().catch((e) => { console.error("\nSeeder failed:", e && (e.stack || e.message || e)); process.exit(1); });
