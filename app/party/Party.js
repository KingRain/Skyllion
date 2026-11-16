"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, DEFAULTS } from "@/lib/rooms";
import { TIERS, GROUNDED, KM_PER_POINT } from "@/lib/tiers";

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

export default function Party({ code }) {
  const [token, setToken] = useState("");
  const [nick, setNick] = useState("");
  useEffect(() => { setToken(local("skyllion-token", uuid)); setNick(local("skyllion-nick")); }, []);
  const saveNick = (n) => { setNick(n); try { localStorage.setItem("skyllion-nick", n); } catch {} };

  return (
    <div className="sky night">
      <div className="stars" />
      <header>
        <a className="logo" href="/">SKYLLION</a>
        <a className="ghost small" href="/party">🛩️ Dogfight</a>
      </header>
      <main>
        {token && (code ? <Room code={code} token={token} nick={nick} setNick={saveNick} /> : <Hangar token={token} nick={nick} setNick={saveNick} />)}
      </main>
    </div>
  );
}

function CallSign({ nick, setNick }) {
  return (
    <label className="field">
      <span>Your call sign</span>
      <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 20))} placeholder="Maverick" maxLength={20} />
    </label>
  );
}

// Lobby browser: create a room, join by code, or pick a public one.
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
    <section className="center wide">
      <h1>Dogfight</h1>
      <p className="muted">Same prompts, same clock, one sky. Rarest answers climb highest.</p>
      <CallSign nick={nick} setNick={setNick} />
      {err && <p className="err">{err}</p>}

      <div className="cards">
        <div className="card">
          <h3>Join with a code</h3>
          <form className="answer" onSubmit={(e) => { e.preventDefault(); if (joinCode.length === 5) router.push(`/party?room=${joinCode}`); }}>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))} placeholder="ABCDE" aria-label="Room code" className="code-input" />
            <button className="cta" disabled={joinCode.length !== 5}>Join</button>
          </form>

          <h3>Public skies</h3>
          {rooms === null ? <p className="muted small">Scanning radar…</p> : rooms.length === 0 ? <p className="muted small">No open public rooms. Start one!</p> : (
            <ul className="rooms">
              {rooms.map((r) => (
                <li key={r.code}>
                  <a href={`/party?room=${r.code}`}>
                    <b>{r.name}</b>
                    <span className="muted small">{r.players}/{r.settings.maxPlayers} pilots · {r.settings.rounds} rounds · {r.settings.seconds}s · {r.settings.category}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Create a room</h3>
          <SettingsForm value={DEFAULTS} onSave={create} cta={nick.trim() ? "Create room" : "Pick a call sign first"} disabled={!nick.trim()} />
        </div>
      </div>
    </section>
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
        <label className="field"><span>Room name</span><input name="name" defaultValue={value.name} maxLength={40} /></label>
        <label className="check"><input type="checkbox" name="public" defaultChecked={value.public} /> Public (listed in Public skies)</label>
        <div className="grid3">
          <label className="field"><span>Rounds</span><input type="number" name="rounds" min={1} max={15} defaultValue={value.rounds} /></label>
          <label className="field"><span>Seconds</span><input type="number" name="seconds" min={10} max={60} step={5} defaultValue={value.seconds} /></label>
          <label className="field"><span>Max pilots</span><input type="number" name="maxPlayers" min={2} max={12} defaultValue={value.maxPlayers} /></label>
        </div>
        <label className="field"><span>Category</span>
          <select name="category" defaultValue={value.category}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="check"><input type="checkbox" name="retries" defaultChecked={value.retries} /> Retry after a grounded answer</label>
      </fieldset>
      {!readOnly && <button className="cta" disabled={disabled}>{cta}</button>}
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

  if (missing) return <section className="center"><h2>Room {code} not found</h2><a className="cta" href="/party">Back to the hangar</a></section>;
  if (!s) return <section className="center"><p className="ascending">Contacting tower…</p></section>;

  const { room, phase, players, me, host } = s;
  const isHost = me !== null && me === host;
  const left = phase.endsAt ? Math.max(0, Math.ceil((phase.endsAt - (now + offset)) / 1000)) : 0;
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <section className="center wide">
      <div className="row roomhead">
        <div>
          <h2>{room.name}</h2>
          <p className="muted small">{room.public ? "🌐 Public" : "🔒 Private"} · {room.settings.rounds} rounds · {room.settings.seconds}s · {room.settings.category}{room.settings.retries ? " · retries on" : ""}</p>
        </div>
        <button className="codechip" title="Copy invite link" onClick={() => navigator.clipboard?.writeText(`${location.origin}/party?room=${code}`)}>{code} ⧉</button>
      </div>
      {err && <p className="err">{err}</p>}

      {me === null && (
        phase.kind === "lobby" ? (
          <div className="card">
            <CallSign nick={nick} setNick={setNick} />
            <button className="cta" disabled={!nick.trim()} onClick={() => act("join", { nick })}>Board this flight</button>
          </div>
        ) : <p className="muted">✈️ Spectating. This race already took off.</p>
      )}

      {phase.kind === "lobby" && (
        <Lobby s={s} isHost={isHost} act={act} />
      )}

      {phase.kind === "countdown" && <div className="countdown pop" key={left}>{left || "GO"}</div>}

      {phase.kind === "round" && <Round key={phase.round} s={s} left={left} act={act} />}

      {phase.kind === "reveal" && <Reveal s={s} left={left} />}

      {phase.kind === "done" && <Final s={s} isHost={isHost} act={act} />}

      {phase.kind !== "lobby" && phase.kind !== "done" && <Board players={ranked} me={me} host={host} />}

      {me !== null && <button className="ghost small" onClick={leave}>Leave room</button>}
    </section>
  );
}

function Lobby({ s, isHost, act }) {
  const { players, me, host, room } = s;
  return (
    <div className="cards">
      <div className="card">
        <h3>Pilots ({players.filter((p) => p.active).length}/{room.settings.maxPlayers})</h3>
        <ul className="pilots">
          {players.map((p) => (
            <li key={p.id} className={p.active ? "" : "away"}>
              <span>{p.id === host ? "👑 " : "🧑‍✈️ "}{p.name}{p.id === me ? " (you)" : ""}{p.active ? "" : " · away"}</span>
              {isHost && p.id !== me && <button className="ghost small" onClick={() => act("kick", { playerId: p.id })}>Kick</button>}
            </li>
          ))}
        </ul>
        {isHost ? (
          <button className="cta" onClick={() => act("start")}>🛫 Start the race</button>
        ) : (
          <p className="muted small">Waiting for the host to start…</p>
        )}
      </div>
      <div className="card">
        <h3>Room settings{isHost ? "" : " (host only)"}</h3>
        <SettingsForm value={{ ...room.settings, name: room.name, public: room.public }} onSave={(settings) => act("settings", { settings })} cta="Save settings" readOnly={!isHost} />
      </div>
    </div>
  );
}

function Round({ s, left, act }) {
  const { phase, prompt, room, me, players, answers } = s;
  const mine = answers.find((a) => a.player_id === me && a.round === phase.round);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote("");
    const r = await act("answer", { answer: text });
    setBusy(false);
    if (r && !r.tier) setNote(r.locked ? "Grounded. No retries in this room." : `"${text.trim()}" got grounded. Try another!`);
    if (r && !r.locked) setText("");
  };

  return (
    <div className="center">
      <p className="muted small">Round {phase.round + 1}/{room.settings.rounds} · {prompt.cat}</p>
      <h2 className="prompt">{prompt.text}</h2>
      <div className="fuel"><div style={{ width: `${(left / room.settings.seconds) * 100}%` }} className={left <= 5 ? "low" : ""} /></div>
      <p className="timer">{left}s</p>
      {me === null ? null : mine ? (
        <div className="verdict pop">
          {tierOf(mine.tier).img ? <img src={tierOf(mine.tier).img} alt="" /> : <span className="big">{GROUNDED.emoji}</span>}
          <b>{mine.answer}: {tierOf(mine.tier).name}</b>
          <span>+{mine.pts} pts · waiting for the other pilots…</span>
        </div>
      ) : (
        <form onSubmit={submit} className="answer">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Your rarest answer…" aria-label="Your answer" disabled={busy} />
          <button className="cta" disabled={busy}>{busy ? <span className="ascending">ascending…</span> : "Launch"}</button>
        </form>
      )}
      {note && <p className="err">{note}</p>}
      <p className="muted small">Landed: {players.filter((p) => p.landed).map((p) => p.name).join(", ") || "nobody yet"}</p>
    </div>
  );
}

function Reveal({ s, left }) {
  const { phase, prompt, players, answers } = s;
  const name = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const round = answers.filter((a) => a.round === phase.round).sort((a, b) => b.pts - a.pts);
  return (
    <div className="card">
      <p className="muted small">Round {phase.round + 1} results · next in {left}s</p>
      <h3>{prompt.text}</h3>
      <ul className="pilots">
        {round.length === 0 && <li className="muted">Nobody landed this one.</li>}
        {round.map((a) => (
          <li key={a.player_id} className="pop">
            <span>{tierOf(a.tier).emoji} <b>{a.answer}</b> <span className="muted">· {name[a.player_id] ?? "?"}</span></span>
            <span>{tierOf(a.tier).name} +{a.pts}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Board({ players, me, host }) {
  return (
    <div className="card">
      <h3>Altitude board</h3>
      <ol className="pilots">
        {players.map((p) => (
          <li key={p.id} className={p.id === me ? "me" : ""}>
            <span>{p.id === host ? "👑 " : ""}{p.name}{p.landed ? " ✅" : ""}</span><b>{km(p.score)}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Final({ s, isHost, act }) {
  const { players, me, answers, prompts } = s;
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <>
      <p className="muted">Race complete</p>
      <h1>{ranked[0] ? `${ranked[0].name} wins!` : "Race over"}</h1>
      <div className="card">
        <ol className="pilots podium">
          {ranked.map((p, i) => (
            <li key={p.id} className={p.id === me ? "me" : ""}><span>{medal[i] ?? `${i + 1}.`} {p.name}</span><b>{km(p.score)}</b></li>
          ))}
        </ol>
      </div>
      <details className="card">
        <summary>Every round</summary>
        {prompts.map((pr, r) => (
          <div key={pr.id} className="roundlog">
            <b>{r + 1}. {pr.text}</b>
            {players.map((p) => {
              const a = answers.find((x) => x.round === r && x.player_id === p.id);
              return <span key={p.id} className="muted small">{p.name}: {a ? `${a.answer} · ${tierOf(a.tier).emoji} +${a.pts}` : "(no answer)"}</span>;
            })}
          </div>
        ))}
      </details>
      {isHost ? <button className="cta" onClick={() => act("reset")}>🔁 Race again (back to lobby)</button> : <p className="muted small">The host can start another race.</p>}
    </>
  );
}
