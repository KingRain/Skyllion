"use client";
import { useEffect, useRef, useState } from "react";
import { readRoomStream, reconnectDelay } from "@/lib/room-stream";

export function useRoomStream(code, token) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const clock = useRef(null);
  useEffect(() => {
    let disposed = false, controller, retry, attempt = 0, hasState = false, fatal = false;
    clock.current = null;
    setState(null); setMissing(false); setError(""); setStatus("connecting");
    const connect = async () => {
      clearTimeout(retry);
      controller?.abort();
      const active = new AbortController(); controller = active;
      const sentAt = performance.now();
      let watchdog;
      const healthy = () => { clearTimeout(watchdog); watchdog = setTimeout(() => active.abort(), 25000); };
      healthy();
      setStatus(hasState ? "reconnecting" : "connecting");
      try {
        const response = await fetch("/api/rooms/" + code + "/stream", {
          headers: { "x-player": token }, cache: "no-store", signal: active.signal,
        });
        if (disposed || active.signal.aborted) return;
        await readRoomStream(response, (event, data) => {
          if (disposed || active.signal.aborted) return;
          healthy();
          if (event === "clock" && !clock.current) clock.current = { server: data.now, local: (sentAt + performance.now()) / 2 };
          if (event === "state") {
            if (!clock.current) clock.current = { server: data.now, local: performance.now() };
            setState(data); setStatus("live"); setError(""); setMissing(false); hasState = true; attempt = 0;
          }
          if (event === "missing") { fatal = true; setMissing(true); active.abort(); }
          if (event === "retry") active.abort();
        });
      } catch (e) {
        if (!disposed && !active.signal.aborted) {
          if (e.status === 404) { fatal = true; setMissing(true); }
          if (e.status === 503) { fatal = true; setError(e.message); }
        }
      } finally {
        clearTimeout(watchdog);
        if (!disposed && !fatal && controller === active) {
          setStatus("reconnecting");
          retry = setTimeout(connect, reconnectDelay(attempt++) + Math.random() * 200);
        }
      }
    };
    const resume = () => { if (!disposed && !fatal && document.visibilityState === "visible" && navigator.onLine) void connect(); };
    const tick = setInterval(() => {
      if (clock.current) setNow(clock.current.server + performance.now() - clock.current.local);
    }, 100);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    void connect();
    return () => {
      disposed = true; controller?.abort(); clearTimeout(retry); clearInterval(tick);
      window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume);
    };
  }, [code, token]);
  return { state, now, status, error, missing };
}
