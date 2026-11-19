import { TIERS } from "./tiers.js";

// Rarity remains dominant: at least 80% of a valid tier, plus up to 20% for speed.
// Input is elapsed time at submission, never time spent waiting for a verdict.
export const SPEED_SHARE = 0.2;
export function awardFor(tier, elapsedMs, durationMs) {
  const maxPts = TIERS[tier]?.pts ?? 0;
  if (!maxPts || !Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0 || elapsedMs >= durationMs) {
    return { pts: 0, basePts: 0, speedBonus: 0 };
  }
  const remaining = 1 - Math.min(1, Math.max(0, elapsedMs / durationMs));
  const basePts = Math.round(maxPts * (1 - SPEED_SHARE));
  const speedBonus = Math.round((maxPts - basePts) * remaining);
  return { pts: basePts + speedBonus, basePts, speedBonus };
}

// Old saved results predate timing data; keep their original awards.
export const pointsOf = (result) => result.pts ?? TIERS[result.tier]?.pts ?? 0;
