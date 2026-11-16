"use client";
import { useEffect, useRef, useState } from "react";
import { pickPrompts, pastDays, today } from "@/lib/prompts";
import { TIERS, GROUNDED, ROUNDS, SECONDS, KM_PER_POINT, zoneFor } from "@/lib/tiers";

// ---- per-browser progress (guest mode, like the original) ----
const load = () => { try { return JSON.parse(localStorage.getItem("skyllion") || "{}"); } catch { return {}; } };
const save = (s) => { try { localStorage.setItem("skyllion", JSON.stringify(s)); } catch {} };

function streak(history) {
  let n = 0;
  const d = new Date(today() + "T12:00:00Z");
  if (!history[today()]) d.setUTCDate(d.getUTCDate() - 1); // today not played yet: streak still alive from yesterday
  while (history[d.toISOString().slice(0, 10)] !== undefined) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export default function Home() {
  const [view, setView] = useState("home"); // home | play | done | me | archive | faq
  const [menu, setMenu] = useState(false);
  const [run, setRun] = useState(null); // { mode, day, prompts, results: [{answer, tier}] }
  const [store, setStore] = useState({});
  useEffect(() => setStore(load()), []);

  const start = (mode, day = today()) => {
    const seed = mode === "unlimited" ? Math.random() : day;
    setRun({ mode, day, prompts: pickPrompts(seed, ROUNDS), results: [] });
    setView("play");
    setMenu(false);
  };

  const finish = (results) => {
    const score = results.reduce((s, r) => s + (r.tier ? TIERS[r.tier].pts : 0), 0);
    const s = load();
    s.hangar = [...new Set([...(s.hangar || []), ...results.map((r) => r.tier).filter(Boolean)])];
    s.best = Math.max(s.best || 0, score);
    s.flights = (s.flights || 0) + 1;
    if (run.mode === "daily") (s.history ||= {})[run.day] = score;
    if (run.mode === "archive") (s.archive ||= {})[run.day] = score;
    save(s);
    setStore(s);
    setRun({ ...run, results, score });
    setView("done");
  };

  const go = (v) => { setView(v); setMenu(false); };
  const playedToday = store.history?.[today()] !== undefined;
  const km = run?.results ? run.results.reduce((s, r) => s + (r.tier ? TIERS[r.tier].pts : 0), 0) * KM_PER_POINT : 0;

  return (
    <div className="sky" style={{ "--alt": Math.min(1, (view === "play" || view === "done" ? km : 0) / 400) }}>
      <div className="stars" />
      <header>
        <button className="logo" onClick={() => go("home")}>SKYLLION</button>
        <button className="icon" aria-label="Menu" onClick={() => setMenu(true)}>☰</button>
      </header>

      {menu && (
        <nav className="drawer" onClick={() => setMenu(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h2>Take off</h2><button className="icon" aria-label="Close" onClick={() => setMenu(false)}>✕</button></div>
            <button onClick={() => (playedToday ? go("home") : start("daily"))}>🛫 Daily ascent</button>
            <button onClick={() => start("unlimited")}>∞ Unlimited</button>
            <a href="/party">🛩️ Dogfight (multiplayer)</a>
            <button onClick={() => go("archive")}>⟲ Archive</button>
            <button onClick={() => go("me")}>🧑‍✈️ My Skyllion</button>
            <button onClick={() => go("faq")}>? FAQ</button>
          </div>
        </nav>
      )}

      <main>
        {view === "home" && (
          <section className="center">
            <img src="/mascot.svg" alt="" className="mascot" />
            <h1>one in a skyllion</h1>
            <p className="muted">Seven prompts. {SECONDS} seconds each. The rarer your answer, the higher you climb.</p>
            {playedToday ? (
              <>
                <p>Today's ascent: <b>{store.history[today()] * KM_PER_POINT} km</b> ({zoneFor(store.history[today()] * KM_PER_POINT)})</p>
                <button className="cta" onClick={() => start("unlimited")}>Keep flying: Unlimited ∞</button>
              </>
            ) : (
              <button className="cta" onClick={() => start("daily")}>Begin today's ascent</button>
            )}
            <a className="ghost" href="/party">🛩️ Dogfight with friends</a>
            <p className="muted small">🔥 {streak(store.history || {})} day streak</p>
          </section>
        )}

        {view === "play" && run && <Play key={run.day + run.mode + run.prompts[0].id} run={run} onDone={finish} onProgress={(results) => setRun({ ...run, results })} />}
        {view === "done" && run && <Done run={run} again={() => start("unlimited")} />}
        {view === "me" && <Me store={store} />}
        {view === "archive" && <Archive store={store} play={(d) => start("archive", d)} />}
        {view === "faq" && <Faq />}
      </main>
    </div>
  );
}

function Play({ run, onDone, onProgress }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null); // last verdict
  const [err, setErr] = useState("");
  const results = useRef([]);
  const input = useRef(null);
  const prompt = run.prompts[i];

  const next = (r) => {
    if (results.current.length > i) return; // round already settled (timer expired mid-request)
    results.current = [...results.current, r];
    onProgress(results.current);
    setFlash(r);
    setTimeout(() => {
      setFlash(null);
      if (results.current.length >= ROUNDS) return onDone(results.current);
      setI((n) => n + 1);
      setLeft(SECONDS);
      setText("");
      setErr("");
      input.current?.focus();
    }, 1400);
  };

  useEffect(() => {
    if (flash) return;
    if (left <= 0) return next({ answer: "", tier: null });
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, flash]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy || flash) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: prompt.id, answer: text }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (j.tier) next({ answer: text.trim(), tier: j.tier });
      else { setErr(`"${text.trim()}" got grounded. Doesn't fit. Try another before the clock runs out!`); setText(""); }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const km = results.current.reduce((s, r) => s + (r.tier ? TIERS[r.tier].pts : 0), 0) * KM_PER_POINT;
  const t = flash && (flash.tier ? TIERS[flash.tier] : GROUNDED);

  return (
    <section className="center play">
      <Altimeter km={km} />
      <p className="muted small">{run.mode === "daily" ? "Daily ascent" : run.mode === "archive" ? `Archive · ${run.day}` : "Unlimited"} · {i + 1}/{ROUNDS} · {prompt.cat}</p>
      <h2 className="prompt">{prompt.text}</h2>
      <div className="fuel" aria-label={`${left} seconds left`}><div style={{ width: `${(left / SECONDS) * 100}%` }} className={left <= 5 ? "low" : ""} /></div>
      <p className="timer">{left}s</p>
      {t ? (
        <div className="verdict pop">
          {t.img ? <img src={t.img} alt="" /> : <span className="big">{t.emoji}</span>}
          <b>{t.name}</b><span>+{t.pts} pts · +{t.pts * KM_PER_POINT} km</span><span className="muted small">{t.blurb}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="answer">
          <input ref={input} autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Your rarest answer…" aria-label="Your answer" disabled={busy} />
          <button className="cta" disabled={busy}>{busy ? <span className="ascending">ascending…</span> : "Launch"}</button>
        </form>
      )}
      {err && <p className="err">{err}</p>}
    </section>
  );
}

function Altimeter({ km }) {
  return (
    <div className="altimeter">
      <b>{km.toLocaleString()} km</b>
      <span>{zoneFor(km)}</span>
    </div>
  );
}

function Done({ run, again }) {
  const [rank, setRank] = useState(null);
  const [copied, setCopied] = useState(false);
  const km = run.score * KM_PER_POINT;
  useEffect(() => {
    if (run.mode !== "daily") return;
    fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: run.day, score: run.score }) })
      .then((r) => r.json()).then(setRank).catch(() => {});
  }, [run]);

  const share = () => {
    const line = run.results.map((r) => (r.tier ? TIERS[r.tier].emoji : GROUNDED.emoji)).join("");
    navigator.clipboard?.writeText(`Skyllion ${run.mode === "unlimited" ? "∞" : run.day}\n🛫 ${km} km · ${zoneFor(km)}\n${line}\n${location.origin}`);
    setCopied(true);
  };

  return (
    <section className="center">
      <p className="muted">Flight complete</p>
      <h1 className="km">{km.toLocaleString()} km</h1>
      <h2>{zoneFor(km)}</h2>
      {rank?.pilots > 1 && <p>You out-climbed {rank.beat}% of {rank.pilots} pilots today.</p>}
      <ol className="log">
        {run.results.map((r, i) => {
          const t = r.tier ? TIERS[r.tier] : GROUNDED;
          return (
            <li key={i}>
              <span className="muted small">{run.prompts[i].text}</span>
              <span><b>{r.answer || "(no answer)"}</b> · {t.emoji} {t.name} <span className="muted">+{t.pts}</span></span>
            </li>
          );
        })}
      </ol>
      <div className="row gap">
        <button className="cta" onClick={share}>{copied ? "Copied!" : "Share"}</button>
        <button className="ghost" onClick={again}>Unlimited ∞</button>
      </div>
    </section>
  );
}

function Me({ store }) {
  const hangar = new Set(store.hangar || []);
  const days = Object.keys(store.history || {}).length;
  return (
    <section className="center">
      <h2>My Skyllion</h2>
      <div className="stats">
        <div><b>{streak(store.history || {})}</b><span>day streak</span></div>
        <div><b>{days}</b><span>daily ascents</span></div>
        <div><b>{store.flights || 0}</b><span>total flights</span></div>
        <div><b>{(store.best || 0) * KM_PER_POINT} km</b><span>highest climb</span></div>
      </div>
      <h3>Hangar</h3>
      <p className="muted small">Earn a craft by landing its tier at least once.</p>
      <div className="hangar">
        {Object.entries(TIERS).map(([k, t]) => (
          <div key={k} className={hangar.has(k) ? "" : "locked"}>
            <img src={t.img} alt="" /><span>{hangar.has(k) ? t.name : "???"}</span><span className="muted small">{t.pts} pts</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Archive({ store, play }) {
  const days = pastDays();
  return (
    <section className="center">
      <h2>Archive</h2>
      <p className="muted small">Replay past ascents. These don't count toward your streak.</p>
      {days.length === 0 && <p className="muted">No past ascents yet. Come back tomorrow.</p>}
      <div className="archive">
        {days.map((d) => {
          const s = store.history?.[d] ?? store.archive?.[d];
          return <button key={d} onClick={() => play(d)}>{d}<span className="muted small">{s !== undefined ? `${s * KM_PER_POINT} km` : "unflown"}</span></button>;
        })}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="faq">
      <h2>FAQ</h2>
      <h3>How do I play?</h3>
      <p>Everyone gets the same seven prompts each day. You have {SECONDS} seconds per prompt. Give a valid answer, and the rarer it is, the higher you climb. A grounded (invalid) answer doesn't end your turn, so try again while the fuel lasts.</p>
      <h3>Tiers</h3>
      <ul>
        {Object.values(TIERS).map((t) => <li key={t.name}>{t.emoji} <b>{t.name}</b>: {t.pts} pts ({t.pts * KM_PER_POINT} km). {t.blurb}</li>)}
      </ul>
      <p>1 point = 1 km. A perfect day is 700 points: 700 km, past the ISS and into the exosphere.</p>
      <h3>Who decides rarity?</h3>
      <p>A local decision model (Nimble v3, through Ollama's System One API) judges whether each answer fits and how unusual it is. Verdicts are cached, so everyone gets the same ruling for the same answer.</p>
      <h3>When does the daily reset?</h3>
      <p>At midnight US Eastern. Streaks count daily ascents only. Archive and Unlimited flights don't extend them.</p>
    </section>
  );
}
