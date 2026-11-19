<p align="center">
  <img src="public/px/plane-8x.png" width="176" alt="Skyllion pixel-art plane mascot" />
</p>

<h1 align="center">Skyllion</h1>
<p align="center"><b>one in a skyllion</b> · the daily ascent</p>
<p align="center">
  A rare-answer trivia game. Give the most unusual <i>valid</i> answer you can think of and climb from the runway to orbit.<br/>
  Answers are judged in real time by <b>clef-flash</b> on Cloudflare Workers AI.
</p>

---

## How to play

Every day everyone gets the same **7 prompts** ("Name a moon in our solar system", "Name an airline", …). You have **25 seconds** for each one.

- Obvious answers barely get you off the ground. Rare ones send you into orbit.
- A wrong or off-category answer is **Grounded** and earns nothing, but you can try again while the fuel bar lasts.
- A valid answer earns **80% of its tier maximum**, plus up to **20% for speed**. The bonus decreases linearly with time spent before submission, rounded to whole points. A 60-point Jet Stream submitted halfway through the round earns 48 base + 6 speed = **54 km**. Waiting for the judge never reduces the bonus.
- **1 point = 1 km of altitude.** A perfect day is 700 km, past the ISS and into the exosphere.

| Tier | Maximum points | What it means |
|---|---:|---|
| 📄 Paper Plane | 10 | Everyone folded this one |
| 🌀 Barrel Roll | 15 | A cheeky pun or technicality. Show-off. |
| ✈️ Frequent Flyer | 30 | A well-travelled answer |
| 🛩️ Jet Stream | 60 | Riding the high winds |
| 🚀 Deep Space | 85 | Few pilots get up here |
| 🌟 One in a Skyllion | 100 | The star answer |

The whole game is one tall, scrolling pixel-art sky. Your plane climbs past birds, balloons, airliners at cruising altitude, weather balloons, meteors, the aurora, satellites, the ISS and the Moon. Dashed tier lines show where each answer would carry you, and they light up in the tier's rarity colour as you pass them. Rarer answers hit harder: a green glow, then pulsing blue, then purple light rays, and for **One in a Skyllion** a golden flash, sparkle burst and screen shake.

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
- During a round you only see *who* has landed. Everyone's answers are revealed together when the round ends, and every plane climbs at once.
- Each pilot flies their own colour of plane. Opponents are drawn in the sky at their altitude and named on the altitude ruler, even when they're off-screen.

## How it works

```
 Browser ──► Vercel (Next.js 15) ──► Neon Postgres   verdict cache · daily runs · rooms
                    │
                    └──► Cloudflare Workers AI (clef-flash)
```

**The judge.** Each new answer becomes a single call to Cloudflare's `clef-flash` model (System One question format), asking three questions about it:

| Question | Type | Used for |
|---|---|---|
| `valid` | `noul` (probability of true) | Does it actually fit the prompt? Misspellings and aliases are allowed. |
| `clever` | `noul` | Is it a pun or technicality? Earns the Barrel Roll. |
| `rarity` | `score` (0–4) | How unusual would this be across 1,000 players? |

`lib/tiers.js` maps those probabilities to a tier. The cut-offs were fitted from real model output (run `npm run simulate` to see them). Every verdict is cached in Neon, so the same answer always gets the same ruling and the model is only asked once. That also makes repeat answers instant.

**Live multiplayer.** Each browser opens one authenticated, fetch-based server-sent event stream. Successful room actions publish PostgreSQL notifications; one direct `LISTEN` connection per server process fans those notifications out to the appropriate streams. A fresh, personalized snapshot keeps other pilots' current answers and held items private. Round transitions use scheduled deadlines derived from `started_at`, and planes, the camera and ruler animate together from their current positions. The public room directory still refreshes every four seconds; active races do not poll.

The stream writes presence every ten seconds, drops absent pilots from the active list after 35 seconds, and reconnects with a full snapshot before the 60-second Vercel function limit. The client also reconnects after transport failure, a stalled heartbeat or returning to the tab. A monotonic local clock drives the countdown independently of snapshot arrival times. Notifications contain room codes only; player tokens travel in request headers, never stream URLs.

**Submission scoring.** Dogfight captures the server's request-arrival time and verifies the race and round before judging. Duplicate submissions settle once. Solo uses the same scoring function with a monotonic timer; accepted requests can finish judging after the deadline. Existing saved scores retain their original values. This is Skyllion's explicit 80/20 rule, rather than a claim to reproduce Krillion's unpublished scoring formula.

## Run it locally

Requirements: Node 22, a [Neon](https://neon.com) project, a Cloudflare account with a Workers AI token.

```sh
npm install
neon deploy                     # writes DATABASE_URL into .env.local
# add CF_ACCOUNT_ID and CF_API_TOKEN to .env.local (and to Vercel)
npm run migrate                 # creates the tables
npm run dev                     # http://localhost:3000
```

Set the same `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CF_ACCOUNT_ID` and `CF_API_TOKEN` on the Vercel project. Optional: `CF_MODEL` (default `clef-flash`). The room listener requires the direct/unpooled URL because Neon's transaction pooler does not support `LISTEN`. No additional service or schema migration is required for room streaming.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run migrate` | Apply `db/schema.sql` to Neon (direct connection) |
| `npm test` | Rules, scoring bounds/decay, streaming parser, subscription lifecycle and interpolation checks |
| `npm run test:realtime` | Integration test against the local server on port 3001: temporary private room, two players, spectator, notifications, reveals, scoring, reconnect, reset and cleanup. Set `DATABASE_URL_UNPOOLED` in `.env.local`. |
| `node scripts/pixel-art.mjs` | Regenerate every sprite in `public/px/` from the ASCII pixel grids (no image tools needed) |
| `npm run simulate` | Send a batch of sample answers to the judge and print raw scores and tiers |


## Project layout

```
app/Sky.js                the pixel sky: world, sprites, HUD, ruler, rarity effects
app/page.js               solo game: daily, unlimited, archive, stats, FAQ
app/party/Party.js        Dogfight: room browser, lobby, rounds, reveals, podium
app/api/judge             answer → tier (cached verdict)
app/api/rooms             list / create rooms; [code] = room state + actions
lib/judge.js              Cloudflare judge client + verdict cache
lib/tiers.js              tiers, thresholds, altitude zones
lib/rooms.js              room settings + time-derived game clock
lib/prompts.js            prompt bank + seeded daily selection
db/schema.sql             all tables
scripts/pixel-art.mjs     sprite source: ASCII pixel grids, encoded to PNG
public/px/                generated pixel-art sprites (plane, tiers, scenery)
```

## Credits

- Inspired by [Krillion](https://krillion.io), the daily rare-answer dive. Skyllion is an independent fan take that flips it upward. It isn't affiliated, and all of its art is original.
- Answers are judged by Cloudflare Workers AI (`clef-flash`).
