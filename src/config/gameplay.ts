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

export type MeteorRecovery = { x: number; y: number; velocityX: number; velocityY: number };

export const escapedMeteorRecovery = (x: number, y: number, velocityX: number, velocityY: number): MeteorRecovery | undefined => {
  const margin = PHYSICS.meteorRadius * 2;
  if (y < -margin) {
    return { x: 790, y: 125, velocityX: -Math.max(6, Math.min(10, Math.abs(velocityY) * 0.7)), velocityY: 4 };
  }
  if (x < -margin) {
    return { x: 95, y: clamp(y, 100, 620), velocityX: Math.max(5, Math.abs(velocityX)), velocityY };
  }
  if (x > GAME_WIDTH + margin) {
    return { x: 865, y: clamp(y, 100, 620), velocityX: -Math.max(5, Math.abs(velocityX)), velocityY };
  }
  return undefined;
};
