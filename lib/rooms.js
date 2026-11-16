// Dogfight (multiplayer) rules shared by client and server.
// The game clock is derived purely from rooms.started_at, so no server process has to tick rounds.
import { PROMPTS, shuffle } from "./prompts.js";

export const REVEAL_S = 6;    // scoreboard pause after each round
export const COUNTDOWN_S = 3; // "3, 2, 1" before round 1
export const CATEGORIES = ["All", ...new Set(PROMPTS.map((p) => p.cat))];
export const DEFAULTS = { name: "Sky race", public: true, rounds: 7, seconds: 25, maxPlayers: 8, category: "All", retries: true };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const nickOf = (n) => String(n ?? "").trim().replace(/\s+/g, " ").slice(0, 20);
const clamp = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);

// Trust boundary: everything a host sends is clamped to sane values.
export function cleanSettings(s = {}) {
  const category = CATEGORIES.includes(s.category) ? s.category : "All";
  const pool = category === "All" ? PROMPTS.length : PROMPTS.filter((p) => p.cat === category).length;
  return {
    name: String(s.name ?? DEFAULTS.name).trim().slice(0, 40) || DEFAULTS.name,
    public: s.public !== false,
    rounds: clamp(s.rounds, 1, Math.min(15, pool), DEFAULTS.rounds),
    seconds: clamp(s.seconds, 10, 60, DEFAULTS.seconds),
    maxPlayers: clamp(s.maxPlayers, 2, 12, DEFAULTS.maxPlayers),
    category,
    retries: s.retries !== false,
  };
}

export function roomPrompts(seed, s) {
  const pool = s.category === "All" ? PROMPTS : PROMPTS.filter((p) => p.cat === s.category);
  return shuffle(pool, seed).slice(0, s.rounds);
}

// { kind: lobby | countdown | round | reveal | done, round, endsAt (ms) }
export function phaseAt(startedAt, s, now = Date.now()) {
  if (!startedAt) return { kind: "lobby" };
  const t0 = new Date(startedAt).getTime();
  if (now < t0) return { kind: "countdown", endsAt: t0 };
  const slot = (s.seconds + REVEAL_S) * 1000;
  const round = Math.floor((now - t0) / slot);
  if (round >= s.rounds) return { kind: "done", round: s.rounds - 1 };
  const roundEnd = t0 + round * slot + s.seconds * 1000;
  return now < roundEnd ? { kind: "round", round, endsAt: roundEnd } : { kind: "reveal", round, endsAt: t0 + (round + 1) * slot };
}

