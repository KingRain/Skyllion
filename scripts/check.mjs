// Smallest self-check: tier mapping + deterministic daily prompts. Run: npm test
import assert from "node:assert/strict";
import { tierFor, zoneFor } from "../lib/tiers.js";
import { pickPrompts, PROMPTS } from "../lib/prompts.js";

assert.equal(tierFor({ valid: 0.2, clever: 0, rarity: 4 }), null);
assert.equal(tierFor({ valid: 0.9, clever: 0.9, rarity: 0 }), "roll");
assert.equal(tierFor({ valid: 0.9, clever: 0.1, rarity: 0.2 }), "paper");
assert.equal(tierFor({ valid: 0.9, clever: 0.1, rarity: 3.6 }), "skyllion");
assert.equal(tierFor({ valid: 1, clever: 0, rarity: 0.6 }), "paper"); // "chrome" for a web browser
assert.equal(tierFor({ valid: 1, clever: 0, rarity: 2.77 }), "skyllion"); // "lynx"
assert.equal(tierFor({ valid: 0.05, clever: 0.95, rarity: 2 }), "roll"); // "the cloud (icloud)" for a type of cloud
assert.equal(zoneFor(0), "On the Runway");
assert.equal(zoneFor(420), "ISS Orbit");
assert.deepEqual(pickPrompts("2026-11-16").map((p) => p.id), pickPrompts("2026-11-16").map((p) => p.id));
assert.equal(new Set(pickPrompts("x").map((p) => p.id)).size, 7);
assert.equal(new Set(PROMPTS.map((p) => p.id)).size, PROMPTS.length);
console.log("ok");

// Dogfight: settings clamp at the trust boundary, and the time-derived game clock.
import { cleanSettings, phaseAt, roomPrompts, REVEAL_S } from "../lib/rooms.js";
const s = cleanSettings({ rounds: 99, seconds: 3, maxPlayers: 1, category: "Space", public: false, name: "  " });
assert.deepEqual([s.rounds, s.seconds, s.maxPlayers, s.public, s.name], [12, 10, 2, false, "Sky race"]); // Space has 12 prompts
assert.ok(roomPrompts("seed", s).every((p) => p.cat === "Space"));
const t0 = 1_000_000, g = { rounds: 2, seconds: 10 };
assert.equal(phaseAt(null, g, t0).kind, "lobby");
assert.equal(phaseAt(t0, g, t0 - 1).kind, "countdown");
assert.deepEqual(phaseAt(t0, g, t0 + 9_999), { kind: "round", round: 0, endsAt: t0 + 10_000 });
assert.equal(phaseAt(t0, g, t0 + 10_000).kind, "reveal");
assert.equal(phaseAt(t0, g, t0 + (10 + REVEAL_S) * 1000).round, 1);
assert.equal(phaseAt(t0, g, t0 + 2 * (10 + REVEAL_S) * 1000).kind, "done");
console.log("rooms ok");
