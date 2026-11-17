import { waitUntil } from "@vercel/functions";
import { q } from "./db.js";
import { tierFor } from "./tiers.js";
import { BY_ID } from "./prompts.js";
// Decision making via Cloudflare Workers AI (clef-flash), which speaks the System One question format.
// Needs CF_ACCOUNT_ID and CF_API_TOKEN in the environment (.env.local locally, project env on Vercel).
const MODEL = process.env.CF_MODEL || "clef-flash";

export async function judge(prompt, answer) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/cloudflare/${MODEL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: MODEL,
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
  if (!res.ok || !body.success) throw new Error(body.errors?.[0]?.message || `Cloudflare HTTP ${res.status}`);
  const a = body.result.answers;
  return { valid: a.valid.noul, clever: a.clever.noul, rarity: a.rarity.score };
}


export const norm = (s) =>
  String(s).toLowerCase().normalize("NFKC").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

// Max typo distance worth suggesting a fix for: none for short words (too many real near-neighbours, e.g. mali/bali),
// 1 up to 6 chars (chile/china is 2), then 2 so a swapped pair ("vitenam") still finds "vietnam".
export const maxEdits = (len) => (len < 5 ? 0 : len < 7 ? 1 : 2);

// Identical answers judged at the same moment (Dogfight rounds) share one model call.
const inflight = new Map();

// Verdict for a prompt + answer: { tier } (null = grounded), { suggest } (a close spelling already judged valid), or { error }.
// One query covers the exact cache hit and the "did you mean" lookup; the model is only called on a miss.
// force = the player rejected the suggestion, so skip it and ask the model.
export async function rule(promptId, raw, force = false) {
  const prompt = BY_ID[promptId];
  const a = norm(raw ?? "");
  if (!prompt || !a || a.length > 80) return { error: "Bad request", status: 400 };

  // ponytail: levenshtein scans this prompt's rows via the PK prefix; fine into the thousands per prompt, add a pg_trgm index past that.
  const { rows: [hit] } = await q(
    `SELECT answer, tier, answer = $2 AS exact FROM judgments
     WHERE prompt_id = $1 AND (answer = $2 OR ($3 > 0 AND tier IS NOT NULL AND levenshtein(answer, $2) <= $3))
     ORDER BY answer = $2 DESC, levenshtein(answer, $2), hits DESC LIMIT 1`,
    [promptId, a, force ? 0 : maxEdits(a.length)]
  ).catch(() => ({ rows: [] }));
  if (hit?.exact) {
    waitUntil(q("UPDATE judgments SET hits = hits + 1 WHERE prompt_id = $1 AND answer = $2", [promptId, a]).catch(() => {}));
    return { tier: hit.tier, cached: true };
  }
  if (hit) return { suggest: hit.answer };

  // The entry lives until the verdict is saved, so a repeat answer on this instance never pays for a second model call.
  const key = `${promptId}|${a}`;
  let p = inflight.get(key);
  if (!p) {
    p = judge(prompt.text, a);
    inflight.set(key, p);
    waitUntil(p.then((v) => q(
      `INSERT INTO judgments (prompt_id, answer, tier, valid, clever, rarity) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (prompt_id, answer) DO UPDATE SET hits = judgments.hits + 1`,
      [promptId, a, tierFor(v), v.valid, v.clever, v.rarity]
    )).catch((e) => console.error("judge/save failed", e.message)).finally(() => inflight.delete(key)));
  }
  let v;
  try {
    v = await p;
  } catch (e) {
    return { error: `Control tower offline (Cloudflare clef-flash): ${e.message}`, status: 503 };
  }
  const tier = tierFor(v);
  return { tier };
}
