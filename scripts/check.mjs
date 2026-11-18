// Smallest self-check: tier mapping + deterministic daily prompts. Run: npm test
import assert from "node:assert/strict";
import { tierFor, zoneFor } from "../lib/tiers.js";
import { correctionFrom, maxEdits } from "../lib/judge.js";
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
assert.deepEqual([3, 4, 5, 6, 7, 20].map(maxEdits), [0, 0, 1, 1, 2, 2]);
assert.equal(correctionFrom([{ answer: "brazil", exact: false, distance: 2 }]), "brazil");
assert.equal(correctionFrom([
	{ answer: "brazil", exact: false, distance: 2 },
	{ answer: "brazilia", exact: false, distance: 2 },
]), null);
assert.equal(correctionFrom([{ answer: "brazil", exact: true, distance: 0 }]), null);
console.log("ok");

import { buildAnswerIndex, normalizeAnswer, searchAnswers } from "../lib/search.js";
const answerIndex = buildAnswerIndex([
	{ answer: "Christopher Nolan", hits: 3 },
	{ answer: "Chris Evans", hits: 10 },
	{ answer: "Interstellar", hits: 1 },
	{ answer: "New York", hits: 4 },
	{ answer: "Beyonc\u00e9", hits: 2 },
	{ answer: "C++", hits: 1 },
]);
assert.equal(normalizeAnswer("  BEYONCE\u0301!  "), "beyonce");
assert.deepEqual(searchAnswers(answerIndex, "chr"), ["Chris Evans", "Christopher Nolan"]);
assert.deepEqual(searchAnswers(answerIndex, "new yor"), ["New York"]);
assert.deepEqual(searchAnswers(answerIndex, "interste"), ["Interstellar"]);
assert.deepEqual(searchAnswers(answerIndex, "beyonce"), ["Beyonc\u00e9"]);
assert.deepEqual(searchAnswers(answerIndex, "c"), []);
assert.deepEqual(searchAnswers(answerIndex, "zzz"), []);
assert.deepEqual(searchAnswers(answerIndex, "chris evans"), ["Chris Evans"]);
assert.deepEqual(searchAnswers(answerIndex, "chr", 1), ["Chris Evans"]);
const punctuationIndex = buildAnswerIndex(["C++ Language", "C# Language", "C Language"]);
assert.deepEqual(searchAnswers(punctuationIndex, "c#"), ["C# Language"]);
console.log("search ok");

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

// Mystery boxes: the leader never rolls the Thunderhead, the last place can, no Fog Bank in the final round.
import { rollItem, ITEMS } from "../lib/rooms.js";
const seq = (n) => Array.from({ length: n }, (_, i) => (i + 0.5) / n); // sweep the whole rng range
const rolls = (st, last) => new Set(seq(200).map((v) => rollItem(st, last, () => v)));
assert.ok(!rolls(0, false).has("thunder") && rolls(1, false).has("thunder"));
assert.ok(!rolls(0.4, true).has("fog") && rolls(0.4, false).has("fog"));
assert.ok([...rolls(0, false), ...rolls(0.5, false), ...rolls(1, false)].every((k) => ITEMS[k]));
console.log("items ok");

