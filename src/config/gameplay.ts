export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;

export const PHYSICS = {
  gravityY: 0.66,
  meteorRadius: 13,
  maxSpeed: 22,
  launchMin: 0.026,
  launchMax: 0.058,
  chargeMs: 1200,
  stuckMs: 4500,
  stuckSpeed: 0.45,
} as const;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const launchPower = (heldMs: number): number => {
  const ratio = clamp(heldMs / PHYSICS.chargeMs, 0, 1);
  if (ratio === 0) return PHYSICS.launchMin;
  if (ratio === 1) return PHYSICS.launchMax;
  return PHYSICS.launchMin + (PHYSICS.launchMax - PHYSICS.launchMin) * ratio;
};
