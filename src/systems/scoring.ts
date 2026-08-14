export const SCORE_VALUES = {
  bumper: 100,
  planet: 250,
  satellite: 500,
  gate: 750,
  rare: 1000,
  planetSet: 5000,
  cosmicStart: 10000,
} as const;

export const COMBO_WINDOW_MS = 3000;
export const EXTRA_METEOR_SCORE = 25000;

export class ScoringSystem {
  score = 0;
  combo = 0;
  multiplier = 1;
  private lastHitAt = Number.NEGATIVE_INFINITY;
  private extraMeteorGranted = false;

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.lastHitAt = Number.NEGATIVE_INFINITY;
    this.extraMeteorGranted = false;
  }

  hit(basePoints: number, now: number, cosmic = false): number {
    this.combo = now - this.lastHitAt <= COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastHitAt = now;
    this.multiplier = this.combo >= 10 ? 5 : this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
    const earned = basePoints * this.multiplier * (cosmic ? 2 : 1);
    this.score += earned;
    return earned;
  }

  bonus(points: number): void {
    this.score += points;
  }

  expireCombo(now: number): void {
    if (now - this.lastHitAt > COMBO_WINDOW_MS) {
      this.combo = 0;
      this.multiplier = 1;
    }
  }

  claimExtraMeteor(): boolean {
    if (this.extraMeteorGranted || this.score < EXTRA_METEOR_SCORE) return false;
    this.extraMeteorGranted = true;
    return true;
  }
}
