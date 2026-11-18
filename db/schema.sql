-- levenshtein() is used to find a candidate spelling for explicit confirmation.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Cached judge verdicts: keeps scoring consistent for everyone and spares the model. `hits` = how often players gave it.
CREATE TABLE IF NOT EXISTS judgments (
  prompt_id  text NOT NULL,
  answer     text NOT NULL,
  tier       text,            -- null = grounded (invalid)
  valid      real NOT NULL,
  clever     real NOT NULL,
  rarity     real NOT NULL,
  hits       integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, answer)
);

-- One row per finished daily ascent, for the "you out-climbed X% of pilots" line.
CREATE TABLE IF NOT EXISTS runs (
  id         bigserial PRIMARY KEY,
  day        date NOT NULL,
  score      integer NOT NULL CHECK (score BETWEEN 0 AND 700),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_day_score ON runs (day, score);

-- Dogfight (multiplayer). Lobby = started_at IS NULL; the rest of the game clock is derived from started_at.
CREATE TABLE IF NOT EXISTS rooms (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  public     boolean NOT NULL DEFAULT true,
  settings   jsonb NOT NULL,
  seed       text NOT NULL,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_open_public ON rooms (created_at DESC) WHERE public AND started_at IS NULL;

-- `token` is the player's private browser id; `id` is the public one other players see. Host = earliest active player.
CREATE TABLE IF NOT EXISTS room_players (
  id        bigserial PRIMARY KEY,
  room_code text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  token     uuid NOT NULL,
  name      text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_code, token)
);

-- One locked-in answer per player per round (grounded answers are only stored when retries are off).
CREATE TABLE IF NOT EXISTS room_answers (
  room_code  text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  player_id  bigint NOT NULL REFERENCES room_players (id) ON DELETE CASCADE,
  round      integer NOT NULL,
  answer     text NOT NULL,
  tier       text,
  pts        integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, player_id, round)
);

DROP TABLE IF EXISTS gpu_endpoint;

-- Dogfight mystery boxes: at most one per room per round (the PK enforces it atomically).
CREATE TABLE IF NOT EXISTS room_items (
  room_code  text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  round      integer NOT NULL,
  player_id  bigint NOT NULL,
  item       text NOT NULL,
  target     bigint,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, round)
);
-- Everything that moves a score besides answers (power-ups), plus feed-only rows (box found, shield, fog).
CREATE TABLE IF NOT EXISTS room_events (
  id         bigserial PRIMARY KEY,
  room_code  text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  round      integer NOT NULL,
  by_player  bigint,
  target     bigint,
  item       text NOT NULL,
  pts        integer NOT NULL DEFAULT 0,
  blocked    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_events_room ON room_events (room_code, id);
ALTER TABLE room_players ADD COLUMN IF NOT EXISTS shield_round integer; -- shield active while <= this round
ALTER TABLE room_players ADD COLUMN IF NOT EXISTS fog_round integer;    -- prompt fogged in this round
