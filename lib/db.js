import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

// Pooled DATABASE_URL from .env.local (written by `neon deploy`). node-postgres + attachDatabasePool per the Neon skill for Vercel.
// Null when no DB is configured, so the game still runs (no cache/stats).
export const pool = process.env.DATABASE_URL
  ? (globalThis.__skyPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }))
  : null;
if (pool) attachDatabasePool(pool);

export async function q(text, params) {
  if (!pool) return { rows: [] };
  return pool.query(text, params);
}
