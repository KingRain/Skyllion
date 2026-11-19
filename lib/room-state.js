import { q } from "./db.js";
import { phaseAt, roomPrompts, REVEAL_S, FOG_MS } from "./rooms.js";

export const ACTIVE = "35 seconds"; // Presence heartbeat every 10s; tolerate reconnects.

export async function load(code, token, now = Date.now()) {
  const { rows: [room] } = await q("SELECT code, name, public, settings, seed, started_at FROM rooms WHERE code = $1", [code]);
  if (!room) return null;
  const { rows: players } = await q(
    `SELECT id::int, name, token, last_seen, shield_round, fog_round, last_seen > now() - interval '${ACTIVE}' AS active FROM room_players WHERE room_code = $1 ORDER BY id`,
    [code]
  );
  const me = players.find((p) => p.token === token) || null;
  const host = players.find((p) => p.active) || players[0] || null; // earliest active player hosts
  return { room, players, me, host, phase: phaseAt(room.started_at, room.settings, now), prompts: roomPrompts(room.seed, room.settings) };
}

// Scores everyone can see: answers from finished rounds + power-up effects (which land instantly).
export async function standings(code, phase) {
  const [{ rows: answers }, { rows: events }] = await Promise.all([
    q("SELECT player_id::int, round, answer, tier, pts FROM room_answers WHERE room_code = $1", [code]),
    q("SELECT id::int, round, by_player::int AS by, target::int AS target, item, pts, blocked, created_at FROM room_events WHERE room_code = $1 ORDER BY id", [code]),
  ]);
  const open = phase.kind === "round" ? phase.round : Infinity; // the in-flight round's answers stay secret
  const sum = (id, until) =>
    answers.filter((a) => a.player_id === id && a.round < until).reduce((s, a) => s + a.pts, 0) + events.filter((e) => e.target === id).reduce((s, e) => s + e.pts, 0);
  // ponytail: two attacks landing in the same instant could each be capped against the same total; the clamp hides it
  const score = (id) => Math.max(0, sum(id, open)); // what everyone sees
  const real = (id) => Math.max(0, sum(id, Infinity)); // incl. this round's hidden answer: caps damage so round-1 attacks still land
  return { answers, events, open, score, real };
}

export async function roomSnapshot(code, token) {
  const L = await load(code, token);
  if (!L) return null;
  const { room, players, me, host, phase, prompts } = L;
  const { answers, events, open, score, real } = await standings(code, phase);

  const live = phase.kind === "round" || phase.kind === "reveal";
  const { rows: [box] } = live ? await q("SELECT player_id::int, item, used_at FROM room_items WHERE room_code = $1 AND round = $2", [code, phase.round]) : { rows: [] };
  const slot = (room.settings.seconds + REVEAL_S) * 1000;
  const roundStart = live ? new Date(room.started_at).getTime() + phase.round * slot : 0;

  return {
    now: Date.now(),
    startedAt: room.started_at,
    presenceExpiresAt: Math.min(...players.filter((p) => p.active).map((p) => new Date(p.last_seen).getTime() + 35000)) || null,
    room: { code: room.code, name: room.name, public: room.public, settings: room.settings },
    phase,
    prompt: phase.round !== undefined ? prompts[phase.round] : null,
    prompts: phase.kind === "done" ? prompts : prompts.slice(0, (phase.round ?? -1) + 1),
    me: me?.id ?? null,
    myReal: me ? real(me.id) : 0, // my true altitude incl. my hidden answer and any hits
    host: host?.id ?? null,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
      score: score(p.id),
      landed: phase.kind === "round" && answers.some((a) => a.player_id === p.id && a.round === phase.round),
      shield: live && p.shield_round !== null && p.shield_round >= phase.round,
      box: Boolean(box && !box.used_at && box.player_id === p.id), // everyone sees who's holding a box, not what's in it
    })),
    answers: answers.filter((a) => a.round < open || a.player_id === me?.id),
    events: events.slice(-40).map(({ created_at, ...e }) => ({ ...e, at: new Date(created_at).getTime() })),
    item: box && me && box.player_id === me.id ? { round: phase.round, item: box.item, used: Boolean(box.used_at), deadline: roundStart + slot } : null,
    fogUntil: phase.kind === "round" && me?.fog_round === phase.round ? roundStart + FOG_MS : 0,
  };
}
