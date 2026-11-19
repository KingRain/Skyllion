"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, DEFAULTS, ITEMS } from "@/lib/rooms";
import { TIERS, GROUNDED, KM_PER_POINT, zoneFor } from "@/lib/tiers";
import { World, Landscape, Ruler, Hud, Landed, Px, Title, Close, DidYouMean } from "../Sky";

// ---- identity: a private random token per browser + a call sign, no account needed ----
const uuid = () =>
  crypto.randomUUID?.() ?? // randomUUID needs a secure context; the fallback keeps LAN play over http working
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
function local(key, make) {
  try {
    let v = localStorage.getItem(key);
    if (v === null && make) localStorage.setItem(key, (v = make()));
    return v ?? "";
  } catch { return make ? make() : ""; }
}

async function call(url, body, token) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-player": token || "" },
    body: body && JSON.stringify({ token, ...body }),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `HTTP ${res.status}`), { status: res.status });
  return j;
}

const km = (pts) => `${(pts * KM_PER_POINT).toLocaleString()} km`;
const tierOf = (k) => (k ? TIERS[k] : GROUNDED);
const hueOf = (i) => (i * 67) % 360; // plane colour per seat, same on every screen

export default function Party({ code }) {
  const [token, setToken] = useState("");
  const [nick, setNick] = useState("");
  useEffect(() => { setToken(local("skyllion-token", uuid)); setNick(local("skyllion-nick")); }, []);
  const saveNick = (n) => { setNick(n); try { localStorage.setItem("skyllion-nick", n); } catch {} };

  return (
    <div className="app">
      <header className="topbar">
        <a className="logo" href="/"><Px name="plane" scale={1.5} fps={12} /> SKYLLION</a>
        <Close href={code ? "/party" : "/"} label={code ? "Back to the Dogfight hangar" : "Close Dogfight"} />
      </header>
      {token && (code ? <Room code={code} token={token} nick={nick} setNick={saveNick} /> : <Hangar token={token} nick={nick} setNick={saveNick} />)}
    </div>
  );
}

function CallSign({ nick, setNick }) {
  return (
    <label className="field">
      <span>CALL SIGN</span>
      <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 20))} placeholder="Maverick" maxLength={20} />
    </label>
  );
}

// Room browser: create a room, join by code, or pick a public one.
function Hangar({ token, nick, setNick }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = () => call("/api/rooms").then((j) => setRooms(j.rooms)).catch((e) => setErr(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const create = async (settings) => {
    setErr("");
    try {
      const { code } = await call("/api/rooms", { nick, settings }, token);
      router.push(`/party?room=${code}`);
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <Landscape dim />
      <section className="page">
        <div className="intro compact">
          <Title small />
          <p className="tagline">DOGFIGHT</p>
          <p className="subline">same prompts · same clock · one sky. rarest answers climb highest.</p>
        </div>
        <div className="panel"><CallSign nick={nick} setNick={setNick} /></div>
        {err && <p className="reject static">{err}</p>}
        <div className="cols">
          <div className="panel">
            <h3>JOIN WITH A CODE</h3>
            <form className="inline" onSubmit={(e) => { e.preventDefault(); if (joinCode.length === 5) router.push(`/party?room=${joinCode}`); }}>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))} placeholder="ABCDE" aria-label="Room code" className="code-input" />
              <button className="btn" disabled={joinCode.length !== 5}>JOIN</button>
            </form>
            <h3>PUBLIC SKIES</h3>
            {rooms === null ? <p className="muted blink">scanning radar…</p> : rooms.length === 0 ? <p className="muted">No open public rooms. Start one!</p> : (
              <ul className="rooms">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <a href={`/party?room=${r.code}`}>
                      <b>{r.name}</b>
                      <small>{r.players}/{r.settings.maxPlayers} pilots · {r.settings.rounds} rounds · {r.settings.seconds}s · {r.settings.category}</small>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel">
            <h3>CREATE A ROOM</h3>
            <SettingsForm value={DEFAULTS} onSave={create} cta={nick.trim() ? "CREATE ROOM" : "PICK A CALL SIGN"} disabled={!nick.trim()} />
          </div>
        </div>
      </section>
    </>
  );
}

// Uncontrolled form: re-mounts (key) when the saved settings change, reads everything back via FormData.
function SettingsForm({ value, onSave, cta, disabled, readOnly }) {
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      name: f.get("name"),
      public: f.get("public") === "on",
      rounds: Number(f.get("rounds")),
      seconds: Number(f.get("seconds")),
      maxPlayers: Number(f.get("maxPlayers")),
      category: f.get("category"),
      retries: f.get("retries") === "on",
    });
  };
  return (
    <form className="settings" onSubmit={submit} key={JSON.stringify(value)}>
      <fieldset disabled={readOnly}>
        <label className="field"><span>ROOM NAME</span><input name="name" defaultValue={value.name} maxLength={40} /></label>
        <label className="check"><input type="checkbox" name="public" defaultChecked={value.public} /> Public (listed in Public skies)</label>
        <div className="grid3">
          <label className="field"><span>ROUNDS</span><input type="number" name="rounds" min={1} max={15} defaultValue={value.rounds} /></label>
          <label className="field"><span>SECONDS</span><input type="number" name="seconds" min={10} max={60} step={5} defaultValue={value.seconds} /></label>
          <label className="field"><span>PILOTS</span><input type="number" name="maxPlayers" min={2} max={12} defaultValue={value.maxPlayers} /></label>
        </div>
        <label className="field"><span>CATEGORY</span>
          <select name="category" defaultValue={value.category}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="check"><input type="checkbox" name="retries" defaultChecked={value.retries} /> Retry after a grounded answer</label>
      </fieldset>
      {!readOnly && <button className="btn" disabled={disabled}>{cta}</button>}
    </form>
  );
}

function Room({ code, token, nick, setNick }) {
  const router = useRouter();
  const [s, setS] = useState(null); // server state
  const [offset, setOffset] = useState(0); // server clock - local clock
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState(false);

  const refresh = () =>
    call(`/api/rooms/${code}`, null, token)
      .then((j) => { setS(j); setOffset(j.now - Date.now()); setMissing(false); })
      .catch((e) => (e.status === 404 ? setMissing(true) : setErr(e.message)));

  useEffect(() => {
    refresh();
    // ponytail: 1s polling, switch to Neon Realtime live queries if rooms get big or polling costs bite
    const poll = setInterval(refresh, 1000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action, extra) => {
    setErr("");
    try { const r = await call(`/api/rooms/${code}`, { action, ...extra }, token); await refresh(); return r; }
    catch (e) { setErr(e.message); }
  };
  const leave = async () => { await act("leave"); router.push("/party"); };

  if (missing) return (
    <><World focus={0.3} dim /><section className="page"><div className="panel"><h2 className="chroma">ROOM {code} NOT FOUND</h2><a className="btn" href="/party">BACK TO THE HANGAR</a></div></section></>
  );
  if (!s) return <><World focus={0.3} /><p className="center-note blink">contacting tower…</p></>;

  const { room, phase, players, me, host, answers } = s;
  const isHost = me !== null && me === host;
  const left = phase.endsAt ? Math.max(0, Math.ceil((phase.endsAt - (now + offset)) / 1000)) : 0;
  const mine = phase.kind === "round" ? answers.find((a) => a.player_id === me && a.round === phase.round) : null;
  const seat = Object.fromEntries(players.map((p, i) => [p.id, i]));
  const kmFor = (p) => (p.id === me ? s.myReal ?? p.score : p.score) * KM_PER_POINT;
  const onRunway = phase.kind === "lobby" || phase.kind === "countdown";
  const pilots = players.map((p) => ({ id: p.id, name: p.id === me ? "YOU" : p.name, km: onRunway ? 0 : kmFor(p), hue: hueOf(seat[p.id]), landed: p.landed }));
  const mePilot = pilots.find((p) => p.id === me);
  const others = pilots.filter((p) => p.id !== me);
  const focus = mePilot ? mePilot.km : Math.max(0, ...pilots.map((p) => p.km));
  const max = Math.max(700, room.settings.rounds * 100);
  const myBase = players.find((p) => p.id === me)?.score ?? 0;
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const serverNow = now + offset;
  const recent = (s.events || []).filter((e) => e.item !== "slip+" && serverNow - e.at < 4500);
  const hitIds = new Set(recent.filter((e) => e.pts < 0 && !e.blocked && serverNow - e.at < 1600).map((e) => e.target));
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const deco = (p) => ({ ...p, hit: hitIds.has(p.id), shield: byId[p.id]?.shield, box: byId[p.id]?.box });
  const boxOpen = Boolean(s.item && !s.item.used && serverNow < s.item.deadline);

  return (
    <>
      <World
        focus={onRunway ? 0.3 : focus}
        me={mePilot && deco(mePilot)}
        others={others.map(deco)}
        lines={phase.kind === "round" && mePilot ? { base: myBase * KM_PER_POINT, now: mePilot.km } : null}
        dim={phase.kind === "lobby" || phase.kind === "done"}
        shake={(mine && TIERS[mine.tier]?.lv >= 4) || hitIds.has(me)}
      />
      {hitIds.has(me) && <div className="hitflash" />}
      {!onRunway && <Ruler max={max} me={mePilot} others={others} lines={phase.kind === "round" && mePilot ? { base: myBase * KM_PER_POINT, now: mePilot.km } : null} />}

      {phase.kind === "round" || phase.kind === "reveal" ? (
        <Hud
          km={mePilot?.km ?? 0}
          rounds={room.settings.rounds}
          pips={Array.from({ length: phase.round + (phase.kind === "reveal" ? 1 : 0) }, (_, r) => answers.find((a) => a.player_id === me && a.round === r)?.tier ?? null)}
          left={left}
          total={phase.kind === "round" ? room.settings.seconds : 0}
        />
      ) : (
        <div className="roomhead panel">
          <div>
            <h2>{room.name}</h2>
            <small className="muted">{room.public ? "PUBLIC" : "PRIVATE"} · {room.settings.rounds} rounds · {room.settings.seconds}s · {room.settings.category}{room.settings.retries ? " · retries" : ""}</small>
          </div>
          <Close onClick={me !== null ? leave : () => router.push("/party")} label="Leave room" />
          <button className="codechip" title="Copy invite link" onClick={() => navigator.clipboard?.writeText(`${location.origin}/party?room=${code}`)}>{code} ⧉</button>
        </div>
      )}
      {err && <p className="reject" key={err}>{err}</p>}

      {phase.kind === "lobby" && <Lobby s={s} isHost={isHost} act={act} nick={nick} setNick={setNick} leave={leave} />}
      {phase.kind === "countdown" && <div className="countdown" key={left}>{left || "GO!"}</div>}
      {phase.kind === "round" && <Round key={phase.round} s={s} left={left} act={act} mine={mine} fogLeft={Math.ceil((s.fogUntil - serverNow) / 1000)} boxOpen={boxOpen} />}
      {boxOpen && <MysteryBox key={`box${s.item.round}`} s={s} now={serverNow} act={act} />}
      {recent.length > 0 && <Feed events={recent} s={s} />}
      {phase.kind === "reveal" && <Reveal s={s} left={left} />}
      {phase.kind === "done" && <Final ranked={ranked} s={s} isHost={isHost} act={act} leave={leave} />}
      {me === null && phase.kind !== "lobby" && <p className="center-note">✈ SPECTATING · this race already took off</p>}
    </>
  );
}

function Lobby({ s, isHost, act, nick, setNick, leave }) {
  const { players, me, host, room } = s;
  return (
    <section className="page lobby">
      <div className="cols">
        <div className="panel">
          {me === null && (
            <div className="join">
              <CallSign nick={nick} setNick={setNick} />
              <button className="btn bob" disabled={!nick.trim()} onClick={() => act("join", { nick })}>▲ BOARD THIS FLIGHT</button>
            </div>
          )}
          <h3>PILOTS ON THE RUNWAY · {players.filter((p) => p.active).length}/{room.settings.maxPlayers}</h3>
          <ul className="pilots">
            {players.map((p, i) => (
              <li key={p.id} className={`${p.active ? "" : "away"}${p.id === me ? " me" : ""}`}>
                <span><span className="seat" style={{ "--hue": `${hueOf(i)}deg` }}><Px name="plane" scale={1.5} fps={12} /></span> {p.id === host ? "👑 " : ""}{p.name}{p.id === me ? " (you)" : ""}{p.active ? "" : " · away"}</span>
                {isHost && p.id !== me && <button className="btn ghost sm" onClick={() => act("kick", { playerId: p.id })}>KICK</button>}
              </li>
            ))}
          </ul>
          {isHost ? <button className="btn bob" onClick={() => act("start")}>▲ START THE RACE</button> : me !== null && <p className="muted blink">waiting for the host to start…</p>}
          {me !== null && <button className="btn ghost sm" onClick={leave}>LEAVE ROOM</button>}
        </div>
        <div className="panel">
          <h3>ROOM SETTINGS{isHost ? "" : " · HOST ONLY"}</h3>
          <SettingsForm value={{ ...room.settings, name: room.name, public: room.public }} onSave={(settings) => act("settings", { settings })} cta="SAVE SETTINGS" readOnly={!isHost} />
        </div>
      </div>
    </section>
  );
}

function Round({ s, left, act, mine, fogLeft, boxOpen }) {
  const { phase, prompt, room, me, players } = s;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [big, setBig] = useState(false); // full landed banner for a moment, then a compact one
  const requestSeq = useRef(0);
  const [correction, setCorrection] = useState("");

  useEffect(() => {
    requestSeq.current++;
    setBusy(false);
    setText("");
    setNote("");
    setCorrection("");
  }, [prompt.id]);

  useEffect(() => {
    if (!mine) return;
    setBig(true);
    const t = setTimeout(() => setBig(false), 1800 + Math.max(0, tierOf(mine.tier).lv) * 450);
    return () => clearTimeout(t);
  }, [mine?.tier, mine?.answer]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (answer) => {
    if (!answer.trim() || busy) return;
    const requestId = ++requestSeq.current;
    setBusy(true);
    setNote("");
    setCorrection("");
    let r;
    try {
      r = await act("answer", { answer });
    } finally {
      if (requestId === requestSeq.current) setBusy(false);
    }
    if (requestId !== requestSeq.current) return;
    if (r?.suggest) setCorrection(r.suggest);
    else {
      if (r && !r.tier) setNote(r.locked ? "GROUNDED · no retries in this room" : `"${answer.trim()}" · GROUNDED · try another`);
      if (r && !r.locked) setText("");
    }
  };
  const submit = (e) => {
    e.preventDefault();
    if (correction) {
      setText(correction);
      send(correction);
      return;
    }
    send(text);
  };

  const landed = players.filter((p) => p.landed && p.id !== me).map((p) => p.name);
  return (
    <>
      {!big && (
        <div className={`card${fogLeft > 0 ? " fogged" : ""}`} key={phase.round}>
          <div className="rnd">ROUND {phase.round + 1}/{room.settings.rounds} · {prompt.cat.toUpperCase()}</div>
          <h2 className="prompt">{prompt.text}</h2>
          {fogLeft > 0 && <div className="fogcover"><Px name="fog" scale={4} /><b>FOG BANK!</b><span>clears in {fogLeft}s</span></div>}
          <div className="hint">{landed.length ? `landed: ${landed.join(", ")}` : "nobody has landed yet"}</div>
        </div>
      )}
      {mine && !(boxOpen && !big) && <Landed tier={mine.tier} answer={mine.answer} mini={!big} />}
      {note && !mine && <p className="reject" key={note}>{note}</p>}
      {correction && !mine && !busy && <DidYouMean answer={correction} />}
      {busy && <div className="chip">{text.trim()} ▲</div>}
      {me !== null && !mine && (
        <form onSubmit={submit} className={`dock${note ? " jolt-x" : ""}`} key={`dock${note}`}>
          <input autoFocus value={text} onChange={(e) => { setText(e.target.value); setCorrection(""); }} maxLength={80} placeholder="your rarest answer…" aria-label="Your answer" disabled={busy} />
          <button className="btn" disabled={busy}>{busy ? <span className="blink">…</span> : "LAUNCH"}</button>
        </form>
      )}
      {mine && !big && !boxOpen && <p className="center-note low">waiting for the other pilots · {left}s</p>}
    </>
  );
}

function Reveal({ s, left }) {
  const { phase, prompt, players, answers } = s;
  const name = Object.fromEntries(players.map((p) => [p.id, p.id === s.me ? "YOU" : p.name]));
  const round = answers.filter((a) => a.round === phase.round).sort((a, b) => b.pts - a.pts);
  return (
    <section className="sheet top">
      <p className="eyebrow">ROUND {phase.round + 1} · NEXT IN {left}s</p>
      <h2 className="prompt sm">{prompt.text}</h2>
      <ol className="log">
        {round.length === 0 && <li className="muted">Nobody landed this one.</li>}
        {round.map((a, i) => {
          const t = tierOf(a.tier);
          return (
            <li key={a.player_id} className={`lv${t.lv}`} style={{ "--tc": t.color, animationDelay: `${i * 140}ms` }}>
              <Px name={a.tier || "grounded"} scale={2} fps={4} />
              <span className="lq"><small>{name[a.player_id] ?? "?"}</small><b>{a.answer}</b></span>
              <span className="lt">{t.name}<small>+{a.pts}</small></span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Final({ ranked, s, isHost, act, leave }) {
  const { me, answers, prompts, players } = s;
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <section className="sheet tall">
      {me !== null && <Close onClick={leave} label="Leave room" />}
      <p className="eyebrow">RACE COMPLETE</p>
      <h2 className="chroma big">{ranked[0] ? `${ranked[0].id === me ? "YOU WIN" : ranked[0].name.toUpperCase() + " WINS"}!` : "RACE OVER"}</h2>
      <ol className="podium">
        {ranked.map((p, i) => (
          <li key={p.id} className={`${p.id === me ? "me " : ""}p${i}`}>
            <span>{medal[i] ?? `${i + 1}.`} {p.name}</span>
            <b>{km(p.score)}</b>
            <small>{zoneFor(p.score * KM_PER_POINT)}</small>
          </li>
        ))}
      </ol>
      <details className="rounds">
        <summary>EVERY ROUND</summary>
        {prompts.map((pr, r) => (
          <div key={pr.id} className="roundlog">
            <b>{r + 1}. {pr.text}</b>
            {players.map((p) => {
              const a = answers.find((x) => x.round === r && x.player_id === p.id);
              const t = tierOf(a?.tier);
              return <span key={p.id} style={{ "--tc": t.color }}>{p.name}: {a ? <><b className="tc">{a.answer}</b> · {t.name} +{a.pts}</> : <span className="muted">(no answer)</span>}</span>;
            })}
          </div>
        ))}
      </details>
      <div className="row gap">
        {isHost ? <button className="btn" onClick={() => act("reset")}>RACE AGAIN</button> : <p className="muted">the host can start another race</p>}
        {me !== null && <button className="btn ghost" onClick={leave}>LEAVE</button>}
      </div>
    </section>
  );
}

// ---------------- mystery box: shake → slot-machine roll → pick a target before the next round ----------------
const ROLL = Object.keys(ITEMS);
function MysteryBox({ s, now, act }) {
  const def = ITEMS[s.item.item];
  const [stage, setStage] = useState("box"); // box → roll → ready
  const [spin, setSpin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setStage("roll"), 900);
    const b = setTimeout(() => setStage("ready"), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    if (stage !== "roll") return;
    let delay = 55, t;
    const step = () => { setSpin((n) => n + 1); delay *= 1.13; t = setTimeout(step, delay); }; // slows like a slot reel
    t = setTimeout(step, delay);
    return () => clearTimeout(t);
  }, [stage]);

  if (skipped) return null;
  const secs = Math.max(0, Math.ceil((s.item.deadline - now) / 1000));
  const seat = (id) => s.players.findIndex((p) => p.id === id);
  const others = s.players.filter((p) => p.id !== s.me);
  const myScore = s.players.find((p) => p.id === s.me)?.score ?? 0;
  const leader = [...others].sort((a, b) => b.score - a.score)[0];
  const use = async (target) => { setBusy(true); await act("use", { target }); setBusy(false); };

  return (
    <div className={`mbox stage-${stage}`} style={{ "--ic": def.color }}>
      {stage === "box" && (<><p className="eyebrow">MYSTERY BOX!</p><Px name="mbox" scale={5} fps={6} className="boxshake" /></>)}
      {stage === "roll" && (<><p className="eyebrow">ROLLING…</p><div className="slot"><Px name={ITEMS[ROLL[spin % ROLL.length]].sprite} scale={5} fps={4} /></div></>)}
      {stage === "ready" && (
        <>
          <div className="mhead">
            <span className="mitem"><Px name={def.sprite} scale={4} fps={4} /></span>
            <div><h3>{def.name}</h3><p>{def.desc}</p></div>
          </div>
          <p className={`mtimer${secs <= 4 ? " hot" : ""}`}>use it within {secs}s or it's lost</p>
          {def.target === "self" || def.target === "leader" ? (
            <button className="btn" disabled={busy || (def.target === "leader" && !leader)} onClick={() => use(null)}>
              {def.target === "leader" ? `STRIKE ${leader?.name ?? "THE LEADER"}` : "ACTIVATE"}
            </button>
          ) : (
            <div className="targets">
              {others.map((p) => {
                const ok = def.target !== "ahead" || p.score > myScore;
                return (
                  <button key={p.id} className="btn ghost sm" disabled={busy || !ok} onClick={() => use(p.id)} title={ok ? "" : "Only pilots above you"}>
                    <span className="seat" style={{ "--hue": `${hueOf(seat(p.id))}deg` }}><Px name="plane" scale={1.2} fps={12} /></span>
                    {p.name}<small>{km(p.score)}{p.shield ? " · shield" : ""}</small>
                  </button>
                );
              })}
            </div>
          )}
          <button className="linkbtn" onClick={() => setSkipped(true)}>skip it</button>
        </>
      )}
    </div>
  );
}

// ---------------- live combat feed ----------------
function Feed({ events, s }) {
  const name = (id) => (id === s.me ? "YOU" : s.players.find((p) => p.id === id)?.name ?? "a pilot");
  const pos = (id) => (id === s.me ? "Your" : `${name(id)}'s`);
  const text = (e) => {
    const it = ITEMS[e.item];
    if (e.item === "box") return `${name(e.by)} found a mystery box!`;
    if (e.blocked) return `${pos(e.target)} Flak Shield blocked ${e.by === s.me ? "your" : pos(e.by)} ${it.name}!`;
    switch (e.item) {
      case "missile": return `${name(e.by)} hit ${name(e.target)} with a Homing Missile · ${e.pts} km`;
      case "thunder": return `Thunderhead strikes ${name(e.target)}! · ${e.pts} km`;
      case "slip": return `${name(e.by)} slipstreamed ${-e.pts} km from ${name(e.target)}`;
      case "fog": return `${name(e.by)} rolled a Fog Bank onto ${name(e.target)}`;
      case "tailwind": return `${name(e.by)} caught a Tailwind · +${e.pts} km`;
      case "shield": return `${name(e.by)} raised a Flak Shield`;
    }
    return "";
  };
  return (
    <ul className="feed" aria-live="polite">
      {events.slice(-3).map((e) => (
        <li key={e.id} className={`${e.target === s.me && (e.pts < 0 || e.item === "fog") && !e.blocked ? "bad" : ""}${e.blocked ? " blocked" : ""}`} style={{ "--ic": e.item === "box" ? "#ffd166" : ITEMS[e.item]?.color }}>
          <Px name={e.blocked ? "shield" : e.item === "box" ? "mbox" : ITEMS[e.item].sprite} scale={1.5} fps={4} />
          <span>{text(e)}</span>
        </li>
      ))}
    </ul>
  );
}
