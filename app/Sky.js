"use client";
// The shared pixel-art sky: one very tall world (runway → atmosphere layers → space) that a camera glides up,
// plus the HUD, altitude ruler and the rarity-scaled "landed" effects. Used by solo play and Dogfight.
import { useEffect, useLayoutEffect, useState } from "react";
import PX from "@/lib/px.json";
import { TIERS, GROUNDED, zoneFor } from "@/lib/tiers";

// ---------- altitude → world pixels (piecewise, so the thin lower layers still get room) ----------
export const GROUND = 560; // tall enough that the runway fills the bottom of any screen at take-off
const ANCHORS = [[0, 0], [1, 520], [12, 1500], [50, 2700], [85, 3700], [100, 4500], [408, 6400], [600, 7800], [700, 8800], [1500, 10600]];
export const WORLD_H = 12740; // Match the supplied SVG canvas.
export function yOf(km) {
  const k = Math.max(0, km);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [k0, y0] = ANCHORS[i - 1], [k1, y1] = ANCHORS[i];
    if (k <= k1) return y0 + ((y1 - y0) * (k - k0)) / (k1 - k0);
  }
  return ANCHORS.at(-1)[1];
}

const LABELS = [
  [1, "TROPOSPHERE", 1], [10, "cruising altitude"], [12, "STRATOSPHERE", 1], [25, "ozone layer"], [39, "highest skydive"],
  [50, "MESOSPHERE", 1], [76, "meteors burn up here"], [85, "THERMOSPHERE", 1], [100, "KÁRMÁN LINE · SPACE", 1],
  [200, "satellite belt"], [330, "aurora"], [408, "ISS ORBIT", 1], [600, "EXOSPHERE", 1], [700, "ESCAPE VELOCITY", 1],
  [1000, "DEEP SPACE", 1], [1500, "THE EDGE", 1],
];
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
export function Landscape({ dim = false }) {
  return <div className={`landscape${dim ? " subdued" : ""}`} aria-hidden="true" />;
}

// focus = altitude the camera centres on. me / others = { name, km, hue?, landed? }. ghosts = { label, km }.
export function World({ focus = 0, me, others = [], ghosts = [], dim, shake, smooth = false }) {
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const resize = () => setScale(window.innerWidth / 1440);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.src = "/game-background.png";
    image.decode().catch(() => {}).then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const camY = (WORLD_H - GROUND - yOf(focus)) * scale;
  return (
    <div className={`scene${ready ? " flight-ready" : " flight-loading"}${shake ? " shake" : ""}${smooth ? " smooth-flight" : ""}`} aria-hidden>
      <div className="world" style={{ height: WORLD_H * scale, transform: `translateY(calc(max(58dvh, calc(100dvh - ${GROUND * scale}px)) - ${camY}px))` }}>
        <div className="world-art" />
        {LABELS.map(([km, text, major]) => (
          <div key={km} className={`amb${major ? " major" : ""}`} style={{ bottom: (GROUND + yOf(km)) * scale }}>
            <span className="dash">— </span>{km} km {major ? "· " : "· "}{text}
          </div>
        ))}
        {ghosts.map((g) => (
          <div key={g.label} className="ghostline" style={{ bottom: (GROUND + yOf(g.km)) * scale }}><span>{g.label} · {g.km} km</span></div>
        ))}
        {others.map((p, i) => <Pilot key={p.id ?? p.name} {...p} scale={scale} left={`${44 + ((i * 11) % 42)}%`} />)}
        {me && <Pilot {...me} scale={scale} me left="22%" />}
      </div>
      {dim && <div className="dimmer" />}
    </div>
  );
}

// hit = just took damage (explosion), shield = Flak Shield up, box = holding an unopened mystery box
function Pilot({ scale = 1, me, name, km, hue = 0, left, landed, hit, shield, box }) {
  return (
    <div className={`pilot${me ? " me" : ""}${km > 0 ? " flying" : ""}${hit ? " hit" : ""}`} style={{ bottom: (GROUND + yOf(km)) * scale - 4, left, "--hue": `${hue}deg` }}>
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
export function Ruler({ max = 700, me, others = [], ghosts = [], smooth = false }) {
  const pct = (km) => `${(yOf(Math.min(km, max)) / yOf(max)) * 100}%`;
  const ticks = [0, 12, 50, 100, 408, 700, 1000, 1500].filter((k) => k <= max);
  return (
    <div className={smooth ? "ruler smooth-flight" : "ruler"} aria-hidden>
      {ticks.map((k) => <i key={k} className="tick" style={{ bottom: pct(k) }}><b>{k}</b></i>)}
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
export function Landed({ tier, answer, mini, pts }) {
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
      <div className="tpts">+<b>{pts ?? t.pts}</b> km</div>
      {tier && pts !== undefined && <div className="tspeed">includes +{Math.max(0, pts - Math.round(t.pts * .8))} km speed bonus</div>}
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

export function DidYouMean({ answer }) {
  return <p className="reject correction" role="status">Did you mean <b>{answer}</b>? Press Enter to accept.</p>;
}

