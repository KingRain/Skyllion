import { q } from "@/lib/db";
import { today } from "@/lib/prompts";

// Records today's daily ascent and returns how it ranks. Archive/unlimited runs aren't recorded.
// ponytail: client-reported score, no anti-cheat; sign server-side judged results if a leaderboard ever matters.
// Today's field, drawn as "ghost" altitude markers during a daily ascent.
export async function GET(req) {
  const day = new URL(req.url).searchParams.get("day") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Response.json({ error: "Bad request" }, { status: 400 });
  const { rows } = await q(
    "SELECT count(*)::int AS pilots, max(score) AS best, percentile_disc(0.5) WITHIN GROUP (ORDER BY score) AS median FROM runs WHERE day = $1",
    [day]
  ).catch(() => ({ rows: [] }));
  return Response.json(rows[0] ?? { pilots: 0 });
}

export async function POST(req) {
  const { day, score } = await req.json().catch(() => ({}));
  if (day !== today() || !Number.isInteger(score) || score < 0 || score > 700)
    return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    await q("INSERT INTO runs (day, score) VALUES ($1, $2)", [day, score]);
    const { rows } = await q(
      "SELECT count(*)::int AS pilots, count(*) FILTER (WHERE score < $2)::int AS below FROM runs WHERE day = $1",
      [day, score]
    );
    const r = rows[0];
    return Response.json(r ? { pilots: r.pilots, beat: r.pilots > 1 ? Math.round((100 * r.below) / (r.pilots - 1)) : 100 } : {});
  } catch {
    return Response.json({});
  }
}
