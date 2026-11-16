<p align="center">
  <img src="public/mascot.svg" width="96" alt="Skyllion rocket mascot" />
</p>

<h1 align="center">Skyllion</h1>
<p align="center"><b>one in a skyllion</b> · the daily ascent</p>
<p align="center">
  A rare-answer trivia game. Give the most unusual <i>valid</i> answer you can think of and climb from the runway to orbit.<br/>
  Answers are judged in real time by <b>Nimble v3</b>, a local decision model running on your own GPU.
</p>

---

## How to play

Every day everyone gets the same **7 prompts** ("Name a moon in our solar system", "Name an airline", …). You have **25 seconds** for each one.

- Obvious answers barely get you off the ground. Rare ones send you into orbit.
- A wrong or off-category answer is **Grounded** and earns nothing, but you can try again while the fuel bar lasts.
- **1 point = 1 km of altitude.** A perfect day is 700 km, past the ISS and into the exosphere.

| Tier | Points | What it means |
|---|---:|---|
| 📄 Paper Plane | 10 | Everyone folded this one |
| 🌀 Barrel Roll | 15 | A cheeky pun or technicality. Show-off. |
| ✈️ Frequent Flyer | 30 | A well-travelled answer |
| 🛩️ Jet Stream | 60 | Riding the high winds |
| 🚀 Deep Space | 85 | Few pilots get up here |
| 🌟 One in a Skyllion | 100 | The star answer |

You pass through atmosphere zones as you climb: Troposphere → Stratosphere → Mesosphere → Thermosphere → **Kármán Line** → ISS Orbit → Exosphere → Escape Velocity.

## Modes

| Mode | |
|---|---|
| 🛫 **Daily ascent** | Shared prompts, reset at midnight US Eastern. Builds your streak. Your result is ranked against everyone else's. |
| ∞ **Unlimited** | Random prompts, as many runs as you like. |
| ⟲ **Archive** | Replay past days. Doesn't count toward streaks. |
| 🛩️ **Dogfight** | Multiplayer rooms, public or private. Same prompts and clock for everyone, with live reveals and a final podium. |
| 🧑‍✈️ **My Skyllion** | Streak, best climb, and a hangar of crafts you unlock by landing each tier. |

### Dogfight rooms

- **Public** rooms are listed under *Public skies*. **Private** rooms are joined with a 5-letter code or an invite link.
- The host sets the room name, visibility, rounds (1–15), seconds per round (10–60), max pilots (2–12), category, and whether you can retry after a grounded answer.
- The host can kick pilots, start the race, and run it back. If the host leaves, the crown passes to the next pilot.
- During a round you only see *who* has landed. Everyone's answers are revealed together when the round ends.

## How it works

```
 Browser ──► Vercel (Next.js 15) ──► Neon Postgres   verdict cache · daily runs · rooms
                    │
                    └──► Cloudflare tunnel ──► GPU gateway (your PC) ──► Ollama ──► Nimble v3
```

**The judge.** Each new answer becomes a single call to Ollama's System One endpoint (`POST /v1/systemone`), asking three questions about it:

| Question | Type | Used for |
|---|---|---|
| `valid` | `noul` (probability of true) | Does it actually fit the prompt? Misspellings and aliases are allowed. |
| `clever` | `noul` | Is it a pun or technicality? Earns the Barrel Roll. |
| `rarity` | `score` (0–4) | How unusual would this be across 1,000 players? |

`lib/tiers.js` maps those probabilities to a tier. The cut-offs were fitted from real model output (run `npm run simulate` to see them). Every verdict is cached in Neon, so the same answer always gets the same ruling and the model is only asked once. That also makes repeat answers instant.

**The home GPU.** Vercel can't reach `localhost`, so `npm run gpu` starts two things:
1. A tiny **gateway** that accepts only `POST /v1/systemone` with a secret bearer token and forces the Nimble model. Every other Ollama endpoint stays private.
2. A **Cloudflare quick tunnel** to it. The tunnel's URL is written to Neon (`gpu_endpoint`) and the deployed app reads it from there, so restarting the tunnel never needs a redeploy.

**Multiplayer without a game server.** Every room's clock is derived from a single `started_at` timestamp, so no background worker or WebSocket server is needed. Clients poll the room once a second, and the server hides each round's answers until the round closes.

## Run it locally

Requirements: Node 22, [Ollama](https://ollama.com) ≥ 0.40.4, a [Neon](https://neon.com) project.

```sh
ollama pull nimble-v3           # Bespoke Labs' 9B decision model (~6–10 GB)
npm install
neon deploy                     # writes DATABASE_URL into .env.local
npm run migrate                 # creates the tables
npm run dev                     # http://localhost:3000
```

Locally the app talks to Ollama at `http://127.0.0.1:11434` directly.

## Deploy (Vercel + your GPU)

```sh
npm run gpu                     # gateway + tunnel; keep it running while people play
```

Set these on the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `OLLAMA_TOKEN` | Same value as `GPU_TOKEN` in your local `.env.gpu` |

When your PC is off, the game still loads but answers show *"Control tower offline"*.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run migrate` | Apply `db/schema.sql` to Neon (direct connection) |
| `npm run gpu` | Expose the local Nimble judge to the deployed app |
| `npm test` | Self-checks: tier mapping, daily prompts, room clock, settings clamping |
| `npm run simulate` | Send a batch of sample answers to Nimble and print raw scores and tiers |

Optional env: `NIMBLE_MODEL` (default `nimble-v3`), `OLLAMA_URL` (overrides everything).

## Project layout

```
app/page.js               solo game: daily, unlimited, archive, stats, FAQ
app/party/Party.js        Dogfight: room browser, lobby, rounds, reveals, podium
app/api/judge             answer → tier (cached Nimble verdict)
app/api/rooms             list / create rooms; [code] = room state + actions
lib/nimble.js             System One client + verdict cache
lib/tiers.js              tiers, thresholds, altitude zones
lib/rooms.js              room settings + time-derived game clock
lib/prompts.js            prompt bank + seeded daily selection
scripts/gpu-gateway.mjs   token-guarded GPU gateway + Cloudflare tunnel
db/schema.sql             all tables
public/                   original SVG art (mascot, tier badges)
```

## Credits

- Inspired by [Krillion](https://krillion.io), the daily rare-answer dive. Skyllion is an independent fan take that flips it upward. It isn't affiliated, and all of its art is original.
- Answers are judged by **Nimble v3** from Bespoke Labs, served by Ollama. The model is licensed **CC BY-NC 4.0 (non-commercial use only)**.
