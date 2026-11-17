import { pool, q } from "@/lib/db";
import { rule } from "@/lib/judge";
import { TIERS } from "@/lib/tiers";
import { cleanSettings, phaseAt, roomPrompts, rollItem, COUNTDOWN_S, REVEAL_S, UUID, nickOf, ITEMS, BOX_CHANCE, BOX_MIN_LEFT_MS, FOG_MS } from "@/lib/rooms";

const ACTIVE = "20 seconds"; // clients poll every ~1s; a closed tab drops out of the lobby after this

async function load(code, token) {
  const { rows: [room] } = await q("SELECT code, name, public, settings, seed, started_at FROM rooms WHERE code = $1", [code]);
  if (!room) return null;
  const { rows: players } = await q(
    `SELECT id::int, name, token, shield_round, fog_round, last_seen > now() - interval '${ACTIVE}' AS active FROM room_players WHERE room_code = $1 ORDER BY id`,
    [code]
  );
  const me = players.find((p) => p.token === token) || null;
  const host = players.find((p) => p.active) || players[0] || null; // earliest active player hosts
  return { room, players, me, host, phase: phaseAt(room.started_at, room.settings), prompts: roomPrompts(room.seed, room.settings) };
}

// Scores everyone can see: answers from finished rounds + power-up effects (which land instantly).
async function standings(code, phase) {
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

// Polled by every client in the room: full room state, with answers hidden until their round ends.
export async function GET(req, { params }) {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { code } = await params;
  const token = req.headers.get("x-player") || "";
  if (UUID.test(token)) await q("UPDATE room_players SET last_seen = now() WHERE room_code = $1 AND token = $2", [code, token]);
  const L = await load(code, token);
  if (!L) return Response.json({ error: "Room not found" }, { status: 404 });
  const { room, players, me, host, phase, prompts } = L;
  const { answers, events, open, score, real } = await standings(code, phase);

  const live = phase.kind === "round" || phase.kind === "reveal";
  const { rows: [box] } = live ? await q("SELECT player_id::int, item, used_at FROM room_items WHERE room_code = $1 AND round = $2", [code, phase.round]) : { rows: [] };
  const slot = (room.settings.seconds + REVEAL_S) * 1000;
  const roundStart = live ? new Date(room.started_at).getTime() + phase.round * slot : 0;

  return Response.json({
    now: Date.now(),
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
  });
}

export async function POST(req, { params }) {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, token } = body;
  if (!UUID.test(token ?? "")) return err("Missing player token");
  const L = await load(code, token);
  if (!L) return err("Room not found", 404);
  const { room, players, me, host, phase, prompts } = L;
  const isHost = me && me.id === host?.id;

  switch (action) {
    case "join": {
      const name = nickOf(body.nick);
      if (!name) return err("Pick a call sign first");
      if (me) {
        await q("UPDATE room_players SET name = $3, last_seen = now() WHERE room_code = $1 AND token = $2", [code, token, name]);
        return ok();
      }
      if (phase.kind !== "lobby") return err("That race already took off. Wait for the next one.", 409);
      if (players.filter((p) => p.active).length >= room.settings.maxPlayers) return err("Room is full", 409);
      await q("INSERT INTO room_players (room_code, token, name) VALUES ($1, $2, $3) ON CONFLICT (room_code, token) DO NOTHING", [code, token, name]);
      return ok();
    }
    case "leave":
      await q("DELETE FROM room_players WHERE room_code = $1 AND token = $2", [code, token]);
      return ok();
    case "kick":
      if (!isHost) return err("Only the host can do that", 403);
      if (body.playerId === me.id) return err("You can't kick yourself");
      await q("DELETE FROM room_players WHERE room_code = $1 AND id = $2", [code, body.playerId]);
      return ok();
    case "settings": {
      if (!isHost || phase.kind !== "lobby") return err("Only the host can change settings in the lobby", 403);
      const s = cleanSettings(body.settings);
      await q("UPDATE rooms SET name = $2, public = $3, settings = $4 WHERE code = $1", [code, s.name, s.public, s]);
      return ok();
    }
    case "start":
      if (!isHost || phase.kind !== "lobby") return err("Only the host can start from the lobby", 403);
      // Drop players who closed their tab, then light the engines after a short countdown.
      await q(`DELETE FROM room_players WHERE room_code = $1 AND last_seen < now() - interval '${ACTIVE}'`, [code]);
      // Stamped with the app server's clock, the same clock phaseAt() reads, so DB clock drift can't shift rounds.
      await q("UPDATE rooms SET started_at = $2, seed = $3 WHERE code = $1", [code, new Date(Date.now() + COUNTDOWN_S * 1000), crypto.randomUUID()]);
      return ok();
    case "reset":
      if (!isHost || phase.kind !== "done") return err("Only the host can restart a finished race", 403);
      await q("DELETE FROM room_answers WHERE room_code = $1", [code]);
      await q("DELETE FROM room_items WHERE room_code = $1", [code]);
      await q("DELETE FROM room_events WHERE room_code = $1", [code]);
      await q("UPDATE room_players SET shield_round = NULL, fog_round = NULL WHERE room_code = $1", [code]);
      await q("UPDATE rooms SET started_at = NULL WHERE code = $1", [code]);
      return ok();
    case "answer": {
      if (!me) return err("You're not in this room", 403);
      if (phase.kind !== "round") return err("Round is closed", 409);
      const locked = await q("SELECT 1 FROM room_answers WHERE room_code = $1 AND player_id = $2 AND round = $3", [code, me.id, phase.round]);
      if (locked.rows[0]) return err("You already landed this round", 409);
      const r = await rule(prompts[phase.round].id, body.answer, body.force === true);
      if (r.error) return err(r.error, r.status);
      if (r.suggest) return Response.json({ suggest: r.suggest }); // not a landing: the player picks a spelling first
      // ponytail: submission time is checked when the request arrives, so a slow model verdict can't cost the player the round.
      if (r.tier || !room.settings.retries)
        await q(
          "INSERT INTO room_answers (room_code, player_id, round, answer, tier, pts) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
          [code, me.id, phase.round, String(body.answer).trim().slice(0, 80), r.tier, r.tier ? TIERS[r.tier].pts : 0]
        );
      // Mystery box: only for a quick landing, i.e. while there's still a wait for the others.
      let box = null;
      if (r.tier && players.filter((p) => p.active).length >= 2 && phase.endsAt - Date.now() >= BOX_MIN_LEFT_MS && Math.random() < BOX_CHANCE) {
        const { score } = await standings(code, phase);
        const mine = score(me.id), rivals = players.filter((p) => p.id !== me.id);
        const standing = rivals.filter((p) => score(p.id) > mine).length / Math.max(1, rivals.length);
        const item = rollItem(standing, phase.round === room.settings.rounds - 1);
        const got = await q("INSERT INTO room_items (room_code, round, player_id, item) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING item", [code, phase.round, me.id, item]);
        if (got.rows[0]) {
          box = item;
          await q("INSERT INTO room_events (room_code, round, by_player, target, item, created_at) VALUES ($1, $2, $3, $3, 'box', $4)", [code, phase.round, me.id, new Date()]);
        }
      }
      return ok({ tier: r.tier, locked: Boolean(r.tier || !room.settings.retries), box: Boolean(box) });
    }
    case "use": {
      if (!me) return err("You're not in this room", 403);
      if (phase.kind !== "round" && phase.kind !== "reveal") return err("Too late, the box expired", 409);
      const { rows: [it] } = await q("SELECT item FROM room_items WHERE room_code = $1 AND round = $2 AND player_id = $3 AND used_at IS NULL", [code, phase.round, me.id]);
      if (!it) return err("No mystery box to use", 409);
      const def = ITEMS[it.item];
      const { score, real } = await standings(code, phase);
      const rivals = players.filter((p) => p.id !== me.id);
      let target = null;
      if (def.target === "pilot" || def.target === "ahead") {
        target = rivals.find((p) => p.id === body.target);
        if (!target) return err("Pick a pilot to target");
        if (def.target === "ahead" && !(score(target.id) > score(me.id))) return err("Slipstream only works on a pilot above you");
      }
      if (def.target === "leader") {
        target = [...rivals].sort((a, b) => score(b.id) - score(a.id))[0];
        if (!target) return err("No one to strike");
      }
      // Claim the box first (atomic), so a double-click can't fire it twice.
      const claimed = await q("UPDATE room_items SET used_at = now(), target = $4 WHERE room_code = $1 AND round = $2 AND player_id = $3 AND used_at IS NULL RETURNING 1", [code, phase.round, me.id, target?.id ?? null]);
      if (!claimed.rows[0]) return err("Box already used", 409);
      const ev = (tgt, item, pts = 0, blocked = false) =>
        // stamped with the app clock (like started_at) so the feed's 'recent' window can't be skewed by DB clock drift
        q("INSERT INTO room_events (room_code, round, by_player, target, item, pts, blocked, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [code, phase.round, me.id, tgt, item, pts, blocked, new Date()]);

      if (def.hostile) {
        const shielded = await q("UPDATE room_players SET shield_round = NULL WHERE id = $1 AND shield_round >= $2 RETURNING 1", [target.id, phase.round]);
        if (shielded.rows[0]) { await ev(target.id, it.item, 0, true); return ok({ blocked: true }); }
      }
      switch (it.item) {
        case "missile":
        case "thunder":
          await ev(target.id, it.item, -Math.min(def.dmg, real(target.id)));
          break;
        case "slip": {
          const amt = Math.min(def.amt, real(target.id));
          await ev(target.id, "slip", -amt);
          await ev(me.id, "slip+", amt); // score-only row, not shown in the feed
          break;
        }
        case "fog":
          await q("UPDATE room_players SET fog_round = $2 WHERE id = $1", [target.id, phase.round + 1]);
          await ev(target.id, "fog");
          break;
        case "tailwind":
          await ev(me.id, "tailwind", def.gain);
          break;
        case "shield":
          await q("UPDATE room_players SET shield_round = $2 WHERE id = $1", [me.id, phase.round + 1]);
          await ev(me.id, "shield");
          break;
      }
      return ok({ used: it.item });
    }
  }
  return err("Unknown action");
}

const ok = (x = {}) => Response.json({ ok: true, ...x });
const err = (error, status = 400) => Response.json({ error }, { status });
