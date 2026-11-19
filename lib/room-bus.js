// One direct PostgreSQL LISTEN connection per server process, shared by its streams.
// Notifications carry only a room code. Private state is loaded per subscriber.
export class RoomBus {
  constructor(makeClient) {
    this.makeClient = makeClient;
    this.listeners = new Map();
    this.client = null;
    this.ready = null;
  }
  async subscribe(code, changed, disconnected) {
    const entry = { changed, disconnected };
    const set = this.listeners.get(code) ?? new Set();
    this.listeners.set(code, set);
    set.add(entry);
    const release = () => {
      set.delete(entry);
      if (!set.size && this.listeners.get(code) === set) this.listeners.delete(code);
      if (!this.listeners.size && this.client) {
        const client = this.client;
        this.client = null;
        this.ready = null;
        void client.end().catch(() => {});
      }
    };
    if (!this.client) {
      const client = this.makeClient();
      this.client = client;
      const fail = () => {
        if (this.client !== client) return;
        this.client = null;
        this.ready = null;
        const subscribers = [...this.listeners.values()].flatMap((s) => [...s]);
        this.listeners.clear();
        for (const sub of subscribers) sub.disconnected();
        void client.end().catch(() => {});
      };
      client.on("error", fail);
      client.on("end", fail);
      client.on("notification", ({ channel, payload }) => {
        if (channel !== "skyllion_rooms") return;
        for (const sub of this.listeners.get(payload) ?? []) sub.changed();
      });
      this.ready = (async () => { await client.connect(); await client.query("LISTEN skyllion_rooms"); })();
    }
    try { await this.ready; } catch (error) { release(); throw error; }
    return release;
  }
}
