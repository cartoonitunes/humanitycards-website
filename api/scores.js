/* api/scores.js — Vercel Edge Function backing the game leaderboards (Turso).
 *
 *   POST { wallet, game, score, win, meta }                    record one result
 *   POST { wallet, game, action:"sync", streak, played, wins } one-shot localStorage sync
 *   GET  ?game=timeline[&wallet=0x…]                           top 20 (+ caller's row/rank)
 *
 * Auth (v1): the connected wallet address IS the identity — no signature yet.
 * TURSO_URL / TURSO_TOKEN are Vercel env vars; the token never lives in the repo.
 */
export const config = { runtime: "edge" };

const GAMES = ["timeline", "battle", "draft", "assassination"];
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const DAY = /^\d{4}-\d{1,2}-\d{1,2}$/;

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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

async function handleGet(url) {
  const game = url.searchParams.get("game");
  const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
  if (!GAMES.includes(game)) return json({ error: "unknown game" }, 400);

  const stmts = [{
    sql: `SELECT l.wallet, l.total_score, l.best_score, l.games_played, l.wins, s.streak, s.best_streak
          FROM leaderboard l LEFT JOIN streaks s ON s.wallet = l.wallet AND s.game = l.game
          WHERE l.game = ? ORDER BY l.total_score DESC, l.updated_at ASC LIMIT 20`,
    args: [game],
  }];
  if (ADDR.test(wallet)) {
    stmts.push({
      sql: `SELECT (SELECT COUNT(*) + 1 FROM leaderboard w WHERE w.game = l.game AND w.total_score > l.total_score) AS rank,
                   l.wallet, l.total_score, l.best_score, l.games_played, l.wins
            FROM leaderboard l WHERE l.game = ? AND l.wallet = ?`,
      args: [game, wallet],
    });
  }
  const res = await turso(stmts);
  return json(
    { game, top: rows(res[0]), you: res[1] ? rows(res[1])[0] || null : null },
    200,
    { "cache-control": "public, max-age=0, s-maxage=15" }
  );
}

async function handlePost(req) {
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  const wallet = String(b.wallet || "").toLowerCase();
  if (!ADDR.test(wallet)) return json({ error: "bad wallet" }, 400);
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
      args: [wallet, game, streak, streak, played, wins],
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

  const stmts = [
    {
      sql: "INSERT INTO scores (wallet, game, score, win, meta) VALUES (?, ?, ?, ?, ?)",
      args: [wallet, game, score, win, meta],
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
      args: [wallet, game, score, score, win],
    },
  ];

  // the daily (Timeline) also lands in daily_results + streaks
  const m = (b.meta && typeof b.meta === "object") ? b.meta : {};
  if (game === "timeline" && typeof m.day === "string" && DAY.test(m.day)) {
    const attempts = Math.max(0, Math.min(10, Math.trunc(Number(m.attempts) || 0)));
    const solved = m.solved ? 1 : 0;
    const streak = Math.max(0, Math.min(100000, Math.trunc(Number(m.streak) || 0)));
    stmts.push({
      sql: "INSERT OR IGNORE INTO daily_results (wallet, game, day, solved, attempts, score) VALUES (?, ?, ?, ?, ?, ?)",
      args: [wallet, game, m.day, solved, attempts, score],
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
      args: [wallet, game, streak, streak, solved],
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
