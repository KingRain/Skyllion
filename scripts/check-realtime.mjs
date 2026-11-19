// Exercises real HTTP streams and PostgreSQL notifications with a disposable private room.
// No model calls: the test creates and removes its own temporary cached verdict.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { readRoomStream } from "../lib/room-stream.js";

const base = process.argv[2] || "http://localhost:3001";
const db = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
const host = randomUUID(), guest = randomUUID(), viewer = randomUUID();
const controllers = [], tasks = [];
let code, cachedPrompt, cachedAnswer;
async function command(token, body, status = 200, path = "/api/rooms/" + code) {
  const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) });
  const json = await res.json(); assert.equal(res.status, status, JSON.stringify(json)); return json;
}
function watch(token) {
  const controller = new AbortController(); controllers.push(controller);
  const seen = []; const pending = new Set(); let failure;
  const task = (async () => {
    const res = await fetch(base + "/api/rooms/" + code + "/stream", { headers: { "x-player": token }, signal: controller.signal });
    await readRoomStream(res, (event, state) => {
      if (event === "retry") throw new Error("Stream requested reconnect during test");
      if (event !== "state") return;
      seen.push(state);
      for (const w of pending) if (w.test(state)) { clearTimeout(w.timer); pending.delete(w); w.resolve(state); }
    });
  })().catch((e) => { if (!controller.signal.aborted) { failure = e; for (const w of pending) { clearTimeout(w.timer); w.reject(e); } pending.clear(); } });
  tasks.push(task);
  return { seen, stop: () => controller.abort(), until(test, timeout = 15000) {
    if (failure) return Promise.reject(failure);
    const found = seen.findLast(test); if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const entry = { test, resolve, reject, timer: setTimeout(() => { pending.delete(entry); reject(new Error("Timed out waiting for pushed room state: " + test)); }, timeout) };
      pending.add(entry);
    });
  } };
}
try {
  await db.connect();
  const created = await command(host, { nick: "Stream test host", settings: { public: false, rounds: 1, seconds: 10 } }, 200, "/api/rooms");
  code = created.code;
  const a = watch(host), b = watch(guest), spectator = watch(viewer);
  await Promise.all([a.until((s) => s.phase.kind === "lobby"), b.until((s) => s.phase.kind === "lobby"), spectator.until((s) => s.phase.kind === "lobby")]);
  await command(guest, { action: "join", nick: "Stream test guest" });
  const [joined, guestState] = await Promise.all([a.until((s) => s.players.length === 2), b.until((s) => s.players.length === 2)]);
  const hostId = joined.me, guestId = guestState.me;
  assert.notEqual(hostId, guestId); assert.equal(guestState.host, hostId);
  assert.equal(JSON.stringify(joined).includes(host), false); assert.equal(JSON.stringify(joined).includes(guest), false);
  await command(guest, { action: "start" }, 403);
  await command(host, { action: "start" });
  await Promise.all([a.until((s) => s.phase.kind === "countdown"), b.until((s) => s.phase.kind === "countdown")]);
  const round = await a.until((s) => s.phase.kind === "round");
  await b.until((s) => s.phase.kind === "round");
  cachedPrompt = round.prompt.id; cachedAnswer = "realtime-check-" + randomUUID();
  await db.query("INSERT INTO judgments (prompt_id, answer, tier, valid, clever, rarity) VALUES ($1, $2, 'jet', 1, 0, 1.8)", [cachedPrompt, cachedAnswer]);
  const answer = { action: "answer", round: 0, startedAt: round.startedAt, answer: cachedAnswer };
  await command(host, { ...answer, round: 999 }, 409);
  await command(host, { ...answer, startedAt: new Date(0).toISOString() }, 409);
  // Concurrent answers must settle exactly once even when both see an unlocked round.
  const duplicates = await Promise.all([0, 1].map(async () => {
    const res = await fetch(base + "/api/rooms/" + code, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: host, ...answer }) });
    return { status: res.status, body: await res.json() };
  }));
  assert.deepEqual(duplicates.map((r) => r.status).sort(), [200, 409]);
  const result = duplicates.find((r) => r.status === 200).body;
  assert.ok(result.pts >= 48 && result.pts <= 60); assert.equal(result.pts, result.basePts + result.speedBonus);
  const landed = await b.until((s) => s.players.some((p) => p.id === hostId && p.landed));
  assert.equal(landed.answers.some((x) => x.player_id === hostId), false);
  assert.equal(landed.players.find((p) => p.id === hostId).score, 0);
  const own = await a.until((s) => s.myReal === result.pts);
  assert.equal(own.answers[0].pts, result.pts);
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate a slower player.
  const slower = await command(guest, answer);
  assert.ok(slower.pts < result.pts, JSON.stringify({ result, slower }));
  await a.until((s) => s.players.some((p) => p.id === guestId && p.landed));
  console.log("ok: notification delivery, shared rounds, private answers, submission scoring, atomic duplicate rejection");

  await db.query("UPDATE room_players SET fog_round = 0 WHERE id = $1", [guestId]);
  await db.query("SELECT pg_notify('skyllion_rooms', $1)", [code]);
  const fogged = await b.until((s) => s.fogUntil > 0);
  assert.ok(fogged.fogUntil > 0);
  assert.equal(a.seen.at(-1).fogUntil, 0);

  // A second SQL session can invalidate room streams on other server instances.
  await db.query("DELETE FROM room_items WHERE room_code = $1", [code]);
  await db.query("INSERT INTO room_items (room_code, round, player_id, item) VALUES ($1, 0, $2, 'tailwind')", [code, hostId]);
  await db.query("SELECT pg_notify('skyllion_rooms', $1)", [code]);
  await a.until((s) => s.item?.item === "tailwind");
  const concealed = await b.until((s) => s.players.find((p) => p.id === hostId)?.box);
  assert.equal(concealed.item, null);
  await command(host, { action: "use" });
  await Promise.all([a.until((s) => s.myReal === result.pts + 20), b.until((s) => s.events.some((e) => e.item === "tailwind"))]);
  await command(host, { action: "use" }, 409);
  b.stop();
  const resumed = watch(guest);
  const recovered = await resumed.until((s) => s.me === guestId && s.myReal === slower.pts);
  assert.equal(recovered.answers.some((x) => x.player_id === hostId), false);
  await Promise.all([a.until((s) => s.phase.kind === "reveal"), resumed.until((s) => s.phase.kind === "reveal")]);
  const revealed = await spectator.until((s) => s.phase.kind === "reveal");
  assert.equal(revealed.me, null); assert.equal(revealed.answers.length, 2);
  assert.equal(revealed.players.find((p) => p.id === hostId).score, result.pts + 20);
  console.log("ok: cross-connection notifications, power-up privacy, exactly-once power-ups, reconnect and scheduled reveal");
  await a.until((s) => s.phase.kind === "done");
  await command(host, { action: "reset" });
  const reset = await resumed.until((s) => s.phase.kind === "lobby" && s.startedAt === null && s.players.length === 2);
  assert.equal(reset.answers.length, 0); assert.ok(reset.players.every((p) => p.score === 0));
  await command(host, answer, 409);
  await command(host, { action: "leave" });
  await resumed.until((s) => s.host === guestId && s.players.length === 1);
  console.log("ok: scheduled finish, reset, stale-answer rejection and host handover");
} finally {
  for (const c of controllers) c.abort();
  await Promise.allSettled(tasks);
  if (code) await db.query("DELETE FROM rooms WHERE code = $1", [code]);
  if (cachedPrompt && cachedAnswer) await db.query("DELETE FROM judgments WHERE prompt_id = $1 AND answer = $2", [cachedPrompt, cachedAnswer]);
  await db.end();
}
