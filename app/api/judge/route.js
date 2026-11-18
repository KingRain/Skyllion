import { rule } from "@/lib/judge";

export async function POST(req) {
  const { promptId, answer } = await req.json().catch(() => ({}));
  const r = await rule(promptId, answer);
  return Response.json(r.error ? { error: r.error } : r, { status: r.status || 200 });
}
