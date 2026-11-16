import { pool, q } from "@/lib/db";
import { rule } from "@/lib/nimble";
import { TIERS } from "@/lib/tiers";
import { cleanSettings, phaseAt, roomPrompts, COUNTDOWN_S, UUID, nickOf } from "@/lib/rooms";

const ACTIVE = "20 seconds"; // clients poll every ~1s; a closed tab drops out of the lobby after this

async function load(code, token) {
  const { rows: [room] } = await q("SELECT code, name, public, settings, seed, started_at FROM rooms WHERE code = $1", [code]);
  if (!room) return null;
  const { rows: players } = await q(
    `SELECT id::int, name, token, last_seen > now() - interval '${ACTIVE}' AS active FROM room_players WHERE room_code = $1 ORDER BY id`,
    [code]
  );
  const me = players.find((p) => p.token === token) || null;
  const host = players.find((p) => p.active) || players[0] || null; // earliest active player hosts
  return { room, players, me, host, phase: phaseAt(room.started_at, room.settings), prompts: roomPrompts(room.seed, room.settings) };
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

  const { rows: answers } = await q("SELECT player_id::int, round, answer, tier, pts FROM room_answers WHERE room_code = $1", [code]);
  const open = phase.kind === "round" ? phase.round : Infinity; // the in-flight round stays secret
  const shown = answers.filter((a) => a.round < open || a.player_id === me?.id);

  return Response.json({
    now: Date.now(),
    room: { code: room.code, name: room.name, public: room.public, settings: room.settings },
    phase,
    prompt: phase.round !== undefined ? prompts[phase.round] : null,
    prompts: phase.kind === "done" ? prompts : prompts.slice(0, (phase.round ?? -1) + 1),
    me: me?.id ?? null,
    host: host?.id ?? null,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.active,
      score: answers.filter((a) => a.player_id === p.id && a.round < open).reduce((s, a) => s + a.pts, 0),
      landed: phase.kind === "round" && answers.some((a) => a.player_id === p.id && a.round === phase.round),
    })),
    answers: shown,
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
      await q("UPDATE rooms SET started_at = NULL WHERE code = $1", [code]);
      return ok();
    case "answer": {
      if (!me) return err("You're not in this room", 403);
      if (phase.kind !== "round") return err("Round is closed", 409);
      const locked = await q("SELECT 1 FROM room_answers WHERE room_code = $1 AND player_id = $2 AND round = $3", [code, me.id, phase.round]);
      if (locked.rows[0]) return err("You already landed this round", 409);
      const r = await rule(prompts[phase.round].id, body.answer);
      if (r.error) return err(r.error, r.status);
      // ponytail: submission time is checked when the request arrives, so a slow model verdict can't cost the player the round.
      if (r.tier || !room.settings.retries)
        await q(
          "INSERT INTO room_answers (room_code, player_id, round, answer, tier, pts) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
          [code, me.id, phase.round, String(body.answer).trim().slice(0, 80), r.tier, r.tier ? TIERS[r.tier].pts : 0]
        );
      return ok({ tier: r.tier, locked: Boolean(r.tier || !room.settings.retries) });
    }
  }
  return err("Unknown action");
}

const ok = (x = {}) => Response.json({ ok: true, ...x });
const err = (error, status = 400) => Response.json({ error }, { status });
