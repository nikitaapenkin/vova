export type ArcadeSound = 'launch' | 'flipper' | 'bumper' | 'target' | 'bonus' | 'drain' | 'record';

export const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const LEAD: Array<number | null> = [72, null, 76, 79, 74, null, 77, 81, 72, 76, 79, 84, 81, 79, 76, 74];
const BASS = [36, 36, 43, 36, 41, 41, 43, 38, 36, 36, 43, 36, 41, 43, 46, 43];

export class ArcadeAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private timer?: number;
  private nextStepAt = 0;
  private step = 0;
  private cosmic = false;

  constructor(private enabled: boolean) {}

  start(): void {
    if (!this.enabled) return;
    this.ensureContext();
    void this.context?.resume();
    if (this.timer !== undefined || !this.context) return;
    this.nextStepAt = this.context.currentTime + 0.05;
    this.timer = window.setInterval(() => this.scheduleMusic(), 70);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.start();
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(enabled ? 0.7 : 0.0001, this.context.currentTime, 0.025);
    }
  }

  setCosmic(active: boolean): void { this.cosmic = active; }

  setPaused(paused: boolean): void {
    if (!this.context || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(paused ? 0.025 : 0.16, this.context.currentTime, 0.04);
  }

  play(sound: ArcadeSound): void {
    if (!this.enabled) return;
    this.ensureContext();
    void this.context?.resume();
    if (!this.context || !this.sfxBus) return;
    const now = this.context.currentTime;
    const specs: Record<ArcadeSound, [number, number, OscillatorType, number]> = {
      launch: [196, 0.22, 'sawtooth', 0.17],
      flipper: [110, 0.055, 'square', 0.1],
      bumper: [659, 0.13, 'square', 0.12],
      target: [880, 0.16, 'triangle', 0.1],
      bonus: [1047, 0.45, 'square', 0.14],
      drain: [98, 0.6, 'sawtooth', 0.15],
      record: [1319, 0.8, 'triangle', 0.15],
    };
    const [frequency, duration, wave, gain] = specs[sound];
    this.tone(frequency, now, duration, wave, gain, this.sfxBus, sound === 'drain' ? 0.55 : 1.28);
    if (sound === 'bonus' || sound === 'record') {
      this.tone(frequency * 1.25, now + 0.12, duration * 0.7, wave, gain * 0.8, this.sfxBus, 1.12);
      this.tone(frequency * 1.5, now + 0.24, duration * 0.55, wave, gain * 0.7, this.sfxBus, 1.04);
    }
  }

  private ensureContext(): void {
    if (this.context) return;
    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.sfxBus = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.7 : 0.0001;
    this.musicBus.gain.value = 0.16;
    this.sfxBus.gain.value = 0.42;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.context.destination);
  }

  private scheduleMusic(): void {
    if (!this.context || !this.musicBus || !this.enabled) return;
    const secondsPerStep = 60 / (this.cosmic ? 184 : 132) / 4;
    while (this.nextStepAt < this.context.currentTime + 0.28) {
      const index = this.step % 16;
      const lead = LEAD[index];
      this.tone(midiToFrequency(BASS[index]), this.nextStepAt, secondsPerStep * 1.65, 'square', 0.07, this.musicBus, 0.98);
      if (lead !== null && (this.cosmic || index % 2 === 0)) {
        this.tone(midiToFrequency(lead + (this.cosmic ? 12 : 0)), this.nextStepAt, secondsPerStep * 0.78, 'triangle', 0.055, this.musicBus, 1.01);
      }
      if (index % 4 === 2) this.noiseTick(this.nextStepAt, this.musicBus);
      this.step += 1;
      this.nextStepAt += secondsPerStep;
    }
  }

  private tone(frequency: number, at: number, duration: number, wave: OscillatorType, volume: number, destination: AudioNode, sweep: number): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * sweep), at + duration);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private noiseTick(at: number, destination: AudioNode): void {
    if (!this.context) return;
    const buffer = this.context.createBuffer(1, 480, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.035, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    source.connect(gain);
    gain.connect(destination);
    source.start(at);
  }
}
