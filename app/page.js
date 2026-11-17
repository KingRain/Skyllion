"use client";
import { useEffect, useRef, useState } from "react";
import { pickPrompts, pastDays, today } from "@/lib/prompts";
import { TIERS, GROUNDED, ROUNDS, SECONDS, KM_PER_POINT, zoneFor } from "@/lib/tiers";
import { World, Ruler, Hud, Landed, Px, Title, Close, useCountUp, DidYouMean } from "./Sky";

// ---- per-browser progress (guest mode) ----
const load = () => { try { return JSON.parse(localStorage.getItem("skyllion") || "{}"); } catch { return {}; } };
const save = (s) => { try { localStorage.setItem("skyllion", JSON.stringify(s)); } catch {} };
const kmOf = (results) => results.reduce((s, r) => s + (r.tier ? TIERS[r.tier].pts : 0), 0) * KM_PER_POINT;

function streak(history) {
  let n = 0;
  const d = new Date(today() + "T12:00:00Z");
  if (!history[today()]) d.setUTCDate(d.getUTCDate() - 1); // today not played yet: streak still alive from yesterday
  while (history[d.toISOString().slice(0, 10)] !== undefined) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export default function Home() {
  const [view, setView] = useState("home"); // home | play | done | me | archive | faq | credits
  const [menu, setMenu] = useState(false);
  const [run, setRun] = useState(null); // { mode, day, prompts, results, score }
  const [store, setStore] = useState({});
  useEffect(() => setStore(load()), []);

  const start = (mode, day = today()) => {
    const seed = mode === "unlimited" ? Math.random() : day;
    setRun({ mode, day, prompts: pickPrompts(seed, ROUNDS), results: [] });
    setView("play");
    setMenu(false);
  };

  const finish = (results) => {
    const score = kmOf(results) / KM_PER_POINT;
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

  return (
    <div className="app">
      {view === "home" && <World focus={0.3} me={{ km: 0 }} />}
      {["me", "archive", "faq", "credits"].includes(view) && <World focus={14} me={{ km: 14 }} dim />}

      <header className="topbar">
        <button className="logo" onClick={() => go("home")}><Px name="plane" scale={1.5} fps={12} /> SKYLLION</button>
        <button className="iconbtn" aria-label="Menu" onClick={() => setMenu(true)}>≡</button>
      </header>

      {menu && (
        <nav className="drawer" onClick={() => setMenu(false)}>
          <div className="panel menu" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h2 className="chroma">TAKE OFF</h2><Close onClick={() => setMenu(false)} label="Close menu" /></div>
            <p className="eyebrow">CHOOSE YOUR FLIGHT</p>
            <button onClick={() => (playedToday ? go("home") : start("daily"))}><Px name="paper" scale={1.5} /> Daily ascent</button>
            <button onClick={() => start("unlimited")}><Px name="flyer" scale={1.5} /> Unlimited</button>
            <a href="/party"><Px name="jet" scale={1.5} /> Dogfight <small>multiplayer</small></a>
            <button onClick={() => go("archive")}><Px name="deep" scale={1.5} /> Archive</button>
            <button onClick={() => go("me")}><Px name="skyllion" scale={1.5} /> My Skyllion</button>
            <button onClick={() => go("faq")}><Px name="cloudlet" scale={1.5} /> How to play</button>
            <button onClick={() => go("credits")}><Px name="plane" scale={1.2} fps={12} /> Credits</button>
          </div>
        </nav>
      )}

      {view === "home" && (
        <section className="intro">
          <Title />
          <p className="tagline">one in a skyllion</p>
          <p className="subline">7 prompts · {SECONDS}s each · the rarer the answer, the higher you climb</p>
          <p className="blink">ascending…</p>
          {playedToday ? (
            <>
              <p className="subline">Today: <b className="glowtxt">{store.history[today()] * KM_PER_POINT} km</b> · {zoneFor(store.history[today()] * KM_PER_POINT)}</p>
              <button className="btn bob" onClick={() => start("unlimited")}>▲ Keep flying</button>
            </>
          ) : (
            <button className="btn bob" onClick={() => start("daily")}>▲ Take off</button>
          )}
          <div className="row gap">
            <a className="btn ghost" href="/party">Dogfight</a>
            <button className="btn ghost" onClick={() => go("faq")}>How to play</button>
          </div>
          <p className="streak">🔥 {streak(store.history || {})} day streak</p>
          <button className="linkbtn" onClick={() => go("credits")}>credits · made by Sam Joe</button>
        </section>
      )}

      {view === "play" && run && <Play key={run.day + run.mode + run.prompts[0].id} run={run} onDone={finish} />}
      {view === "done" && run && <Done run={run} again={() => start("unlimited")} home={() => go("home")} />}
      {view === "me" && <Me store={store} close={() => go("home")} />}
      {view === "archive" && <Archive store={store} play={(d) => start("archive", d)} close={() => go("home")} />}
      {view === "faq" && <Faq close={() => go("home")} />}
      {view === "credits" && <Credits close={() => go("home")} />}
    </div>
  );
}

function Play({ run, onDone }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null); // landed verdict on screen
  const [reject, setReject] = useState(""); // grounded / error note
  const [ghosts, setGhosts] = useState([]);
  const results = useRef([]);
  const input = useRef(null);
  const prompt = run.prompts[i];

  useEffect(() => {
    if (run.mode !== "daily") return;
    fetch(`/api/runs?day=${run.day}`).then((r) => r.json()).then((g) => {
      if (g.pilots > 0) setGhosts([{ label: "TODAY'S BEST", km: g.best * KM_PER_POINT }, { label: "MEDIAN PILOT", km: g.median * KM_PER_POINT }].filter((x, j, a) => j === 0 || x.km !== a[0].km));
    }).catch(() => {});
  }, [run]);

  const next = (r) => {
    if (results.current.length > i) return; // round already settled (timer expired mid-request)
    results.current = [...results.current, r];
    setFlash(r);
    const hold = 1700 + (r.tier ? TIERS[r.tier].lv : 0) * 450; // rarer answers get a longer moment
    setTimeout(() => {
      setFlash(null);
      if (results.current.length >= ROUNDS) return onDone(results.current);
      setI((n) => n + 1);
      setLeft(SECONDS);
      setText("");
      setReject("");
      input.current?.focus();
    }, hold);
  };

  useEffect(() => {
    if (flash) return;
    if (left <= 0) return next({ answer: "", tier: null });
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, flash]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sug, setSug] = useState(null); // { typed, suggest }: "did you mean" offer

  // force = player kept their own spelling, so the model judges it instead of the cache suggesting a fix.
  const send = async (answer, force = false) => {
    if (!answer.trim() || busy || flash) return;
    setBusy(true);
    setReject("");
    setSug(null);
    try {
      const res = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: prompt.id, answer, force }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (j.suggest) setSug({ typed: answer.trim(), suggest: j.suggest });
      else if (j.tier) next({ answer: answer.trim(), tier: j.tier });
      else { setReject(`"${answer.trim()}" · GROUNDED · try another`); setText(""); }
    } catch (e) {
      setReject(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e) => { e.preventDefault(); send(text); };

  const done = results.current;
  const km = kmOf(done);
  const base = kmOf(done.slice(0, i));
  const lv = flash?.tier ? TIERS[flash.tier].lv : -1;

  return (
    <>
      <World focus={km} me={{ km, name: "YOU" }} ghosts={ghosts} lines={{ base, now: km }} shake={lv >= 4} />
      <Ruler me={{ km }} ghosts={ghosts} lines={{ base, now: km }} />
      <Hud km={km} rounds={ROUNDS} pips={done.map((r) => r.tier)} left={left} total={flash ? 0 : SECONDS} />
      {!flash && (
        <div className="card" key={i}>
          <div className="rnd">{run.mode === "daily" ? "DAILY ASCENT" : run.mode === "archive" ? `ARCHIVE ${run.day}` : "UNLIMITED"} · {i + 1}/{ROUNDS} · {prompt.cat.toUpperCase()}</div>
          <h2 className="prompt">{prompt.text}</h2>
          <div className="hint">rarer answers climb higher</div>
        </div>
      )}
      {flash && <Landed tier={flash.tier} answer={flash.answer} />}
      {reject && !flash && <p className="reject" key={reject}>{reject}</p>}
      {sug && !flash && !busy && <DidYouMean {...sug} pick={(a) => { setText(a); send(a, a === sug.typed); }} />}
      {busy && <div className="chip">{text.trim()} ▲</div>}
      <form onSubmit={submit} className={`dock${flash ? " away" : ""}${reject ? " jolt-x" : ""}`} key={`dock${reject}`}>
        <input ref={input} autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="your rarest answer…" aria-label="Your answer" disabled={busy || !!flash} />
        <button className="btn" disabled={busy || !!flash}>{busy ? <span className="blink">…</span> : "LAUNCH"}</button>
      </form>
    </>
  );
}

function Done({ run, again, home }) {
  const [rank, setRank] = useState(null);
  const [copied, setCopied] = useState(false);
  const km = run.score * KM_PER_POINT;
  const shown = useCountUp(km);
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
    <>
      <World focus={km} me={{ km, name: "YOU" }} />
      <Ruler me={{ km }} />
      <section className="sheet">
        <Close onClick={home} />
        <p className="eyebrow">FLIGHT COMPLETE</p>
        <div className="bigkm">{shown.toLocaleString()}<small> km</small></div>
        <h2 className="chroma">{zoneFor(km)}</h2>
        {rank?.pilots > 1 && <p className="subline">You out-climbed <b className="glowtxt">{rank.beat}%</b> of {rank.pilots} pilots today</p>}
        <ol className="log">
          {run.results.map((r, i) => {
            const t = r.tier ? TIERS[r.tier] : GROUNDED;
            return (
              <li key={i} className={`lv${t.lv}`} style={{ "--tc": t.color, animationDelay: `${i * 90}ms` }}>
                <Px name={r.tier || "grounded"} scale={2} fps={4} />
                <span className="lq"><small>{run.prompts[i].text}</small><b>{r.answer || "out of fuel"}</b></span>
                <span className="lt">{t.name}<small>+{t.pts}</small></span>
              </li>
            );
          })}
        </ol>
        <div className="row gap">
          <button className="btn" onClick={share}>{copied ? "COPIED!" : "SHARE"}</button>
          <button className="btn ghost" onClick={again}>Unlimited</button>
          <button className="btn ghost" onClick={home}>Home</button>
        </div>
      </section>
    </>
  );
}

function Me({ store, close }) {
  const hangar = new Set(store.hangar || []);
  const days = Object.keys(store.history || {}).length;
  return (
    <section className="page">
      <div className="panel">
        <Close onClick={close} />
        <h2 className="chroma">MY SKYLLION</h2>
        <div className="stats">
          <div><b>{streak(store.history || {})}</b><span>day streak</span></div>
          <div><b>{days}</b><span>daily ascents</span></div>
          <div><b>{store.flights || 0}</b><span>total flights</span></div>
          <div><b>{(store.best || 0) * KM_PER_POINT}</b><span>best climb (km)</span></div>
        </div>
        <h3>HANGAR</h3>
        <p className="muted">Land a tier once to unlock its craft.</p>
        <div className="hangar">
          {Object.entries(TIERS).map(([k, t]) => (
            <div key={k} className={hangar.has(k) ? `got lv${t.lv}` : "locked"} style={{ "--tc": t.color }}>
              <Px name={k} scale={3} fps={4} />
              <span>{hangar.has(k) ? t.name : "???"}</span>
              <small>{t.pts} km</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Archive({ store, play, close }) {
  const days = pastDays();
  return (
    <section className="page">
      <div className="panel">
        <Close onClick={close} />
        <h2 className="chroma">ARCHIVE</h2>
        <p className="muted">Replay past ascents. These don't count toward your streak.</p>
        {days.length === 0 && <p className="muted">No past ascents yet. Come back tomorrow.</p>}
        <div className="archive">
          {days.map((d) => {
            const s = store.history?.[d] ?? store.archive?.[d];
            return <button key={d} onClick={() => play(d)}>{d}<small>{s !== undefined ? `${s * KM_PER_POINT} km` : "unflown"}</small></button>;
          })}
        </div>
      </div>
    </section>
  );
}

function Faq({ close }) {
  return (
    <section className="page">
      <div className="panel faq">
        <Close onClick={close} />
        <h2 className="chroma">HOW TO PLAY</h2>
        <p>Everyone gets the same 7 prompts each day, with {SECONDS} seconds for each. Give a <b>valid</b> answer, and the <b>rarer</b> it is, the higher you climb. A grounded answer doesn't end your turn, so try again while the fuel lasts.</p>
        <h3>TIERS</h3>
        <ul className="tiers">
          {Object.entries(TIERS).map(([k, t]) => (
            <li key={k} className={`lv${t.lv}`} style={{ "--tc": t.color }}><Px name={k} scale={2} fps={4} /><b>{t.name}</b><span>+{t.pts} km</span><small>{t.blurb}</small></li>
          ))}
        </ul>
        <p>1 point = 1 km. A perfect day is 700 km: past the Kármán line and the ISS, out to escape velocity.</p>
        <h3>WHO DECIDES RARITY?</h3>
        <p>An AI decision model (Cloudflare's clef-flash) judges whether each answer fits and how unusual it is. Verdicts are cached, so everyone gets the same ruling for the same answer.</p>
        <h3>WHEN DOES THE DAILY RESET?</h3>
        <p>At midnight US Eastern. Streaks count daily ascents only.</p>
      </div>
    </section>
  );
}

function Credits({ close }) {
  return (
    <section className="page">
      <div className="panel credits">
        <Close onClick={close} />
        <h2 className="chroma">CREDITS</h2>
        <div className="dev">
          <Px name="plane" scale={4} fps={12} className="devplane" />
          <div>
            <p className="eyebrow">DESIGNED &amp; BUILT BY</p>
            <h3 className="devname">Sam Joe</h3>
            <p>Developer of Skyllion: game design, code and every pixel in the sky.</p>
            <a className="btn" href="https://samjoe.me" target="_blank" rel="noopener noreferrer">▲ samjoe.me</a>
          </div>
        </div>
        <h3>FLIGHT CREW</h3>
        <ul className="crew">
          <li><b>Answer judge</b><span>clef-flash on Cloudflare Workers AI</span></li>
          <li><b>Database</b><span>Neon Postgres</span></li>
          <li><b>Hosting</b><span>Vercel · Next.js</span></li>
          <li><b>Font</b><span>VT323 by Peter Hull</span></li>
          <li><b>Pixel art</b><span>Original, drawn as ASCII grids</span></li>
          <li><b>Inspired by</b><span><a href="https://krillion.io" target="_blank" rel="noopener noreferrer">Krillion</a>, the daily dive. Skyllion flips it upward.</span></li>
        </ul>
      </div>
    </section>
  );
}
