import { describe, expect, it } from 'vitest';
import { PHYSICS, clamp, launchPower } from '../src/config/gameplay';

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
});
