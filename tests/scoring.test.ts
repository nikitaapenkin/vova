import { describe, expect, it } from 'vitest';
import { EXTRA_METEOR_SCORE, ScoringSystem } from '../src/systems/scoring';

describe('ScoringSystem', () => {
  it('builds combos and applies x2, x3 and x5 multipliers', () => {
    const scoring = new ScoringSystem();
    for (let hit = 1; hit <= 10; hit += 1) scoring.hit(100, hit * 100);
    expect(scoring.combo).toBe(10);
    expect(scoring.multiplier).toBe(5);
    expect(scoring.score).toBe(2500);
  });

  it('expires a combo after the configured window', () => {
    const scoring = new ScoringSystem();
    scoring.hit(100, 0);
    scoring.expireCombo(4000);
    expect(scoring.combo).toBe(0);
    expect(scoring.multiplier).toBe(1);
  });

  it('grants one extra meteor after the score threshold', () => {
    const scoring = new ScoringSystem();
    scoring.bonus(EXTRA_METEOR_SCORE);
    expect(scoring.claimExtraMeteor()).toBe(true);
    expect(scoring.claimExtraMeteor()).toBe(false);
  });

  it('doubles earned points during Cosmic Vova', () => {
    const scoring = new ScoringSystem();
    expect(scoring.hit(250, 0, true)).toBe(500);
  });
});
