import { pool, q } from "@/lib/db";
import { rule } from "@/lib/judge";
import { awardFor } from "@/lib/scoring";
import { load, standings, roomSnapshot, ACTIVE } from "@/lib/room-state";
import { publishRoom } from "@/lib/room-events";
import { cleanSettings, phaseAt, rollItem, COUNTDOWN_S, REVEAL_S, UUID, nickOf, ITEMS, BOX_CHANCE, BOX_MIN_LEFT_MS, FOG_MS } from "@/lib/rooms";

// A snapshot for initial inspection/recovery. Live clients subscribe to /stream.
export async function GET(req, { params }) {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { code } = await params;
  const state = await roomSnapshot(code, req.headers.get("x-player") || "");
  return state ? Response.json(state, { headers: { "Cache-Control": "no-store" } }) : err("Room not found", 404);
}

export async function POST(req, { params }) {
  const receivedAt = Date.now();
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const { action, token } = body;
  if (!UUID.test(token ?? "")) return err("Missing player token");
  const L = await load(code, token, receivedAt);
  if (!L) return err("Room not found", 404);
  const { room, players, me, host, phase, prompts } = L;
  const isHost = me && me.id === host?.id;

  const ok = async (x = {}) => {
    await publishRoom(code);
    return Response.json({ ok: true, ...x });
  };

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
      if (body.round !== phase.round || body.startedAt !== room.started_at.toISOString()) return err("That round has ended", 409);
      // Capture submission time before the judge/database can add latency.
      const elapsedMs = receivedAt - (new Date(room.started_at).getTime() + phase.round * (room.settings.seconds + REVEAL_S) * 1000);
      const locked = await q("SELECT 1 FROM room_answers WHERE room_code = $1 AND player_id = $2 AND round = $3", [code, me.id, phase.round]);
      if (locked.rows[0]) return err("You already landed this round", 409);
      const r = await rule(prompts[phase.round].id, body.answer);
      if (r.error) return err(r.error, r.status);
      if (r.suggest) return Response.json({ suggest: r.suggest });
      const points = awardFor(r.tier, elapsedMs, room.settings.seconds * 1000);
      let inserted = false;
      // Submission time is checked when the request arrives, so a slow model verdict can't cost the player the round.
      if (r.tier || !room.settings.retries) {
        const saved = await q(
          "INSERT INTO room_answers (room_code, player_id, round, answer, tier, pts) SELECT $1, $2, $3, $4, $5, $6 FROM rooms WHERE code = $1 AND started_at = $7 ON CONFLICT DO NOTHING RETURNING pts",
          [code, me.id, phase.round, String(body.answer).trim().slice(0, 80), r.tier, points.pts, room.started_at]
        );
        if (!saved.rows[0]) return err("This answer was already settled or the race restarted", 409);
        inserted = true;
      }
      // Mystery box: only for a quick landing, i.e. while there's still a wait for the others.
      let box = null;
      if (inserted && r.tier && phaseAt(room.started_at, room.settings).round === phase.round && players.filter((p) => p.active).length >= 2 && phase.endsAt - receivedAt >= BOX_MIN_LEFT_MS && Math.random() < BOX_CHANCE) {
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
      return ok({ tier: r.tier, ...points, locked: Boolean(r.tier || !room.settings.retries), box: Boolean(box) });
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

const err = (error, status = 400) => Response.json({ error }, { status });
