import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '../src/systems/audio';

describe('procedural audio helpers', () => {
  it('converts MIDI notes to concert pitch frequencies', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBe(880);
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2);
  });
});
