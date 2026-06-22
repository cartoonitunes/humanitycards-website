/* api/_lib/turso.js — minimal Turso HTTP (v2 pipeline) client, shared by the
 * newer edge functions. Mirrors the inlined helper in scores.js /
 * leaderboard-hc.js; TURSO_URL / TURSO_TOKEN are Vercel env vars. */

function arg(v) {
  if (v === null || v === undefined) return { type: "null", value: null };
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  return { type: "text", value: String(v) };
}

export async function turso(stmts) {
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

export function rows(result) {
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
