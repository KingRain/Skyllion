import { pool, q } from "@/lib/db";
import { cleanSettings, UUID, nickOf } from "@/lib/rooms";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Public lobbies that still have someone in them and a free seat.
export async function GET() {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { rows } = await q(
    `SELECT r.code, r.name, r.settings, count(p.id)::int AS players
       FROM rooms r JOIN room_players p ON p.room_code = r.code AND p.last_seen > now() - interval '20 seconds'
      WHERE r.public AND r.started_at IS NULL AND r.created_at > now() - interval '3 hours'
      GROUP BY r.code
     HAVING count(p.id) < (r.settings->>'maxPlayers')::int
      ORDER BY r.created_at DESC LIMIT 30`
  );
  return Response.json({ rooms: rows });
}

// Create a room; the creator joins as host.
export async function POST(req) {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  const { token, nick, settings } = await req.json().catch(() => ({}));
  const name = nickOf(nick);
  if (!UUID.test(token ?? "") || !name) return Response.json({ error: "Pick a call sign first" }, { status: 400 });
  const s = cleanSettings(settings);

  for (let i = 0; i < 5; i++) {
    const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    const made = await q(
      "INSERT INTO rooms (code, name, public, settings, seed) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING code",
      [code, s.name, s.public, s, crypto.randomUUID()]
    );
    if (!made.rows[0]) continue;
    await q("INSERT INTO room_players (room_code, token, name) VALUES ($1, $2, $3)", [code, token, name]);
    return Response.json({ code });
  }
  return Response.json({ error: "Couldn't allocate a room code, try again" }, { status: 500 });
}
