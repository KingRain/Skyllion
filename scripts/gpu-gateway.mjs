// Exposes ONLY the Nimble v3 judge on this machine's GPU to the deployed app.
//   npm run gpu
// 1. A tiny gateway on 127.0.0.1:11500 that accepts only POST /v1/systemone with the shared bearer token,
//    forces the Nimble model, and forwards to the local Ollama (raw Ollama would let anyone pull/delete models).
// 2. A Cloudflare quick tunnel to that gateway (no account needed, new URL each run).
// 3. Publishes the tunnel URL to Neon (gpu_endpoint), so Vercel picks it up without a redeploy.
import http from "node:http";
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import pg from "pg";

const TOKEN = process.env.GPU_TOKEN || "";
const OLLAMA = process.env.OLLAMA_LOCAL || "http://127.0.0.1:11434";
const MODEL = process.env.NIMBLE_MODEL || "nimble-v3";
const PORT = 11500;
const MAX_BODY = 64 * 1024; // System One's own local text limit
if (TOKEN.length < 32) throw new Error("GPU_TOKEN missing or too short (see .env.gpu)");

const authed = (h = "") => {
  const a = Buffer.from(h), b = Buffer.from(`Bearer ${TOKEN}`);
  return a.length === b.length && timingSafeEqual(a, b);
};
const send = (res, status, obj) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(obj));

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/systemone") return send(res, 404, { error: "not found" });
    if (!authed(req.headers.authorization)) return send(res, 401, { error: "unauthorized" });
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > MAX_BODY) return send(res, 413, { error: "too large" });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "bad json" }); }
    body.model = MODEL; // the tunnel can never be used to run any other model
    try {
      const r = await fetch(`${OLLAMA}/v1/systemone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      res.writeHead(r.status, { "Content-Type": "application/json" }).end(await r.text());
    } catch (e) {
      send(res, 502, { error: `local Ollama unreachable: ${e.message}` });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`gateway  127.0.0.1:${PORT} -> ${OLLAMA} (${MODEL})`));

// ponytail: quick tunnel URL changes per run; a named Cloudflare tunnel on your own domain makes it permanent.
const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`]);
let published = false;
const watch = async (buf) => {
  const url = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url || published) return;
  published = true;
  console.log(`tunnel   ${url}`);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
  await db.connect();
  await db.query(
    `INSERT INTO gpu_endpoint (id, url, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, updated_at = now()`,
    [url]
  );
  await db.end();
  console.log("published to Neon. The deployed app now judges on this GPU. Keep this window open.");
};
tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);
tunnel.on("exit", (c) => { console.error(`cloudflared exited (${c})`); process.exit(1); });
process.on("SIGINT", () => { tunnel.kill(); process.exit(0); });
