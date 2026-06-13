/* api/scores.js — Vercel Edge Function backing the game leaderboards (Turso).
 *
 *   POST { game, score, win, meta }                    record one result
 *   POST { game, action:"sync", streak, played, wins }  one-shot localStorage sync
 *   POST { action:"set_name", name }                    set/update the player's display name
 *   GET  ?game=timeline                                 top 20 (+ caller's row/rank)
 *   GET  ?game=timeline&checkDaily=1&day=Y-M-D          has the caller played today?
 *
 * Identity is EITHER:
 *   - Google: an ID-token JWT in `Authorization: Bearer <token>` (the primary
 *     identity for games). The token is verified against Google; the `sub`
 *     claim is the user id (stored as "g:<sub>"). Email is never stored.
 *   - Wallet (legacy): a `wallet` 0x address in the body / query string. Google
 *     takes priority when both are present.
 *
 * Display names live in a `users` table (unique, case-insensitive) and are
 * joined onto the leaderboard so players show as names, never wallets/emails.
 *
 * TURSO_URL / TURSO_TOKEN / GOOGLE_CLIENT_ID are Vercel env vars; no secret
 * ever lives in the repo.
 */
export const config = { runtime: "edge" };

const GAMES = ["timeline", "battle", "draft", "assassination"];
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const DAY = /^\d{4}-\d{1,2}-\d{1,2}$/;
// 3–20 chars; letters, numbers, space, _ and - (kept tame so it can't spoof a
// rank/address or smuggle markup into the board).
const NAME_OK = /^[A-Za-z0-9 _-]{3,20}$/;
const PLACEHOLDER_CLIENT_ID = "PLACEHOLDER_GOOGLE_CLIENT_ID";

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
      requests: stmts
        .map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args || []).map(arg) } }))
        .concat([{ type: "close" }]),
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
      o[cols[i]] =
        cell.value === null ? null
        : cell.type === "integer" || cell.type === "float" ? Number(cell.value)
        : cell.value;
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

// The `users` table is additive — it never touches the existing wallet-keyed
// rows. CREATE … IF NOT EXISTS is idempotent, so first request on a warm
// instance migrates and the rest skip (guarded by `schemaReady`).
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await turso([{
    sql: `CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            google_sub TEXT,
            display_name TEXT,
            name_lower TEXT UNIQUE,
            updated_at TEXT
          )`,
  }]);
  schemaReady = true;
}

// Verify a Google ID token via the tokeninfo endpoint (no crypto needed in the
// edge runtime). Returns { sub, name, exp } or null. Results are memoised per
// warm instance so a page's checkDaily + submit + leaderboard don't each re-hit
// Google with the same token.
const tokenMemo = new Map();
async function verifyGoogle(token) {
  if (!token) return null;
  const now = Date.now();
  const cached = tokenMemo.get(token);
  if (cached) {
    if (cached.exp && cached.exp < now) { tokenMemo.delete(token); return null; }
    return cached;
  }
  let d;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
    if (!r.ok) return null;
    d = await r.json();
  } catch (e) { return null; }
  if (!d || !d.sub) return null;
  const aud = process.env.GOOGLE_CLIENT_ID;
  if (aud && aud !== PLACEHOLDER_CLIENT_ID && d.aud !== aud) return null;
  const exp = d.exp ? Number(d.exp) * 1000 : 0;
  if (exp && exp < now) return null;
  const info = { sub: String(d.sub), name: d.name || d.given_name || null, exp: exp };
  if (tokenMemo.size > 500) tokenMemo.clear();   // crude cap; tokens are short-lived anyway
  tokenMemo.set(token, info);
  return info;
}

function bearer(req) {
  const a = req.headers.get("authorization") || "";
  const m = a.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Resolve the caller's identity. Google (Bearer token) wins; wallet is the
// legacy fallback. Returns { uid, googleSub, googleName, isGoogle } or null when
// unauthenticated (or the token was present but invalid/expired).
async function identify(req, walletRaw) {
  const tok = bearer(req);
  if (tok) {
    const info = await verifyGoogle(tok);
    if (!info) return null;
    return { uid: "g:" + info.sub, googleSub: info.sub, googleName: info.name, isGoogle: true };
  }
  const wallet = String(walletRaw || "").toLowerCase();
  if (ADDR.test(wallet)) return { uid: wallet, googleSub: null, googleName: null, isGoogle: false };
  return null;
}

// The IPFS build (humanitycards.eth.limo) is a different origin than this API,
// so it needs CORS. Reflect only origins we trust: the Vercel deployment, the
// ENS gateway and its subdomains, and IPFS gateway hosts (e.g. <cid>.ipfs.dweb.link).
function corsOrigin(origin) {
  if (!origin) return null;
  let host;
  try { host = new URL(origin).hostname; } catch (e) { return null; }
  if (host === "humanitycards.vercel.app") return origin;
  if (host === "eth.limo" || host.endsWith(".eth.limo")) return origin;
  if (host.includes(".ipfs.")) return origin;
  return null;
}

function corsHeaders(origin) {
  const allow = corsOrigin(origin);
  if (!allow) return {};
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

async function handleGet(req, url) {
  const game = url.searchParams.get("game");
  const ident = await identify(req, url.searchParams.get("wallet"));

  // whoami: the caller's stored display name (used on sign-in to restore the
  // chosen name across devices / cache clears, so we don't re-prompt). Game
  // param isn't required here.
  if (url.searchParams.get("whoami")) {
    if (!ident) return json({ display_name: null }, 200, { "cache-control": "no-store" });
    const res = await turso([{ sql: "SELECT display_name FROM users WHERE uid = ?", args: [ident.uid] }]);
    const r = rows(res[0])[0];
    return json({ display_name: r ? r.display_name : null }, 200, { "cache-control": "no-store" });
  }

  if (!GAMES.includes(game)) return json({ error: "unknown game" }, 400);

  // Daily completion check: has this user already finished today's puzzle? The
  // puzzle day is the caller's LOCAL date, so it's passed in (the function runs
  // in UTC). This is the server-side guard that stops a cache clear from
  // resetting the daily — never cache it.
  if (url.searchParams.get("checkDaily")) {
    const day = url.searchParams.get("day") || "";
    if (!ident || !DAY.test(day)) return json({ alreadyPlayed: false }, 200, { "cache-control": "no-store" });
    const res = await turso([{
      sql: `SELECT d.solved, d.attempts, d.score, d.att, s.streak, s.played, s.wins
            FROM daily_results d LEFT JOIN streaks s ON s.wallet = d.wallet AND s.game = d.game
            WHERE d.wallet = ? AND d.game = ? AND d.day = ?`,
      args: [ident.uid, game, day],
    }]);
    const r = rows(res[0])[0];
    if (!r) return json({ alreadyPlayed: false }, 200, { "cache-control": "no-store" });
    let att = null;
    try { att = r.att ? JSON.parse(r.att) : null; } catch (e) {}
    return json(
      { alreadyPlayed: true, solved: !!r.solved, attempts: r.attempts, score: r.score, att: att,
        streak: r.streak, played: r.played, wins: r.wins },
      200, { "cache-control": "no-store" });
  }

  // Leaderboard. display_name comes from the users table; the board shows names
  // (or a shortened wallet on the client for legacy wallet rows), never emails.
  const stmts = [{
    sql: `SELECT l.wallet, u.display_name AS name, l.total_score, l.best_score, l.games_played, l.wins, s.streak, s.best_streak
          FROM leaderboard l
          LEFT JOIN streaks s ON s.wallet = l.wallet AND s.game = l.game
          LEFT JOIN users u ON u.uid = l.wallet
          WHERE l.game = ? ORDER BY l.total_score DESC, l.updated_at ASC LIMIT 20`,
    args: [game],
  }];
  if (ident) {
    stmts.push({
      sql: `SELECT (SELECT COUNT(*) + 1 FROM leaderboard w WHERE w.game = l.game AND w.total_score > l.total_score) AS rank,
                   l.wallet, u.display_name AS name, l.total_score, l.best_score, l.games_played, l.wins
            FROM leaderboard l LEFT JOIN users u ON u.uid = l.wallet
            WHERE l.game = ? AND l.wallet = ?`,
      args: [game, ident.uid],
    });
  }
  const res = await turso(stmts);
  // A Bearer-token "you" row varies by header (not URL), so it must not be
  // shared by the CDN. A wallet "you" row is keyed by the URL, so it can.
  const cache = bearer(req) ? "no-store" : "public, max-age=0, s-maxage=15";
  return json(
    { game, top: rows(res[0]), you: res[1] ? rows(res[1])[0] || null : null },
    200,
    { "cache-control": cache }
  );
}

async function handlePost(req) {
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  const ident = await identify(req, b.wallet);
  if (!ident) return json({ error: "auth required" }, 401);

  // Set / change the player's display name (Google identity only — wallet rows
  // show their address). Names are unique, case-insensitive.
  if (b.action === "set_name") {
    if (!ident.isGoogle) return json({ error: "sign in required" }, 401);
    const name = String(b.name == null ? "" : b.name).trim();
    if (!NAME_OK.test(name)) return json({ error: "bad name" }, 400);
    const nl = name.toLowerCase();
    const taken = await turso([{ sql: "SELECT uid FROM users WHERE name_lower = ? AND uid != ?", args: [nl, ident.uid] }]);
    if (rows(taken[0]).length) return json({ error: "name taken" }, 409);
    try {
      await turso([{
        sql: `INSERT INTO users (uid, google_sub, display_name, name_lower, updated_at)
              VALUES (?, ?, ?, ?, datetime('now'))
              ON CONFLICT(uid) DO UPDATE SET
                display_name = excluded.display_name,
                name_lower = excluded.name_lower,
                updated_at = excluded.updated_at`,
        args: [ident.uid, ident.googleSub, name, nl],
      }]);
    } catch (e) {
      // unique(name_lower) lost a race
      return json({ error: "name taken" }, 409);
    }
    return json({ ok: true, display_name: name });
  }

  const game = String(b.game || "");
  if (!GAMES.includes(game)) return json({ error: "unknown game" }, 400);

  // one-shot sync of pre-existing localStorage stats; only ever moves forward
  // (the conditional upsert refuses to regress a row that's already ahead)
  if (b.action === "sync") {
    const n = (v, max) => Math.max(0, Math.min(max, Math.trunc(Number(v) || 0)));
    const streak = n(b.streak, 100000), played = n(b.played, 1000000), wins = n(b.wins, 1000000);
    await turso([{
      sql: `INSERT INTO streaks (wallet, game, streak, best_streak, played, wins, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(wallet, game) DO UPDATE SET
              streak = excluded.streak,
              best_streak = max(best_streak, excluded.best_streak),
              played = max(played, excluded.played),
              wins = max(wins, excluded.wins),
              updated_at = excluded.updated_at
            WHERE excluded.played >= played`,
      args: [ident.uid, game, streak, streak, played, wins],
    }]);
    return json({ ok: true, synced: true });
  }

  const score = Number(b.score);
  if (!Number.isInteger(score) || score < 0 || score > 10000) return json({ error: "bad score" }, 400);
  const win = b.win ? 1 : 0;
  let meta = null;
  if (b.meta && typeof b.meta === "object") {
    meta = JSON.stringify(b.meta);
    if (meta.length > 500) return json({ error: "meta too large" }, 400);
  }

  const m = (b.meta && typeof b.meta === "object") ? b.meta : {};
  const isDaily = game === "timeline" && typeof m.day === "string" && DAY.test(m.day);

  // The daily is one-shot per user+day. If this user already has a result for
  // today (e.g. replaying after clearing the cache), don't re-score: leave
  // scores/leaderboard/streaks untouched and echo back the recorded row.
  if (isDaily) {
    const prevRes = await turso([{
      sql: "SELECT solved, attempts, score, att FROM daily_results WHERE wallet = ? AND game = ? AND day = ?",
      args: [ident.uid, game, m.day],
    }]);
    const prev = rows(prevRes[0])[0];
    if (prev) {
      let att = null;
      try { att = prev.att ? JSON.parse(prev.att) : null; } catch (e) {}
      return json({ ok: true, alreadyPlayed: true, solved: !!prev.solved, attempts: prev.attempts, score: prev.score, att: att });
    }
  }

  const stmts = [
    {
      sql: "INSERT INTO scores (wallet, game, score, win, meta) VALUES (?, ?, ?, ?, ?)",
      args: [ident.uid, game, score, win, meta],
    },
    {
      sql: `INSERT INTO leaderboard (wallet, game, total_score, best_score, games_played, wins, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
            ON CONFLICT(wallet, game) DO UPDATE SET
              total_score = total_score + excluded.total_score,
              best_score = max(best_score, excluded.best_score),
              games_played = games_played + 1,
              wins = wins + excluded.wins,
              updated_at = excluded.updated_at`,
      args: [ident.uid, game, score, score, win],
    },
  ];

  // the daily (Timeline) also lands in daily_results + streaks
  if (isDaily) {
    const attempts = Math.max(0, Math.min(10, Math.trunc(Number(m.attempts) || 0)));
    const solved = m.solved ? 1 : 0;
    const streak = Math.max(0, Math.min(100000, Math.trunc(Number(m.streak) || 0)));
    // per-attempt pip grid (compact "0/1" strings) so the completed state and
    // share card can be rebuilt server-side after a cache clear
    let att = null;
    if (Array.isArray(m.att)) {
      const g = m.att.filter((s) => typeof s === "string" && /^[01]{1,8}$/.test(s)).slice(0, 10);
      if (g.length) att = JSON.stringify(g);
    }
    stmts.push({
      sql: "INSERT OR IGNORE INTO daily_results (wallet, game, day, solved, attempts, score, att) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [ident.uid, game, m.day, solved, attempts, score, att],
    });
    stmts.push({
      sql: `INSERT INTO streaks (wallet, game, streak, best_streak, played, wins, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
            ON CONFLICT(wallet, game) DO UPDATE SET
              streak = excluded.streak,
              best_streak = max(best_streak, excluded.streak),
              played = played + 1,
              wins = wins + excluded.wins,
              updated_at = excluded.updated_at`,
      args: [ident.uid, game, streak, streak, solved],
    });
  }

  await turso(stmts);
  return json({ ok: true });
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
