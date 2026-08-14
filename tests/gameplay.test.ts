import { describe, expect, it } from 'vitest';
import { PHYSICS, clamp, escapedMeteorRecovery, launchPower } from '../src/config/gameplay';

describe('gameplay configuration', () => {
  it('clamps values to a safe range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it('maps spring hold time to configured launch power', () => {
    expect(launchPower(0)).toBe(PHYSICS.launchMin);
    expect(launchPower(PHYSICS.chargeMs)).toBe(PHYSICS.launchMax);
    expect(launchPower(PHYSICS.chargeMs * 2)).toBe(PHYSICS.launchMax);
  });

  it('returns escaped meteors to the playfield with an inward velocity', () => {
    expect(escapedMeteorRecovery(480, 300, 2, -8)).toBeUndefined();
    const top = escapedMeteorRecovery(850, -40, -1, -16);
    expect(top).toMatchObject({ x: 790, y: 125, velocityY: 4 });
    expect(top?.velocityX).toBeLessThan(0);
    expect(escapedMeteorRecovery(-40, 300, -7, 2)?.velocityX).toBeGreaterThan(0);
    expect(escapedMeteorRecovery(1000, 300, 7, 2)?.velocityX).toBeLessThan(0);
  });
});
