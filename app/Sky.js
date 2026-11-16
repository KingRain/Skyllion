"use client";
// The shared pixel-art sky: one very tall world (runway → atmosphere layers → space) that a camera glides up,
// plus the HUD, altitude ruler and the rarity-scaled "landed" effects. Used by solo play and Dogfight.
import { useEffect, useState } from "react";
import PX from "@/lib/px.json";
import { TIERS, GROUNDED, zoneFor } from "@/lib/tiers";

// ---------- altitude → world pixels (piecewise, so the thin lower layers still get room) ----------
export const GROUND = 560; // tall enough that the runway fills the bottom of any screen at take-off
const ANCHORS = [[0, 0], [1, 520], [12, 1500], [50, 2700], [85, 3700], [100, 4500], [408, 6400], [600, 7800], [700, 8800], [1500, 10600]];
export const WORLD_H = GROUND + 10600 + 600;
export function yOf(km) {
  const k = Math.max(0, km);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [k0, y0] = ANCHORS[i - 1], [k1, y1] = ANCHORS[i];
    if (k <= k1) return y0 + ((y1 - y0) * (k - k0)) / (k1 - k0);
  }
  return ANCHORS.at(-1)[1];
}

// Banded (stepped) sky gradient, pixel-art style, built once.
const SKY_COLORS = [[0, "#bfe9ff"], [1, "#8fd0ff"], [12, "#5aa6f0"], [50, "#2f5fc8"], [85, "#2b2a8a"], [100, "#1b1255"], [408, "#0d0c2e"], [700, "#070818"], [1500, "#03040b"]];
const mix = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const SKY = (() => {
  const stops = [];
  for (let i = 1; i < SKY_COLORS.length; i++) {
    const [k0, c0] = SKY_COLORS[i - 1], [k1, c1] = SKY_COLORS[i];
    const y0 = yOf(k0), y1 = yOf(k1), n = 6;
    for (let b = 0; b < n; b++) stops.push(`${mix(c0, c1, b / n)} ${GROUND + y0 + ((y1 - y0) * b) / n}px ${GROUND + y0 + ((y1 - y0) * (b + 1)) / n}px`);
  }
  return `linear-gradient(to top, transparent 0 ${GROUND}px, ${stops.join(", ")}, #03040b 0)`;
})();

const LABELS = [
  [1, "TROPOSPHERE", 1], [10, "cruising altitude"], [12, "STRATOSPHERE", 1], [25, "ozone layer"], [39, "highest skydive"],
  [50, "MESOSPHERE", 1], [76, "meteors burn up here"], [85, "THERMOSPHERE", 1], [100, "KÁRMÁN LINE · SPACE", 1],
  [200, "satellite belt"], [330, "aurora"], [408, "ISS ORBIT", 1], [600, "EXOSPHERE", 1], [700, "ESCAPE VELOCITY", 1],
  [1000, "DEEP SPACE", 1], [1500, "THE EDGE", 1],
];
// [sprite, km, left %, scale, motion, duration s, delay s]
const DECOR = [
  ["tower", 0, 5, 5, "still"],
  ["bird", 0.25, 0, 3, "drift", 34, -8], ["bird", 0.32, 0, 2, "drift", 28, -20], ["cloud", 0.55, 0, 5, "drift", 140, -40],
  ["balloon", 0.85, 74, 5, "bob"], ["cloudlet", 1.3, 0, 5, "drift", 95, -70], ["cloud", 2.4, 0, 6, "drift", 170, -120],
  ["bird", 3, 0, 2, "drift", 40, -5], ["cloud", 4.6, 0, 4, "drift", 120, -10], ["cloudlet", 6.5, 0, 4, "drift", 80, -50],
  ["airliner", 10, 0, 4, "drift", 45, -18], ["cloudlet", 11.5, 0, 3, "drift", 140, -100],
  ["wballoon", 30, 68, 5, "bob"], ["meteor", 60, 20, 4, "streak", 6, -1], ["meteor", 70, 60, 3, "streak", 9, -5], ["meteor", 80, 35, 3, "streak", 7, -3],
  ["satellite", 200, 64, 5, "spin"], ["iss", 408, 0, 5, "drift", 70, -30], ["satellite", 520, 14, 4, "spin"],
  ["moon", 760, 66, 8, "still"], ["ufo", 900, 22, 5, "bob"], ["planet", 1200, 58, 7, "bob"],
];
const LINE_TIERS = ["paper", "flyer", "jet", "deep", "skyllion"]; // Barrel Roll isn't a rarity step, so no line

// ---------- sprite ----------
export function Px({ name, scale = 3, fps = 6, className = "", style, label }) {
  const m = PX[name];
  return (
    <span
      className={`px ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: m.w * scale,
        height: m.h * scale,
        backgroundImage: `url(/px/${name}.png)`,
        backgroundSize: `${m.w * m.frames * scale}px ${m.h * scale}px`,
        "--fw": `-${m.w * m.frames * scale}px`,
        animation: m.frames > 1 ? `pxframes ${m.frames / fps}s steps(${m.frames}) infinite` : undefined,
        ...style,
      }}
    />
  );
}

// ---------- world ----------
// focus = altitude the camera centres on. me / others = { name, km, hue?, landed? }. ghosts = { label, km }.
// lines = { base, now } draws tier lines from `base`, lighting up the ones `now` has passed.
export function World({ focus = 0, me, others = [], ghosts = [], lines, dim, shake }) {
  const camY = WORLD_H - GROUND - yOf(focus);
  return (
    <div className={`scene${shake ? " shake" : ""}`} aria-hidden>
      <div className="world" style={{ height: WORLD_H, transform: `translateY(calc(58dvh - ${camY}px))`, backgroundImage: SKY }}>
        <div className="stars" style={{ bottom: GROUND + yOf(35) }} />
        <div className="stars s2" style={{ bottom: GROUND + yOf(60) }} />
        <div className="aurora" style={{ bottom: GROUND + yOf(110), height: yOf(380) - yOf(110) }} />
        <div className="karman" style={{ bottom: GROUND + yOf(100) }} />
        {LABELS.map(([km, text, major]) => (
          <div key={km} className={`amb${major ? " major" : ""}`} style={{ bottom: GROUND + yOf(km) }}>
            <span className="dash">— </span>{km} km {major ? "· " : "· "}{text}
          </div>
        ))}
        {DECOR.map(([name, km, left, scale, motion, dur, delay], i) => (
          <div key={i} className={`decor ${motion}`} style={{ bottom: GROUND + yOf(km), left: motion === "drift" ? 0 : `${left}%`, "--dur": `${dur}s`, "--delay": `${delay}s` }}>
            <Px name={name} scale={scale} fps={name === "bird" ? 5 : 3} />
          </div>
        ))}
        <div className="ground" style={{ height: GROUND }}><div className="runway" /></div>
        {lines && LINE_TIERS.map((k) => {
          const km = lines.base + TIERS[k].pts, passed = lines.now >= km;
          return (
            <div key={k} className={`tierline${passed ? " passed" : ""}`} style={{ bottom: GROUND + yOf(km), "--tc": TIERS[k].color }}>
              <span className="tag"><Px name={k} scale={1.25} />+{TIERS[k].pts} {TIERS[k].name}</span>
            </div>
          );
        })}
        {ghosts.map((g) => (
          <div key={g.label} className="ghostline" style={{ bottom: GROUND + yOf(g.km) }}><span>{g.label} · {g.km} km</span></div>
        ))}
        {others.map((p, i) => <Pilot key={p.id ?? p.name} {...p} left={`${44 + ((i * 11) % 42)}%`} />)}
        {me && <Pilot {...me} me left="22%" />}
      </div>
      {dim && <div className="dimmer" />}
    </div>
  );
}

// hit = just took damage (explosion), shield = Flak Shield up, box = holding an unopened mystery box
function Pilot({ me, name, km, hue = 0, left, landed, hit, shield, box }) {
  return (
    <div className={`pilot${me ? " me" : ""}${km > 0 ? " flying" : ""}${hit ? " hit" : ""}`} style={{ bottom: GROUND + yOf(km) - 4, left, "--hue": `${hue}deg` }}>
      {name && <span className="ptag">{box && <Px name="mbox" scale={1} fps={4} />}{name}{landed ? " ✓" : ""}</span>}
      <span className="trail" />
      <span className="pbody">
        <Px name="plane" scale={me ? 3 : 2} fps={14} className="pplane" />
        {shield && <span className="bubble" />}
        {hit && <Px name="boom" scale={me ? 3 : 2} fps={8} className="pboom" />}
      </span>
    </div>
  );
}

// ---------- side ruler: everyone's altitude at a glance, even when off-screen ----------
export function Ruler({ max = 700, me, others = [], ghosts = [], lines }) {
  const pct = (km) => `${(yOf(Math.min(km, max)) / yOf(max)) * 100}%`;
  const ticks = [0, 12, 50, 100, 408, 700, 1000, 1500].filter((k) => k <= max);
  return (
    <div className="ruler" aria-hidden>
      {ticks.map((k) => <i key={k} className="tick" style={{ bottom: pct(k) }}><b>{k}</b></i>)}
      {lines && LINE_TIERS.map((k) => <i key={k} className={`tnotch${lines.now >= lines.base + TIERS[k].pts ? " passed" : ""}`} style={{ bottom: pct(lines.base + TIERS[k].pts), "--tc": TIERS[k].color }} />)}
      {ghosts.map((g) => <i key={g.label} className="gdot" style={{ bottom: pct(g.km) }}><b>{g.label.split(" ").at(-1)}</b></i>)}
      {others.map((p) => <i key={p.id ?? p.name} className="odot" style={{ bottom: pct(p.km), "--hue": `${p.hue || 0}deg` }}>{p.name && <b>{p.name.slice(0, 8)}</b>}</i>)}
      {me && <i className="mdot" style={{ bottom: pct(me.km) }} />}
    </div>
  );
}

// ---------- HUD ----------
export function Hud({ km, pips = [], rounds, left, total }) {
  return (
    <div className="hud">
      <div className="alt">
        <span className="lbl">ALTITUDE</span>
        <span className="num jolt" key={km}>{km.toLocaleString()}<small> km</small></span>
        <span className="zone">{zoneFor(km)}</span>
      </div>
      <div className="pips">
        {Array.from({ length: rounds }, (_, i) => {
          const t = pips[i];
          return <i key={i} className={t === undefined ? "" : "on"} style={{ "--tc": t ? TIERS[t].color : t === null ? GROUNDED.color : undefined }} />;
        })}
      </div>
      {total ? (
        <div className={`ring${left <= 5 ? " hot" : ""}`} style={{ "--p": left / total }}>
          <span>{left}</span>
        </div>
      ) : <div className="ring off" />}
    </div>
  );
}

// ---------- the payoff: the rarer the tier, the bigger the show ----------
export function Landed({ tier, answer, mini }) {
  const t = tier ? TIERS[tier] : GROUNDED;
  const lv = t.lv;
  return (
    <div className={`landed lv${lv}${mini ? " mini" : ""}`} style={{ "--tc": t.color, "--lv": Math.max(lv, 0) }}>
      {lv >= 4 && !mini && <div className="flash" />}
      <div className="icon-wrap">
        {lv >= 3 && <div className="rays" />}
        <Px name={tier || "grounded"} scale={mini ? 3 : 5} fps={4} className="icon" />
        {!mini && lv >= 2 && Array.from({ length: lv * 4 }, (_, i) => (
          <span key={i} className="spark" style={{ "--a": `${(360 / (lv * 4)) * i + (i % 2) * 11}deg`, "--d": `${60 + (i % 3) * 26}px`, animationDelay: `${(i % 4) * 60}ms` }}>
            <Px name="sparkle" scale={2} />
          </span>
        ))}
      </div>
      <div className="tname">{lv >= 4 ? "ONE IN A SKYLLION" : t.name}</div>
      {answer !== undefined && <div className="tans">{answer || "out of fuel"}</div>}
      <div className="tpts">+<b>{t.pts}</b> km</div>
      {!mini && <div className="tsub">{t.blurb}</div>}
    </div>
  );
}

export function useCountUp(target, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Close({ onClick, href, label = "Close" }) {
  return href
    ? <a className="closebtn" href={href} aria-label={label}>✕</a>
    : <button type="button" className="closebtn" onClick={onClick} aria-label={label}>✕</button>;
}

export function Title({ small }) {
  return <h1 className={`title${small ? " small" : ""}`}>SKYLLION</h1>;
}
