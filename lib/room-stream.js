// Fetch-based SSE keeps the private browser token in a header, never in URLs.
export async function readRoomStream(response, onEvent) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || "Unable to connect to the tower"), { status: response.status });
  }
  if (!response.body) throw new Error("Streaming is unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let at;
      while ((at = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        const lines = frame.split("\n");
        const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
        if (event && data) onEvent(event, JSON.parse(data));
      }
      if (buffer.length > 1000000) throw new Error("Room update is too large");
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function reconnectDelay(attempt) {
  return Math.min(10000, 500 * 2 ** Math.min(attempt, 5));
}

export function interpolateFlight(from, to, progress) {
  const p = Math.min(1, Math.max(0, progress));
  return from + (to - from) * (1 - (1 - p) ** 3);
}
