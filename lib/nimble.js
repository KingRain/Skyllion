import { q } from "./db.js";
import { tierFor } from "./tiers.js";
import { BY_ID } from "./prompts.js";
// Decision making via Ollama's System One endpoint and the local Nimble v3 decision model.
// Locally: straight to Ollama. On Vercel: through your PC's GPU gateway tunnel (scripts/gpu-gateway.mjs),
// whose current URL lives in Neon so a tunnel restart needs no redeploy.
const MODEL = process.env.NIMBLE_MODEL || "nimble-v3";
let cached = { url: null, at: 0 };

async function ollamaUrl() {
  if (process.env.OLLAMA_URL) return process.env.OLLAMA_URL;
  if (!process.env.VERCEL) return "http://127.0.0.1:11434";
  if (Date.now() - cached.at > 30_000) {
    const { rows } = await q("SELECT url FROM gpu_endpoint WHERE id = 1");
    cached = { url: rows[0]?.url ?? null, at: Date.now() };
  }
  if (!cached.url) throw new Error("GPU gateway not running (start it with `npm run gpu`)");
  return cached.url;
}

export async function judge(prompt, answer) {
  const res = await fetch(`${await ollamaUrl()}/v1/systemone`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.OLLAMA_TOKEN && { Authorization: `Bearer ${process.env.OLLAMA_TOKEN}` }) },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: MODEL,
      keep_alive: "30m",
      state: `TRIVIA PROMPT: ${prompt}\nPLAYER ANSWER: ${answer}`,
      questions: {
        valid: {
          type: "noul",
          instructions:
            "Is the player's answer a real, correct example that satisfies the prompt's category and every condition in it? Accept minor misspellings, alternate names and common aliases.",
          criteria: {
            true: "A genuine, correct answer to the prompt",
            false: "Wrong, made up, off-category, gibberish, or breaks a condition of the prompt",
          },
        },
        clever: {
          type: "noul",
          instructions:
            "Is the answer a loophole: a joke, pun, pedantic technicality or rules-lawyering answer rather than a normal example of the category?",
          criteria: { true: "A cheeky technicality or loophole", false: "A normal, sincere example" },
        },
        rarity: {
          type: "score",
          instructions: "How unusual is this answer? Imagine a thousand random people each giving one answer to the prompt.",
          criteria: [
            "The obvious answer: one of the first things most people would say",
            "Common: many people would think of it",
            "Uncommon: only a small minority would say it",
            "Obscure: needs real knowledge of the topic",
            "Extremely obscure yet delightful: almost nobody would say it",
          ],
        },
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Ollama HTTP ${res.status}`);
  const a = body.answers;
  return { valid: a.valid.noul, clever: a.clever.noul, rarity: a.rarity.score };
}

// Cached verdict for a prompt + answer: { tier } (tier null = grounded) or { error }.
// Shared by solo play and Dogfight rooms, so the same answer always gets the same ruling.

export const norm = (s) =>
  String(s).toLowerCase().normalize("NFKC").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

export async function rule(promptId, raw) {
  const prompt = BY_ID[promptId];
  const a = norm(raw ?? "");
  if (!prompt || !a || a.length > 80) return { error: "Bad request", status: 400 };

  const hit = await q("UPDATE judgments SET hits = hits + 1 WHERE prompt_id = $1 AND answer = $2 RETURNING tier", [promptId, a])
    .catch(() => ({ rows: [] }));
  if (hit.rows[0]) return { tier: hit.rows[0].tier, cached: true };

  let v;
  try {
    v = await judge(prompt.text, a);
  } catch (e) {
    return { error: `Control tower offline (Ollama / Nimble v3): ${e.message}`, status: 503 };
  }
  const tier = tierFor(v);
  await q(
    `INSERT INTO judgments (prompt_id, answer, tier, valid, clever, rarity) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (prompt_id, answer) DO UPDATE SET hits = judgments.hits + 1`,
    [promptId, a, tier, v.valid, v.clever, v.rarity]
  ).catch((e) => console.error("judgments insert failed", e.message));
  return { tier };
}
