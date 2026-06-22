/* api/leaderboard-hc.js — the Historian Score leaderboard (Turso edge function).
 *
 * The full Historian Score is computed CLIENT-side (hcx-score.js) from on-chain
 * holdings + cached game points, then published here so the board can rank it
 * without re-enumerating every wallet on the chain on every request.
 *
 *   POST { wallet, collection_score, game_points, achievement_points, total,
 *          unique_count, breakdown }   → upsert this player's score, returns rank
 *   GET  ?tab=alltime|week|collection|games&limit=50  → ranked board (+ caller's row)
 *
 * Identity mirrors /api/scores: a Google ID-token Bearer wins; a 0x wallet is
 * the fallback. The row stores the wallet for display + OG image regardless, so
 * a Google-identified player still renders with their address/avatar.
 *
 * "This Week" is the score GAINED since Monday 00:00 UTC: we anchor each row's
 * total at the start of the week and rank by (total − anchor). TURSO_URL /
 * TURSO_TOKEN / GOOGLE_CLIENT_ID are Vercel env vars. */
export const config = { runtime: "edge" };

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const PLACEHOLDER_CLIENT_ID = "PLACEHOLDER_GOOGLE_CLIENT_ID";
const TABS = { alltime: 1, week: 1, collection: 1, games: 1 };

function arg(v) {
  if (v === null || v === undefined) return { type: "null", value: null };
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  return { type: "text", value: String(v) };
}
async function turso(stmts) {
  const base = (process.env.TURSO_URL || "").replace(/^libsql:/, "https:").replace(/\/+$/, "");
  const res = await fetch(base + "/v2/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.TURSO_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: stmts.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args || []).map(arg) } })).concat([{ type: "close" }]),
    }),
  });
  if (!res.ok) throw new Error("turso http " + res.status);
  const data = await res.json();
  const out = [];
  for (const r of data.results) {
    if (r.type === "error") throw new Error(r.error && r.error.message);
    if (r.response && r.response.type === "execute") out.push(r.response.result);
  }
  return out;
}
function rows(result) {
  const cols = result.cols.map((c) => c.name);
  return result.rows.map((row) => {
    const o = {};
    row.forEach((cell, i) => {
      o[cols[i]] = cell.value === null ? null
        : cell.type === "integer" || cell.type === "float" ? Number(cell.value) : cell.value;
    });
    return o;
  });
}
function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json" }, extra || {}),
  });
}

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  // `users` is normally created by /api/scores; create it here too so the
  // LEFT JOIN below can never fail if this endpoint is hit first on a cold DB.
  await turso([
    { sql: `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, google_sub TEXT, display_name TEXT, name_lower TEXT UNIQUE, updated_at TEXT)` },
  ]);
  await turso([{
    sql: `CREATE TABLE IF NOT EXISTS historian_scores (
            uid TEXT PRIMARY KEY,
            wallet TEXT,
            collection_score INTEGER DEFAULT 0,
            game_points INTEGER DEFAULT 0,
            achievement_points INTEGER DEFAULT 0,
            total INTEGER DEFAULT 0,
            unique_count INTEGER DEFAULT 0,
            breakdown TEXT,
            week_anchor INTEGER DEFAULT 0,
            week_start TEXT,
            updated_at TEXT
          )`,
  }]);
  schemaReady = true;
}

// Google token verification (tokeninfo endpoint — no crypto in edge).
const tokenMemo = new Map();
async function verifyGoogle(token) {
  if (!token) return null;
  const now = Date.now();
  const cached = tokenMemo.get(token);
  if (cached) { if (cached.exp && cached.exp < now) { tokenMemo.delete(token); return null; } return cached; }
  let d;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
    if (!r.ok) return null; d = await r.json();
  } catch (e) { return null; }
  if (!d || !d.sub) return null;
  const aud = process.env.GOOGLE_CLIENT_ID;
  if (aud && aud !== PLACEHOLDER_CLIENT_ID && d.aud !== aud) return null;
  const exp = d.exp ? Number(d.exp) * 1000 : 0;
  if (exp && exp < now) return null;
  const info = { sub: String(d.sub), exp };
  if (tokenMemo.size > 500) tokenMemo.clear();
  tokenMemo.set(token, info);
  return info;
}
function bearer(req) { const a = req.headers.get("authorization") || ""; const m = a.match(/^Bearer\s+(.+)$/i); return m ? m[1].trim() : null; }
async function identify(req, walletRaw) {
  const tok = bearer(req);
  if (tok) { const info = await verifyGoogle(tok); if (!info) return null; return { uid: "g:" + info.sub, isGoogle: true }; }
  const wallet = String(walletRaw || "").toLowerCase();
  if (ADDR.test(wallet)) return { uid: wallet, isGoogle: false };
  return null;
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
  return { "Access-Control-Allow-Origin": allow, "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" };
}

// Monday 00:00 UTC of the current week, as YYYY-MM-DD.
function weekStartUTC() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;             // 0 = Monday
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return m.toISOString().slice(0, 10);
}

const N = (v, max) => Math.max(0, Math.min(max, Math.trunc(Number(v) || 0)));

async function handlePost(req) {
  let b; try { b = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  const ident = await identify(req, b.wallet);
  if (!ident) return json({ error: "auth required" }, 401);

  const wallet = ADDR.test(String(b.wallet || "").toLowerCase()) ? String(b.wallet).toLowerCase() : null;
  const collection = N(b.collection_score, 100000000);
  const game = N(b.game_points, 100000000);
  const ach = N(b.achievement_points, 100000000);
  const total = N(b.total, 1000000000);
  const uniq = N(b.unique_count, 100000);
  let bd = null;
  if (b.breakdown && typeof b.breakdown === "object") { bd = JSON.stringify(b.breakdown); if (bd.length > 800) bd = null; }
  const wk = weekStartUTC();

  // read the existing row so we can roll the weekly anchor forward on a new week
  const prevRes = await turso([{ sql: "SELECT total, week_anchor, week_start FROM historian_scores WHERE uid = ?", args: [ident.uid] }]);
  const prev = rows(prevRes[0])[0];
  let weekAnchor = 0, weekStart = wk;
  if (prev) {
    if (prev.week_start === wk) { weekAnchor = prev.week_anchor || 0; }
    else { weekAnchor = prev.total || 0; }            // new week → anchor at last week's total
  } else {
    weekAnchor = total;                                // brand-new row starts the week flat
  }

  await turso([{
    sql: `INSERT INTO historian_scores
            (uid, wallet, collection_score, game_points, achievement_points, total, unique_count, breakdown, week_anchor, week_start, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(uid) DO UPDATE SET
            wallet = COALESCE(excluded.wallet, historian_scores.wallet),
            collection_score = excluded.collection_score,
            game_points = excluded.game_points,
            achievement_points = excluded.achievement_points,
            total = excluded.total,
            unique_count = excluded.unique_count,
            breakdown = excluded.breakdown,
            week_anchor = excluded.week_anchor,
            week_start = excluded.week_start,
            updated_at = excluded.updated_at`,
    args: [ident.uid, wallet, collection, game, ach, total, uniq, bd, weekAnchor, weekStart],
  }]);

  const rankRes = await turso([{ sql: "SELECT COUNT(*) + 1 AS rank FROM historian_scores WHERE total > ?", args: [total] }]);
  const rank = rows(rankRes[0])[0];
  return json({ ok: true, rank: rank ? rank.rank : null }, 200, { "cache-control": "no-store" });
}

// metric expression for a given tab, parameterised on the week-start arg
// (only the "week" tab consumes the ? — caller supplies it for that tab only).
function metricExpr(tab, alias) {
  const a = alias || "h";
  if (tab === "collection") return `${a}.collection_score`;
  if (tab === "games") return `${a}.game_points`;
  if (tab === "week") return `(CASE WHEN ${a}.week_start = ? THEN MAX(${a}.total - ${a}.week_anchor, 0) ELSE 0 END)`;
  return `${a}.total`;
}

async function handleGet(req, url) {
  const tab = TABS[url.searchParams.get("tab")] ? url.searchParams.get("tab") : "alltime";
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit"), 10) || 50));
  const wk = weekStartUTC();
  const ident = await identify(req, url.searchParams.get("wallet"));
  const isWeek = tab === "week";
  const weeklyCol = `(CASE WHEN h.week_start = ? THEN MAX(h.total - h.week_anchor, 0) ELSE 0 END)`;
  const metric = metricExpr(tab, "h");

  // top N. Args (in order): weeklyCol's ?, metric's ? (week only), limit.
  const topArgs = [wk];
  if (isWeek) topArgs.push(wk);
  topArgs.push(limit);
  const top = await turso([{
    sql: `SELECT h.wallet, u.display_name AS name, h.total, h.collection_score, h.game_points,
                 h.achievement_points, h.unique_count, h.breakdown,
                 ${weeklyCol} AS weekly, ${metric} AS metric
          FROM historian_scores h LEFT JOIN users u ON u.uid = h.uid
          ORDER BY metric DESC, h.total DESC, h.updated_at ASC LIMIT ?`,
    args: topArgs,
  }]);

  let you = null;
  if (ident) {
    // caller's row (with its metric value), then a simple count for the rank
    const meArgs = [wk]; if (isWeek) meArgs.push(wk); meArgs.push(ident.uid);
    const meRes = await turso([{
      sql: `SELECT h.wallet, u.display_name AS name, h.total, h.collection_score, h.game_points,
                   h.achievement_points, h.unique_count, h.breakdown,
                   ${weeklyCol} AS weekly, ${metric} AS metric
            FROM historian_scores h LEFT JOIN users u ON u.uid = h.uid WHERE h.uid = ?`,
      args: meArgs,
    }]);
    you = rows(meRes[0])[0] || null;
    if (you) {
      const cntArgs = isWeek ? [wk, you.metric] : [you.metric];
      const cntRes = await turso([{
        sql: `SELECT COUNT(*) + 1 AS rank FROM historian_scores h WHERE ${metric} > ?`,
        args: cntArgs,
      }]);
      const rk = rows(cntRes[0])[0];
      you.rank = rk ? rk.rank : null;
    }
  }

  const cache = bearer(req) ? "no-store" : "public, max-age=0, s-maxage=120";
  return json({ tab, top: rows(top[0]), you }, 200, { "cache-control": cache });
}

export default async function handler(req) {
  const ch = corsHeaders(req.headers.get("origin"));
  try {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: ch });
    await ensureSchema();
    let res;
    if (req.method === "GET") res = await handleGet(req, url);
    else if (req.method === "POST") res = await handlePost(req);
    else res = json({ error: "method not allowed" }, 405);
    for (const k in ch) res.headers.set(k, ch[k]);
    return res;
  } catch (e) {
    return json({ error: "server error" }, 500, ch);
  }
}
