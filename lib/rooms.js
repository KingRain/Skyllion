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


// ---------------- Mystery boxes (Dogfight power-ups) ----------------
// A pilot who lands an answer with time to spare may find a box (at most one per room per round, so the
// first to land gets the first roll). Items are weighted by standing like a kart racer: the leader gets
// defence, the pack gets attacks, the back of the field gets the big equalisers. Unused boxes expire
// when the next round starts.
export const BOX_CHANCE = 0.45;
export const BOX_MIN_LEFT_MS = 6000;
export const FOG_MS = 6000;
export const ITEMS = {
  missile:  { name: "Homing Missile", sprite: "missile", color: "#ff4f5e", target: "pilot",  hostile: true, dmg: 20, desc: "Hit any pilot for −20 km" },
  thunder:  { name: "Thunderhead",    sprite: "bolt",    color: "#ffd166", target: "leader", hostile: true, dmg: 35, desc: "Lightning strikes the highest pilot: −35 km" },
  tailwind: { name: "Tailwind",       sprite: "wind",    color: "#5ce1ff", target: "self",   gain: 20, desc: "A gust lifts you +20 km" },
  shield:   { name: "Flak Shield",    sprite: "shield",  color: "#4dc3ff", target: "self",   desc: "Blocks the next attack, through next round" },
  slip:     { name: "Slipstream",     sprite: "slip",    color: "#62e48b", target: "ahead",  hostile: true, amt: 15, desc: "Steal 15 km from a pilot above you" },
  fog:      { name: "Fog Bank",       sprite: "fog",     color: "#c9d4ea", target: "pilot",  hostile: true, desc: "Blind a pilot's next prompt for 6 s" },
};
const ODDS = [
  // [max standing (0 = leader, 1 = last), weights]
  [0,   { shield: 40, tailwind: 35, missile: 25 }],
  [0.5, { missile: 30, tailwind: 25, slip: 20, shield: 15, fog: 10 }],
  [1,   { thunder: 30, slip: 25, missile: 20, tailwind: 15, fog: 10 }],
];
// standing: share of other pilots strictly ahead of you (0 = leading or tied for the lead).
export function rollItem(standing, lastRound, rnd = Math.random) {
  const table = { ...ODDS.find(([max]) => standing <= max)[1] };
  if (lastRound) delete table.fog; // nothing left to fog
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (const [k, w] of Object.entries(table)) if ((r -= w) < 0) return k;
  return Object.keys(table)[0];
}
