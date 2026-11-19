"use client";
import { useEffect, useRef, useState } from "react";
import { World, Ruler } from "../Sky";
import { interpolateFlight } from "@/lib/room-stream";

// A single animation clock moves every plane and the camera together. New targets
// start from the current rendered position, including mid-flight attacks/reconnects.
export function Flight({ pilots, me, onRunway, lines, max, dim, shake }) {
  const targets = Object.fromEntries(pilots.map((p) => [p.id, p.km]));
  const current = useRef(targets);
  const [positions, setPositions] = useState(targets);
  const key = JSON.stringify(targets);
  useEffect(() => {
    const target = JSON.parse(key);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target; setPositions(target); return;
    }
    const from = current.current, start = performance.now();
    let frame;
    const step = (time) => {
      const progress = Math.min(1, (time - start) / 1100);
      const next = Object.fromEntries(Object.entries(target).map(([id, value]) => [id, interpolateFlight(from[id] ?? value, value, progress)]));
      current.current = next; setPositions(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key]);
  const moving = pilots.map((p) => ({ ...p, km: positions[p.id] ?? p.km }));
  const own = moving.find((p) => p.id === me);
  const others = moving.filter((p) => p.id !== me);
  const focus = onRunway ? 0.3 : own?.km ?? Math.max(0, ...moving.map((p) => p.km));
  const marks = lines && own ? { base: lines.base, now: own.km } : null;
  return <>
    <World smooth focus={focus} me={own} others={others} lines={marks} dim={dim} shake={shake} />
    {!onRunway && <Ruler smooth max={max} me={own} others={others} lines={marks} />}
  </>;
}
