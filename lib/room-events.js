import { Client } from "pg";
import { q } from "./db.js";
import { RoomBus } from "./room-bus.js";

export function listenerUrl() {
  const value = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!value) throw new Error("Multiplayer needs the database");
  if (new URL(value).hostname.includes("-pooler")) throw new Error("Live rooms need DATABASE_URL_UNPOOLED (a direct PostgreSQL connection)");
  return value;
}
export const roomBus = globalThis.__skyRoomBus ??= new RoomBus(() => new Client({
  connectionString: listenerUrl(), connectionTimeoutMillis: 10000, query_timeout: 10000,
  keepAlive: true, application_name: "skyllion-room-events",
}));
export async function publishRoom(code) {
  await q("SELECT pg_notify('skyllion_rooms', $1)", [code]);
}
