/* api/profile.js — wallet display names + ENS, backed by Turso (hc_profiles).
 *
 * Fixes the leaderboard's "0x… for everyone" problem: every wallet gets a
 * human label, resolved with this priority — ENS name > custom display name >
 * truncated address (the client does the truncation when name is null).
 *
 *   GET  ?address=0x…                  → { address, display_name, ens_name, name }
 *                                         (resolves ENS server-side if the cache
 *                                          is stale, then caches for 24h)
 *   POST { action:"set_name", address, name, message, signature }
 *                                       → set a custom display name. The caller
 *                                         must prove they control the wallet:
 *                                         `message` is signed with personal_sign
 *                                         and must recover to `address`.
 *   POST { action:"resolve", addresses:[…] }
 *                                       → batch-fill the ENS cache for board
 *                                         rows; returns a name map. Read-only
 *                                         (ENS is forward-confirmed server-side),
 *                                         so it needs no auth.
 *
 * ENS resolution is cached aggressively: resolve once, serve from Turso for 24h,
 * re-resolve on the next request after the cache expires. TURSO_URL /
 * TURSO_TOKEN are Vercel env vars. */
export const config = { runtime: "edge" };

import { turso, rows } from "./_lib/turso.js";
import { recoverPersonalSign, resolveEns, toChecksum, ADDR_RE } from "./_lib/eth.js";

// 3–20 chars: letters, numbers, space, _ - . — same charset as the games' name
// rule. Custom names that look like an address or an ENS name are rejected
// below so they can't impersonate one.
const NAME_OK = /^[A-Za-z0-9 _.-]{3,20}$/;
const ENS_TTL_HOURS = 24;
const RESOLVE_CAP = 12;          // most ENS work per /resolve call (rest fills on later visits)
const SIGN_WINDOW_MS = 10 * 60 * 1000;

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json" }, extra || {}),
  });
}

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await turso([{
    sql: `CREATE TABLE IF NOT EXISTS hc_profiles (
            address TEXT PRIMARY KEY,
            display_name TEXT,
            ens_name TEXT,
            ens_updated_at TEXT,
            updated_at TEXT
          )`,
  }]);
  schemaReady = true;
}

function corsOrigin(origin) {
  if (!origin) return null;
  let host; try { host = new URL(origin).hostname; } catch (e) { return null; }
  if (host === "humanitycards.vercel.app") return origin;
  if (host === "eth.limo" || host.endsWith(".eth.limo")) return origin;
  if (host.includes(".ipfs.")) return origin;
  return null;
}
function corsHeaders(origin) {
  const allow = corsOrigin(origin);
  if (!allow) return {};
  return {
    "Access-Control-Allow-Origin": allow, "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400",
  };
}

const norm = (a) => String(a || "").toLowerCase();
const isAddr = (a) => ADDR_RE.test(String(a || ""));
// display priority: verified ENS > custom name > null (client shows short addr)
const pick = (p) => (p && (p.ens_name || p.display_name)) || null;

// Returns true if `row` has no ENS check within the TTL.
function ensStale(row) {
  if (!row || !row.ens_updated_at) return true;
  const t = Date.parse(row.ens_updated_at.replace(" ", "T") + "Z");
  if (!t) return true;
  return (Date.now() - t) > ENS_TTL_HOURS * 3600 * 1000;
}

// Resolve ENS for `addr` and write it (or null) into the cache. Best-effort:
// an RPC failure leaves the existing cache untouched so we don't blank a name.
async function refreshEns(addr) {
  let name;
  try { name = await resolveEns(addr); } catch (e) { return undefined; }
  await turso([{
    sql: `INSERT INTO hc_profiles (address, ens_name, ens_updated_at, updated_at)
          VALUES (?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(address) DO UPDATE SET
            ens_name = excluded.ens_name,
            ens_updated_at = excluded.ens_updated_at`,
    args: [addr, name || null],
  }]);
  return name || null;
}

async function handleGet(url) {
  const address = norm(url.searchParams.get("address"));
  if (!isAddr(address)) return json({ error: "bad address" }, 400);

  const res = await turso([{ sql: "SELECT * FROM hc_profiles WHERE address = ?", args: [address] }]);
  let row = rows(res[0])[0] || null;

  // refresh ENS on a cold/stale cache, then re-read so the response is current
  if (ensStale(row)) {
    const ens = await refreshEns(address);
    if (ens !== undefined) {
      row = row || { address, display_name: null };
      row.ens_name = ens;
    }
  }

  const display_name = row ? row.display_name : null;
  const ens_name = row ? row.ens_name : null;
  return json(
    { address: toChecksum(address), display_name, ens_name, name: ens_name || display_name || null },
    200, { "cache-control": "no-store" }
  );
}

async function setName(b) {
  const address = norm(b.address);
  if (!isAddr(address)) return json({ error: "bad address" }, 400);
  const name = String(b.name == null ? "" : b.name).trim();
  if (!NAME_OK.test(name)) return json({ error: "bad name" }, 400);
  if (/^0x/i.test(name)) return json({ error: "name can't look like an address" }, 400);
  if (/\.[a-z]{2,}$/i.test(name)) return json({ error: "name can't look like an ENS name" }, 400);

  // ownership proof: personal_sign over `message` must recover to `address`,
  // and the message must bind this exact name + address + a recent timestamp.
  const message = String(b.message || "");
  const sig = String(b.signature || "");
  const recovered = recoverPersonalSign(message, sig);
  if (!recovered || recovered !== address) return json({ error: "bad signature" }, 401);
  if (message.indexOf(address) < 0 || message.indexOf(name) < 0) return json({ error: "message mismatch" }, 401);
  const tsMatch = message.match(/Time:\s*(\d{10,})/);
  const ts = tsMatch ? Number(tsMatch[1]) : 0;
  if (!ts || Math.abs(Date.now() - ts) > SIGN_WINDOW_MS) return json({ error: "signature expired" }, 401);

  await turso([{
    sql: `INSERT INTO hc_profiles (address, display_name, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(address) DO UPDATE SET
            display_name = excluded.display_name,
            updated_at = excluded.updated_at`,
    args: [address, name],
  }]);

  const res = await turso([{ sql: "SELECT * FROM hc_profiles WHERE address = ?", args: [address] }]);
  const row = rows(res[0])[0] || { display_name: name, ens_name: null };
  return json({ ok: true, address: toChecksum(address), display_name: row.display_name,
    ens_name: row.ens_name, name: pick(row) }, 200, { "cache-control": "no-store" });
}

async function batchResolve(b) {
  const list = Array.isArray(b.addresses) ? b.addresses : [];
  const seen = {}, addrs = [];
  for (const a of list) {
    const n = norm(a);
    if (isAddr(n) && !seen[n]) { seen[n] = 1; addrs.push(n); }
    if (addrs.length >= 60) break;
  }
  if (!addrs.length) return json({ names: {} }, 200, { "cache-control": "no-store" });

  // load whatever is cached, decide which need a (re)resolve
  const placeholders = addrs.map(() => "?").join(",");
  const res = await turso([{ sql: `SELECT * FROM hc_profiles WHERE address IN (${placeholders})`, args: addrs }]);
  const byAddr = {};
  rows(res[0]).forEach((r) => { byAddr[r.address] = r; });

  const stale = addrs.filter((a) => ensStale(byAddr[a])).slice(0, RESOLVE_CAP);
  await Promise.all(stale.map(async (a) => {
    const ens = await refreshEns(a);
    if (ens !== undefined) byAddr[a] = Object.assign(byAddr[a] || { address: a }, { ens_name: ens });
  }));

  const names = {};
  addrs.forEach((a) => {
    const nm = pick(byAddr[a]);
    if (nm) names[a] = nm;
  });
  return json({ names }, 200, { "cache-control": "no-store" });
}

async function handlePost(req) {
  let b; try { b = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  if (b.action === "set_name") return setName(b);
  if (b.action === "resolve") return batchResolve(b);
  return json({ error: "unknown action" }, 400);
}

export default async function handler(req) {
  const ch = corsHeaders(req.headers.get("origin"));
  try {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ch });
    await ensureSchema();
    let res;
    if (req.method === "GET") res = await handleGet(url);
    else if (req.method === "POST") res = await handlePost(req);
    else res = json({ error: "method not allowed" }, 405);
    for (const k in ch) res.headers.set(k, ch[k]);
    return res;
  } catch (e) {
    return json({ error: "server error" }, 500, ch);
  }
}
