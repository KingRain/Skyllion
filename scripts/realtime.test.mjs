import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { RoomBus } from "../lib/room-bus.js";
import { awardFor, pointsOf } from "../lib/scoring.js";
import { TIERS } from "../lib/tiers.js";
import { readRoomStream, reconnectDelay, interpolateFlight } from "../lib/room-stream.js";

test("speed decreases with submission time, preserves rarity, and caps a perfect day at 700", () => {
  for (const [tier, { pts }] of Object.entries(TIERS)) {
    assert.equal(awardFor(tier, 0, 25000).pts, pts);
    let prior = pts;
    for (let elapsed = 0; elapsed < 25000; elapsed += 137) {
      const award = awardFor(tier, elapsed, 25000);
      assert.ok(award.pts <= prior && award.pts >= Math.round(pts * .8));
      assert.equal(award.pts, award.basePts + award.speedBonus);
      prior = award.pts;
    }
    assert.equal(awardFor(tier, 25000, 25000).pts, 0);
    assert.equal(awardFor(tier, -1, 25000).pts, pts);
  }
  assert.equal(awardFor("skyllion", 0, 25000).pts * 7, 700);
  assert.ok(awardFor("deep", 24999, 25000).pts > awardFor("jet", 0, 25000).pts);
  assert.deepEqual(awardFor("jet", 5000, 10000), { pts: 54, basePts: 48, speedBonus: 6 });
  for (const elapsed of [NaN, Infinity, 26000]) assert.equal(awardFor("jet", elapsed, 25000).pts, 0);
  assert.equal(awardFor(null, 0, 25000).pts, 0);
  assert.equal(awardFor("jet", 0, 0).pts, 0);
  assert.equal(pointsOf({ tier: "jet" }), 60);
  assert.equal(pointsOf({ tier: "jet", pts: 54 }), 54);
  assert.equal(pointsOf({ tier: null, pts: 0 }), 0);
});

test("SSE parser survives byte splits, UTF-8 characters, keepalives and multiple messages", async () => {
  const bytes = new TextEncoder().encode('event: state\ndata: {"name":"pilôt ✈"}\n\n: ping\n\nevent: heartbeat\ndata: {"now":42}\n\nevent: state\ndata: {"score":54}\n\n');
  const response = new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
  const messages = [];
  await readRoomStream(response, (event, data) => messages.push([event, data]));
  assert.deepEqual(messages, [["state", { name: "pilôt ✈" }], ["heartbeat", { now: 42 }], ["state", { score: 54 }]]);
});

test("SSE errors preserve HTTP status for missing rooms and configuration errors", async () => {
  await assert.rejects(readRoomStream(Response.json({ error: "Room not found" }, { status: 404 }), () => {}), { status: 404, message: "Room not found" });
});

test("notifications cross room boundaries only by code, share a connection, and release it", async () => {
  let created = 0;
  class Client extends EventEmitter {
    async connect() {} async query(sql) { assert.equal(sql, "LISTEN skyllion_rooms"); }
    async end() { this.ended = true; }
  }
  let client;
  const bus = new RoomBus(() => { created++; return client = new Client(); });
  let a = 0, b = 0;
  const [releaseA, releaseB] = await Promise.all([
    bus.subscribe("AAA", () => a++, () => {}), bus.subscribe("BBB", () => b++, () => {}),
  ]);
  assert.equal(created, 1);
  client.emit("notification", { channel: "skyllion_rooms", payload: "AAA" });
  assert.deepEqual([a, b], [1, 0]);
  releaseA(); assert.ok(!client.ended);
  client.emit("notification", { channel: "skyllion_rooms", payload: "AAA" });
  client.emit("notification", { channel: "skyllion_rooms", payload: "BBB" });
  assert.deepEqual([a, b], [1, 1]);
  releaseB(); assert.ok(client.ended); assert.equal(bus.listeners.size, 0);
});

test("database disconnect releases subscribers and a fresh client can reconnect", async () => {
  class Client extends EventEmitter { async connect() {} async query() {} async end() {} }
  const clients = []; const bus = new RoomBus(() => { const c = new Client(); clients.push(c); return c; });
  let disconnected = 0;
  const release = await bus.subscribe("AAA", () => {}, () => disconnected++);
  clients[0].emit("error", new Error("socket closed"));
  assert.equal(disconnected, 1); assert.equal(bus.listeners.size, 0);
  release();
  const again = await bus.subscribe("AAA", () => {}, () => {});
  assert.equal(clients.length, 2); again();
});

test("failed LISTEN doesn't strand a subscription or a direct connection", async () => {
  class Client extends EventEmitter { async connect() {} async query() { throw new Error("LISTEN denied"); } async end() { this.ended = true; } }
  const c = new Client(); const bus = new RoomBus(() => c);
  await assert.rejects(bus.subscribe("AAA", () => {}, () => {}), /LISTEN denied/);
  assert.equal(bus.listeners.size, 0); assert.ok(c.ended);
});

test("flight retargeting is continuous during climbs and attacks; reconnect backoff is bounded", () => {
  assert.equal(interpolateFlight(20, 100, 0), 20);
  assert.equal(interpolateFlight(20, 100, 1), 100);
  const current = interpolateFlight(20, 100, .4);
  assert.equal(interpolateFlight(current, 30, 0), current);
  assert.ok(interpolateFlight(current, 30, .5) < current);
  assert.equal(interpolateFlight(current, 30, 1), 30);
  assert.deepEqual([0, 1, 10, 100].map(reconnectDelay), [500, 1000, 10000, 10000]);
});
