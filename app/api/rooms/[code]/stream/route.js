import { pool, q } from "@/lib/db";
import { UUID } from "@/lib/rooms";
import { roomSnapshot } from "@/lib/room-state";
import { roomBus, listenerUrl, publishRoom } from "@/lib/room-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, { params }) {
  if (!pool) return Response.json({ error: "Multiplayer needs the database" }, { status: 503 });
  try { listenerUrl(); } catch (e) { return Response.json({ error: e.message }, { status: 503 }); }
  const { code } = await params;
  const token = req.headers.get("x-player") || "";
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return Response.json({ error: "Room not found" }, { status: 404 });
  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false, release, heartbeat, lifetime, boundary, busy = false, dirty = false, touching = false;
      const send = (event, data) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n")); } catch { stop(); }
      };
      stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat); clearTimeout(lifetime); clearTimeout(boundary);
        req.signal.removeEventListener("abort", stop);
        release?.();
        try { controller.close(); } catch { /* Transport cancellation already closed it. */ }
      };
      const refresh = async () => {
        if (closed) return;
        dirty = true;
        if (busy) return;
        busy = true;
        try {
          while (dirty && !closed) {
            dirty = false;
            const state = await roomSnapshot(code, token);
            if (closed) break;
            if (!state) { send("missing", {}); stop(); break; }
            send("state", state);
            clearTimeout(boundary);
            // Changes in time are scheduled once, independently of database notifications.
            const next = Math.min(state.phase.endsAt ?? Infinity, state.presenceExpiresAt ?? Infinity);
            if (Number.isFinite(next)) boundary = setTimeout(refresh, Math.max(25, next - Date.now() + 20));
          }
        } catch (error) {
          console.error("Room stream snapshot failed", error.message);
          send("retry", {}); stop();
        } finally { busy = false; }
      };
      const touch = async () => {
        if (closed || touching || !UUID.test(token)) return;
        touching = true;
        try {
        // Heartbeats write presence only; they do not poll or broadcast room snapshots.
        const { rows } = await q(
          "WITH prior AS (SELECT id, last_seen > now() - interval '35 seconds' AS active FROM room_players WHERE room_code = $1 AND token = $2), updated AS (UPDATE room_players SET last_seen = now() WHERE id = (SELECT id FROM prior) RETURNING id) SELECT active FROM prior WHERE EXISTS (SELECT 1 FROM updated)",
          [code, token]
        );
        if (rows[0]?.active === false) await publishRoom(code);
        } finally { touching = false; }
      };
      send("clock", { now: Date.now() });
      // Stay inside the invocation limit even if initial database setup is slow.
      lifetime = setTimeout(stop, 50000);
      req.signal.addEventListener("abort", stop, { once: true });
      try {
        // Listen BEFORE reading: a mutation during the initial snapshot is queued, never lost.
        release = await roomBus.subscribe(code, refresh, () => { send("retry", {}); stop(); });
        if (closed || req.signal.aborted) { release(); stop(); return; }
        await touch();
        await refresh();
        if (closed) return;
        heartbeat = setInterval(() => {
          send("heartbeat", { now: Date.now() });
          touch().catch(() => { send("retry", {}); stop(); });
        }, 10000);
      } catch (error) {
        console.error("Room stream connection failed", error.message);
        send("retry", {}); stop();
      }
    },
    cancel() { stop(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff",
  } });
}
