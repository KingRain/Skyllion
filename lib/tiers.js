// Each landed answer adds altitude: 1 point = 1 km. A perfect 700-point day reaches 700 km (past the ISS).
export const KM_PER_POINT = 1;
export const ROUNDS = 7;
export const SECONDS = 25;

// color = loot-style rarity colour; lv = how hard the effects hit (glow, sparkles, rays, flash).
export const TIERS = {
  paper:    { name: "Paper Plane",       pts: 10,  emoji: "📄", color: "#e6ecf7", lv: 0,    blurb: "Everyone folded this one." },
  roll:     { name: "Barrel Roll",       pts: 15,  emoji: "🌀", color: "#ff9f43", lv: 1,    blurb: "Technically correct. Show-off." },
  flyer:    { name: "Frequent Flyer",    pts: 30,  emoji: "✈️", color: "#62e48b", lv: 1, blurb: "A well-travelled answer." },
  jet:      { name: "Jet Stream",        pts: 60,  emoji: "🛩️", color: "#4dc3ff", lv: 2,     blurb: "Riding the high winds." },
  deep:     { name: "Deep Space",        pts: 85,  emoji: "🚀", color: "#b78cff", lv: 3,     blurb: "Few pilots get up here." },
  skyllion: { name: "One in a Skyllion", pts: 100, emoji: "🌟", color: "#ffd166", lv: 4,       blurb: "The star answer." },
};
export const GROUNDED = { name: "Grounded", pts: 0, emoji: "☁️", color: "#8a9cc2", lv: -1, blurb: "Doesn't fit the prompt." };

// Nimble v3's weighted rarity score (0..4 scale) bunches up in practice: obvious ≈0.1–0.6, common ≈0.6–1.3,
// uncommon ≈1.4–2.0, obscure ≈2.2–2.6, and the rare gems ≈2.75+. Thresholds come from scripts/simulate.mjs runs.
// ponytail: fixed cut-offs, re-fit from the judgments table once real plays pile up.
const RARITY_CUTS = [[0.65, "paper"], [1.4, "flyer"], [2.2, "jet"], [2.75, "deep"]];

// Maps the Nimble v3 answers (probabilities / weighted score) to a tier key, or null when grounded.
export function tierFor({ valid, clever, rarity }) {
  if (clever >= 0.8) return "roll"; // a cheeky pun/technicality earns the Barrel Roll even if not strictly valid
  if (valid < 0.5) return null;
  for (const [max, k] of RARITY_CUTS) if (rarity < max) return k;
  return "skyllion";
}

// Atmosphere layers, ascending.
const ZONES = [
  [0, "On the Runway"],
  [1, "Troposphere"],
  [12, "Stratosphere"],
  [50, "Mesosphere"],
  [85, "Thermosphere"],
  [100, "Kármán Line: Space!"],
  [408, "ISS Orbit"],
  [600, "Exosphere"],
  [700, "Escape Velocity"],
];
export function zoneFor(km) {
  let z = ZONES[0][1];
  for (const [min, name] of ZONES) if (km >= min) z = name;
  return z;
}
