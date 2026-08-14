import Phaser from 'phaser';

export type VovaState = 'idle' | 'arms' | 'legs' | 'shoulders' | 'head' | 'smile' | 'wink' | 'tongue' | 'combo' | 'drain';

const FRAME_ORDER: VovaState[] = ['idle', 'arms', 'legs', 'shoulders', 'head', 'smile', 'wink', 'tongue', 'combo', 'drain'];

export class VovaCharacter {
  readonly sprite: Phaser.GameObjects.Sprite;
  private busy = false;
  private cosmic = false;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
    this.registerFrames();
    this.sprite = scene.add.sprite(x, y, 'vova-sprites', 'idle').setDisplaySize(245, 245).setDepth(1).setAlpha(0.96);
    scene.tweens.add({ targets: this.sprite, y: y - 7, scaleY: this.sprite.scaleY * 1.018, duration: 1800, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
    scene.time.addEvent({ delay: 3200, loop: true, callback: () => this.playRandomMicroState() });
  }

  play(state: VovaState, duration = 850): void {
    if (this.busy && state !== 'combo' && state !== 'drain') return;
    this.busy = true;
    this.sprite.setFrame(state);
    const baseAngle = state === 'head' ? -4 : state === 'drain' ? 6 : 0;
    this.scene.tweens.add({
      targets: this.sprite,
      angle: baseAngle,
      scaleX: this.sprite.scaleX * (state === 'combo' ? 1.08 : 1.025),
      scaleY: this.sprite.scaleY * (state === 'combo' ? 1.08 : 1.025),
      duration: Math.min(260, duration / 3),
      yoyo: true,
      onComplete: () => undefined,
    });
    this.scene.time.delayedCall(duration, () => {
      this.busy = false;
      this.sprite.setFrame(this.cosmic ? 'smile' : 'idle').setAngle(0);
    });
  }

  reactCombo(): void { this.play('combo', 1150); }
  reactDrain(): void { this.play('drain', 1250); }

  setCosmic(active: boolean): void {
    this.cosmic = active;
    this.sprite.setTint(active ? 0xffe7ff : 0xffffff);
    if (active) this.reactCombo();
    else if (!this.busy) this.sprite.setFrame('idle');
  }

  private playRandomMicroState(): void {
    if (this.busy) return;
    const pool: VovaState[] = ['arms', 'legs', 'shoulders', 'head', 'smile', 'wink'];
    if (Phaser.Math.Between(0, 9) === 0) pool.push('tongue');
    this.play(Phaser.Math.RND.pick(pool), Phaser.Math.Between(550, 900));
  }

  private registerFrames(): void {
    const texture = this.scene.textures.get('vova-sprites');
    if (texture.has('idle')) return;
    const source = texture.getSourceImage() as HTMLImageElement;
    const halfHeight = Math.floor(source.height / 2);
    FRAME_ORDER.forEach((name, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = Math.floor((column * source.width) / 5);
      const nextX = Math.floor(((column + 1) * source.width) / 5);
      const y = row * halfHeight;
      texture.add(name, 0, x, y, nextX - x, row === 0 ? halfHeight : source.height - halfHeight);
    });
  }
}
