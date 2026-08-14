import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS, clamp, launchPower } from '../config/gameplay';
import { VovaCharacter } from '../entities/VovaCharacter';
import { messages, type Language, type Messages } from '../i18n';
import { ArcadeAudio } from '../systems/audio';
import { SCORE_VALUES, ScoringSystem } from '../systems/scoring';
import { loadSettings, saveSettings, type GameSettings } from '../systems/settings';

type MatterBody = MatterJS.BodyType;
type Flipper = { body: MatterBody; rest: number; active: number; side: 'left' | 'right'; pivotX: number; pivotY: number; length: number };

const COLORS = { cyan: 0x53f4ff, pink: 0xff3caa, amber: 0xffcc4d, violet: 0x8b5cff, ink: 0x05061d } as const;

export class PinballScene extends Phaser.Scene {
  private ball?: MatterBody;
  private ballGlow?: Phaser.GameObjects.Arc;
  private ballCore?: Phaser.GameObjects.Arc;
  private flippers: Flipper[] = [];
  private lives = 3;
  private state: 'intro' | 'playing' | 'paused' | 'gameover' = 'intro';
  private isLoaded = false;
  private chargeStarted = 0;
  private charging = false;
  private chargeBar!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreLabelText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private multiplierText!: Phaser.GameObjects.Text;
  private cosmicText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private leftHintText!: Phaser.GameObjects.Text;
  private rightHintText!: Phaser.GameObjects.Text;
  private coreText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private menuTitle!: Phaser.GameObjects.Text;
  private menuSubtitle!: Phaser.GameObjects.Text;
  private menuControls!: Phaser.GameObjects.Text;
  private menuHint!: Phaser.GameObjects.Text;
  private menuPrompt!: Phaser.GameObjects.Text;
  private menuLanguage!: Phaser.GameObjects.Text;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHint!: Phaser.GameObjects.Text;
  private lastMovingAt = 0;
  private stars: Array<{ shape: Phaser.GameObjects.Arc; speed: number }> = [];
  private scoring = new ScoringSystem();
  private planetHits = new Set<string>();
  private planetGraphics = new Map<string, Phaser.GameObjects.Arc>();
  private targetCooldowns = new Map<string, number>();
  private satelliteBody?: MatterBody;
  private satelliteGraphic?: Phaser.GameObjects.Container;
  private satelliteOrbit = 0;
  private cosmicActive = false;
  private cosmicEndsAt = 0;
  private cosmicGlow!: Phaser.GameObjects.Rectangle;
  private lastTrailAt = 0;
  private pauseStarted = 0;
  private settings: GameSettings = loadSettings(typeof localStorage === 'undefined' ? undefined : localStorage);
  private gameOverIsRecord = false;
  private vova!: VovaCharacter;
  private arcadeAudio = new ArcadeAudio(this.settings.soundEnabled);
  private leftFlipperWasDown = false;
  private rightFlipperWasDown = false;

  private get t(): Messages { return messages[this.settings.language]; }

  constructor() { super('pinball'); }

  preload(): void {
    this.load.image('vova-sprites', `${import.meta.env.BASE_URL}assets/character/vova-sprites.png`);
  }

  create(): void {
    this.drawBackground();
    this.createBoard();
    this.vova = new VovaCharacter(this, 490, 342);
    this.createTargets();
    this.createFlippers();
    this.createHud();
    this.createOverlay();
    this.bindControls();
    this.sound.mute = !this.settings.soundEnabled;
    this.matter.world.on('collisionstart', this.onCollision, this);
  }

  update(time: number): void {
    this.animateStars();
    if (this.state === 'paused') return;
    this.animateSatellite(time);
    this.updateCosmicMode(time);
    this.scoring.expireCombo(time);
    this.updateHud();
    this.updateFlippers();
    this.updateCharge(time);
    if (this.state !== 'playing' || !this.ball) return;
    this.syncMeteorGraphic();
    this.emitCosmicTrail(time);
    this.capMeteorSpeed();
    this.rescueStuckMeteor(time);
    if (this.ball.position.y > GAME_HEIGHT + 35) this.drainMeteor();
  }

  private drawBackground(): void {
    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x09072c, 0x09072c, 0x020713, 0x020713, 1);
    backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 80; i += 1) {
      const x = Phaser.Math.Between(25, GAME_WIDTH - 25);
      const y = Phaser.Math.Between(50, GAME_HEIGHT - 35);
      const star = this.add.circle(x, y, Phaser.Math.Between(1, 2), i % 4 === 0 ? COLORS.pink : 0xd7fbff, Phaser.Math.FloatBetween(0.2, 0.85));
      this.stars.push({ shape: star, speed: Phaser.Math.FloatBetween(0.04, 0.14) });
    }
    const nebula = this.add.graphics();
    nebula.fillStyle(0x5d24b8, 0.09).fillEllipse(410, 310, 600, 310);
    nebula.fillStyle(0x00d9ff, 0.05).fillEllipse(600, 400, 520, 290);
    this.cosmicGlow = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.pink, 0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(8);
  }

  private createBoard(): void {
    const frame = this.add.graphics();
    frame.lineStyle(7, COLORS.violet, 0.8).strokeRoundedRect(75, 62, 810, 625, 40);
    frame.lineStyle(2, COLORS.cyan, 0.9).strokeRoundedRect(83, 70, 794, 609, 34);
    this.wall(70, 360, 18, 600, 0);
    this.wall(890, 360, 18, 600, 0);
    this.wall(180, 71, 210, 18, 0);
    this.wall(490, 71, 360, 18, 0);
    this.wall(760, 71, 155, 18, 0);
    this.wall(101, 595, 210, 18, -0.72);
    this.wall(859, 595, 210, 18, 0.72);
    this.wall(820, 382, 12, 430, 0);
    this.wall(850, 160, 12, 180, 0.2);

    const lane = this.add.graphics();
    lane.lineStyle(3, COLORS.amber, 0.75).strokeRoundedRect(825, 92, 50, 555, 20);
    lane.fillStyle(COLORS.amber, 0.22).fillRect(833, 608, 34, 28);
    lane.lineStyle(2, COLORS.amber, 1).strokeRect(833, 608, 34, 28);

    this.bumper(330, 245, COLORS.pink);
    this.bumper(505, 195, COLORS.cyan);
    this.bumper(650, 285, COLORS.amber);
    this.guide(165, 300, 120, -0.48);
    this.guide(735, 405, 115, 0.55);
    this.guide(475, 420, 145, -0.08);

    const center = this.add.graphics();
    center.lineStyle(2, COLORS.cyan, 0.55).strokeCircle(490, 330, 92);
    center.lineStyle(5, COLORS.pink, 0.3).strokeCircle(490, 330, 70);
    center.fillStyle(0x141146, 0.72).fillCircle(490, 330, 62);
    this.add.text(490, 318, 'VOVA', { fontFamily: 'monospace', fontSize: '29px', color: '#91f8ff', fontStyle: 'bold' }).setOrigin(0.5);
    this.coreText = this.add.text(490, 348, this.t.core, { fontFamily: 'monospace', fontSize: '11px', color: '#ff75bf', letterSpacing: 3 }).setOrigin(0.5);

    const drain = this.add.graphics();
    drain.fillStyle(0x000000, 0.96).fillEllipse(480, 687, 170, 54);
    drain.lineStyle(4, COLORS.violet, 0.7).strokeEllipse(480, 686, 174, 56);
    drain.lineStyle(1, COLORS.pink, 0.8).strokeEllipse(480, 686, 138, 34);
  }

  private createTargets(): void {
    const planets = [
      { x: 220, y: 175, color: COLORS.pink },
      { x: 735, y: 185, color: COLORS.cyan },
      { x: 730, y: 535, color: COLORS.amber },
    ];
    planets.forEach((planet, index) => {
      const label = `planet-${index}`;
      this.matter.add.circle(planet.x, planet.y, 23, { isStatic: true, restitution: 1.12, label });
      const ring = this.add.circle(planet.x, planet.y, 27, COLORS.ink, 0.92).setStrokeStyle(4, planet.color, 0.6);
      this.add.ellipse(planet.x, planet.y, 66, 15, planet.color, 0.18).setStrokeStyle(2, planet.color, 0.55).setRotation(-0.24);
      this.add.circle(planet.x - 7, planet.y - 7, 6, 0xffffff, 0.55);
      this.planetGraphics.set(label, ring);
    });

    this.addGate(120, 390, 'gate-left', COLORS.cyan);
    this.addGate(790, 330, 'gate-right', COLORS.pink);

    this.satelliteBody = this.matter.add.circle(620, 330, 18, { isStatic: true, restitution: 1.25, label: 'satellite' });
    const satelliteCore = this.add.circle(0, 0, 12, 0xdcecff, 1).setStrokeStyle(2, COLORS.cyan, 1);
    const leftPanel = this.add.rectangle(-25, 0, 22, 10, COLORS.violet, 1).setStrokeStyle(1, COLORS.cyan, 1);
    const rightPanel = this.add.rectangle(25, 0, 22, 10, COLORS.violet, 1).setStrokeStyle(1, COLORS.cyan, 1);
    this.satelliteGraphic = this.add.container(620, 330, [leftPanel, rightPanel, satelliteCore]).setDepth(4);

    this.matter.add.rectangle(480, 112, 32, 32, { isStatic: true, isSensor: true, angle: Math.PI / 4, label: 'rare' });
    this.add.rectangle(480, 112, 25, 25, COLORS.amber, 0.25).setStrokeStyle(3, COLORS.amber, 0.95).setRotation(Math.PI / 4);
    this.add.text(480, 107, '★', { fontFamily: 'monospace', fontSize: '18px', color: '#fff4ad' }).setOrigin(0.5);
  }

  private addGate(x: number, y: number, label: string, color: number): void {
    this.matter.add.rectangle(x, y, 16, 74, { isStatic: true, isSensor: true, label });
    this.add.rectangle(x, y - 29, 34, 10, color, 0.85).setStrokeStyle(2, 0xffffff, 0.7);
    this.add.rectangle(x, y + 29, 34, 10, color, 0.85).setStrokeStyle(2, 0xffffff, 0.7);
    this.add.line(x, y, 0, -24, 0, 24, color, 0.45).setLineWidth(3);
  }

  private wall(x: number, y: number, width: number, height: number, angle: number): void {
    this.matter.add.rectangle(x, y, width, height, { isStatic: true, angle, restitution: 0.55, friction: 0.02, label: 'wall' });
  }

  private guide(x: number, y: number, length: number, angle: number): void {
    this.wall(x, y, length, 12, angle);
    const graphic = this.add.rectangle(x, y, length, 12, COLORS.violet, 0.7).setRotation(angle);
    graphic.setStrokeStyle(2, COLORS.cyan, 0.9);
  }

  private bumper(x: number, y: number, color: number): void {
    this.matter.add.circle(x, y, 34, { isStatic: true, restitution: 1.45, label: 'bumper' });
    this.add.circle(x, y, 38, color, 0.12).setStrokeStyle(2, color, 0.55);
    this.add.circle(x, y, 27, COLORS.ink, 0.9).setStrokeStyle(5, color, 1);
    this.add.circle(x - 8, y - 8, 7, 0xffffff, 0.7);
  }

  private createFlippers(): void {
    this.addFlipper(350, 585, 125, 'left', -0.18, -0.78);
    this.addFlipper(610, 585, 125, 'right', Math.PI + 0.18, Math.PI + 0.78);
    this.addFlipper(255, 420, 92, 'left', 0.1, -0.68);
    this.addFlipper(710, 455, 92, 'right', Math.PI - 0.1, Math.PI + 0.68);
  }

  private addFlipper(pivotX: number, pivotY: number, length: number, side: 'left' | 'right', rest: number, active: number): void {
    const x = pivotX + Math.cos(rest) * length * 0.42;
    const y = pivotY + Math.sin(rest) * length * 0.42;
    const body = this.matter.add.rectangle(x, y, length, 22, { isStatic: true, angle: rest, restitution: 1.1, label: `flipper-${side}` });
    this.flippers.push({ body, rest, active, side, pivotX, pivotY, length });
  }

  private createHud(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'monospace', fontSize: '18px', color: '#53f4ff', stroke: '#081229', strokeThickness: 4 };
    this.livesText = this.add.text(100, 92, '', style);
    this.bestText = this.add.text(100, 120, '', { ...style, fontSize: '13px', color: '#b9b5d5' });
    this.scoreLabelText = this.add.text(480, 79, this.t.score, { ...style, fontSize: '11px', color: '#91f8ff' }).setOrigin(0.5, 0);
    this.scoreText = this.add.text(480, 94, '00000000', { ...style, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0);
    this.multiplierText = this.add.text(480, 121, '', { ...style, fontSize: '13px', color: '#ff78c0' }).setOrigin(0.5, 0);
    this.statusText = this.add.text(790, 92, this.t.ready, { ...style, color: '#ffcc4d' }).setOrigin(1, 0);
    this.cosmicText = this.add.text(790, 122, '', { ...style, fontSize: '14px', color: '#ff78c0' }).setOrigin(1, 0);
    this.soundText = this.add.text(790, 150, '', { ...style, fontSize: '12px', color: '#b9b5d5' }).setOrigin(1, 0);
    this.leftHintText = this.add.text(100, 650, this.t.left, { ...style, fontSize: '14px', color: '#ff78c0' });
    this.rightHintText = this.add.text(860, 650, this.t.right, { ...style, fontSize: '14px', color: '#ff78c0' }).setOrigin(1, 0);
    this.chargeBar = this.add.rectangle(850, 590, 16, 0, COLORS.amber, 0.95).setOrigin(0.5, 1);
    this.updateLives();
    this.updateHud();
  }

  private createOverlay(): void {
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02030c, 0.78);
    const panel = this.add.rectangle(480, 360, 570, 455, 0x09082b, 0.96).setStrokeStyle(3, COLORS.cyan, 0.95);
    this.menuTitle = this.add.text(480, 180, this.t.title, { fontFamily: 'monospace', fontSize: '42px', color: '#ffcc4d', fontStyle: 'bold', stroke: '#ff2f9f', strokeThickness: 3 }).setOrigin(0.5);
    this.menuSubtitle = this.add.text(480, 230, this.t.subtitle, { fontFamily: 'monospace', fontSize: '15px', color: '#91f8ff', letterSpacing: 2 }).setOrigin(0.5);
    this.menuControls = this.add.text(480, 310, this.t.controls, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', align: 'center', lineSpacing: 7 }).setOrigin(0.5);
    this.menuHint = this.add.text(480, 410, this.t.firstHint, { fontFamily: 'monospace', fontSize: '14px', color: '#b9b5d5', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    this.menuLanguage = this.add.text(480, 467, this.t.language, { fontFamily: 'monospace', fontSize: '17px', color: '#91f8ff', backgroundColor: '#151347', padding: { x: 12, y: 5 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.menuLanguage.on('pointerdown', () => this.toggleLanguage());
    this.menuPrompt = this.add.text(480, 522, this.t.start, { fontFamily: 'monospace', fontSize: '22px', color: '#ff78c0', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: this.menuPrompt, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 });
    this.overlay = this.add.container(0, 0, [veil, panel, this.menuTitle, this.menuSubtitle, this.menuControls, this.menuHint, this.menuLanguage, this.menuPrompt]).setDepth(20);

    const pauseVeil = this.add.rectangle(480, 360, 960, 720, 0x02030c, 0.72);
    this.pauseTitle = this.add.text(480, 335, this.t.paused, { fontFamily: 'monospace', fontSize: '48px', color: '#ffcc4d', fontStyle: 'bold', stroke: '#ff2f9f', strokeThickness: 3 }).setOrigin(0.5);
    this.pauseHint = this.add.text(480, 400, this.t.resume, { fontFamily: 'monospace', fontSize: '18px', color: '#91f8ff' }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [pauseVeil, this.pauseTitle, this.pauseHint]).setDepth(21).setVisible(false);
  }

  private bindControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT', 'A', 'D', 'ENTER', 'R', 'P', 'ESC', 'L', 'M']);
    const space = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    keyboard.on('keydown-ENTER', () => this.beginGame());
    keyboard.on('keydown-R', () => { if (this.state === 'gameover') this.beginGame(); });
    keyboard.on('keydown-P', () => this.togglePause());
    keyboard.on('keydown-ESC', () => this.togglePause());
    keyboard.on('keydown-L', () => this.toggleLanguage());
    keyboard.on('keydown-M', () => this.toggleSound());
    space.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      event.preventDefault();
      if (this.state === 'intro' || this.state === 'gameover') this.beginGame();
      this.startLaunchCharge();
    });
    space.on('up', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      event.preventDefault();
      this.releaseLaunch();
    });
  }

  private startLaunchCharge(): void {
    if (this.state !== 'playing' || !this.isLoaded || this.charging) return;
    this.charging = true;
    this.chargeStarted = this.time.now;
  }

  private releaseLaunch(): void {
    if (!this.charging || !this.ball || !this.isLoaded) return;
    const power = launchPower(this.time.now - this.chargeStarted);
    this.matter.body.setStatic(this.ball, false);
    this.matter.body.setVelocity(this.ball, { x: -1.6, y: -power * 270 });
    this.arcadeAudio.play('launch');
    this.isLoaded = false;
    this.charging = false;
    this.chargeBar.height = 0;
    this.statusText.setText(this.t.inPlay);
  }

  private beginGame(): void {
    if (this.state === 'playing') return;
    if (this.state === 'paused') { this.togglePause(); return; }
    this.clearMeteor();
    this.lives = 3;
    this.scoring.reset();
    this.planetHits.clear();
    this.targetCooldowns.clear();
    this.cosmicActive = false;
    this.cosmicEndsAt = 0;
    this.cosmicGlow.setAlpha(0);
    this.vova.setCosmic(false);
    this.gameOverIsRecord = false;
    for (const graphic of this.planetGraphics.values()) graphic.setFillStyle(COLORS.ink, 0.92);
    this.state = 'playing';
    this.arcadeAudio.start();
    this.arcadeAudio.setCosmic(false);
    this.overlay.setVisible(false);
    this.updateLives();
    this.loadMeteor();
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.pauseStarted = this.time.now;
      this.matter.world.pause();
      this.arcadeAudio.setPaused(true);
      this.pauseOverlay.setVisible(true);
    } else if (this.state === 'paused') {
      const pausedFor = this.time.now - this.pauseStarted;
      this.cosmicEndsAt += this.cosmicActive ? pausedFor : 0;
      this.chargeStarted += this.charging ? pausedFor : 0;
      this.state = 'playing';
      this.matter.world.resume();
      this.arcadeAudio.setPaused(false);
      this.pauseOverlay.setVisible(false);
    }
  }

  private loadMeteor(): void {
    if (this.state !== 'playing') return;
    this.clearMeteor();
    this.ball = this.matter.add.circle(850, 572, PHYSICS.meteorRadius, { isStatic: true, restitution: 0.86, friction: 0.008, frictionAir: 0.004, density: 0.004, label: 'meteor' });
    this.ballGlow = this.add.circle(850, 572, 21, COLORS.amber, 0.18).setDepth(6);
    this.ballCore = this.add.circle(850, 572, PHYSICS.meteorRadius, 0xff713d, 1).setStrokeStyle(3, 0xffd35c, 1).setDepth(7);
    this.tweens.add({ targets: this.ballGlow, scale: 1.35, alpha: 0.06, duration: 420, yoyo: true, repeat: -1 });
    this.isLoaded = true;
    this.lastMovingAt = this.time.now;
    this.statusText.setText(this.t.holdSpace);
  }

  private updateFlippers(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const canFlip = this.state === 'playing';
    const left = canFlip && (keyboard.addKey('A').isDown || keyboard.addKey('LEFT').isDown);
    const right = canFlip && (keyboard.addKey('D').isDown || keyboard.addKey('RIGHT').isDown);
    if (left && !this.leftFlipperWasDown) this.arcadeAudio.play('flipper');
    if (right && !this.rightFlipperWasDown) this.arcadeAudio.play('flipper');
    this.leftFlipperWasDown = left;
    this.rightFlipperWasDown = right;
    for (const flipper of this.flippers) {
      const pressed = flipper.side === 'left' ? left : right;
      const target = pressed ? flipper.active : flipper.rest;
      const delta = Phaser.Math.Angle.Wrap(target - flipper.body.angle);
      const nextAngle = flipper.body.angle + delta * 0.38;
      const centerX = flipper.pivotX + Math.cos(nextAngle) * flipper.length * 0.42;
      const centerY = flipper.pivotY + Math.sin(nextAngle) * flipper.length * 0.42;
      this.matter.body.setPosition(flipper.body, { x: centerX, y: centerY });
      this.matter.body.setAngle(flipper.body, nextAngle);
      const graphic = this.children.getByName(`graphic-${this.flippers.indexOf(flipper)}`) as Phaser.GameObjects.Rectangle | null;
      if (graphic) { graphic.setPosition(centerX, centerY).setRotation(nextAngle); }
      else {
        this.add.rectangle(centerX, centerY, flipper.length, 22, flipper.side === 'left' ? COLORS.pink : COLORS.cyan, 1)
          .setStrokeStyle(3, 0xffffff, 0.85).setRotation(nextAngle).setName(`graphic-${this.flippers.indexOf(flipper)}`);
        this.add.circle(flipper.pivotX, flipper.pivotY, 13, COLORS.amber, 1).setStrokeStyle(2, 0xffffff, 0.8);
      }
    }
  }

  private updateCharge(time: number): void {
    if (!this.charging) return;
    const ratio = clamp((time - this.chargeStarted) / PHYSICS.chargeMs, 0, 1);
    this.chargeBar.height = 145 * ratio;
    this.statusText.setText(`${this.t.power} ${Math.round(ratio * 100).toString().padStart(3, '0')}%`);
  }

  private syncMeteorGraphic(): void {
    if (!this.ball || !this.ballCore || !this.ballGlow) return;
    this.ballCore.setPosition(this.ball.position.x, this.ball.position.y).setRotation(this.ball.angle);
    this.ballGlow.setPosition(this.ball.position.x, this.ball.position.y);
  }

  private capMeteorSpeed(): void {
    if (!this.ball) return;
    const speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.y);
    if (speed > PHYSICS.maxSpeed) {
      const scale = PHYSICS.maxSpeed / speed;
      this.matter.body.setVelocity(this.ball, { x: this.ball.velocity.x * scale, y: this.ball.velocity.y * scale });
    }
  }

  private rescueStuckMeteor(time: number): void {
    if (!this.ball || this.isLoaded) return;
    const speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.y);
    if (speed >= PHYSICS.stuckSpeed) this.lastMovingAt = time;
    if (time - this.lastMovingAt > PHYSICS.stuckMs) {
      this.matter.body.applyForce(this.ball, this.ball.position, { x: Phaser.Math.FloatBetween(-0.014, 0.014), y: -0.022 });
      this.lastMovingAt = time;
      this.statusText.setText(this.t.gravityPulse);
    }
  }

  private drainMeteor(): void {
    this.vova.reactDrain();
    this.arcadeAudio.play('drain');
    this.lives -= 1;
    this.updateLives();
    this.clearMeteor();
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.time.delayedCall(850, () => this.showGameOver());
      return;
    }
    this.statusText.setText(this.t.meteorLost);
    this.time.delayedCall(700, () => this.loadMeteor());
  }

  private clearMeteor(): void {
    if (this.ball) this.matter.world.remove(this.ball);
    this.ballGlow?.destroy();
    this.ballCore?.destroy();
    this.ball = undefined;
    this.ballGlow = undefined;
    this.ballCore = undefined;
    this.isLoaded = false;
    this.charging = false;
  }

  private updateLives(): void {
    const slots = Math.max(3, this.lives);
    this.livesText.setText(`${this.t.meteors}  ${Array.from({ length: slots }, (_, index) => index < this.lives ? '◆' : '◇').join(' ')}`);
  }

  private showGameOver(): void {
    this.gameOverIsRecord = this.scoring.score > this.settings.bestScore;
    if (this.gameOverIsRecord) {
      this.settings.bestScore = this.scoring.score;
      this.persistSettings();
      this.arcadeAudio.play('record');
    }
    this.overlay.setVisible(true);
    this.applyGameOverText();
    this.statusText.setText(this.t.gameOver);
  }

  private onCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes('meteor')) continue;
      if (labels.includes('bumper')) {
        this.awardTarget('bumper', SCORE_VALUES.bumper);
        this.cameras.main.shake(45, 0.0018);
        const body = pair.bodyA.label === 'meteor' ? pair.bodyA : pair.bodyB;
        this.matter.body.applyForce(body, body.position, { x: Phaser.Math.FloatBetween(-0.006, 0.006), y: -0.009 });
      }
      if (labels.some((label) => label.startsWith('flipper-'))) {
        const body = pair.bodyA.label === 'meteor' ? pair.bodyA : pair.bodyB;
        this.matter.body.applyForce(body, body.position, { x: Phaser.Math.FloatBetween(-0.003, 0.003), y: -0.018 });
      }
      const planet = labels.find((label) => label.startsWith('planet-'));
      if (planet) {
        this.awardTarget(planet, SCORE_VALUES.planet);
        this.activatePlanet(planet);
      }
      if (labels.includes('satellite')) this.awardTarget('satellite', SCORE_VALUES.satellite);
      const gate = labels.find((label) => label.startsWith('gate-'));
      if (gate) this.awardTarget(gate, SCORE_VALUES.gate);
      if (labels.includes('rare')) this.awardTarget('rare', SCORE_VALUES.rare, 5000);
    }
  }

  private awardTarget(label: string, points: number, cooldownMs = 260): void {
    if (this.state !== 'playing') return;
    const now = this.time.now;
    if (now < (this.targetCooldowns.get(label) ?? 0)) return;
    this.targetCooldowns.set(label, now + cooldownMs);
    const earned = this.scoring.hit(points, now, this.cosmicActive);
    this.arcadeAudio.play(label === 'bumper' ? 'bumper' : 'target');
    if ([3, 6, 10].includes(this.scoring.combo)) {
      this.vova.reactCombo();
      this.arcadeAudio.play('bonus');
    }
    const x = this.ball?.position.x ?? 480;
    const y = this.ball?.position.y ?? 320;
    const flash = this.add.text(x, y - 18, `+${earned}`, { fontFamily: 'monospace', fontSize: '18px', color: this.cosmicActive ? '#ffcc4d' : '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
    this.tweens.add({ targets: flash, y: y - 60, alpha: 0, duration: 650, onComplete: () => flash.destroy() });
    if (this.scoring.claimExtraMeteor()) {
      this.lives += 1;
      this.updateLives();
      this.statusText.setText(this.t.extraMeteor);
      this.arcadeAudio.play('bonus');
      this.cameras.main.flash(220, 83, 244, 255);
    }
  }

  private activatePlanet(label: string): void {
    if (this.planetHits.has(label)) return;
    this.planetHits.add(label);
    const graphic = this.planetGraphics.get(label);
    graphic?.setFillStyle(0xffffff, 0.92);
    if (this.planetHits.size === this.planetGraphics.size) this.startCosmicMode();
  }

  private startCosmicMode(): void {
    if (this.cosmicActive) return;
    this.scoring.bonus(SCORE_VALUES.planetSet + SCORE_VALUES.cosmicStart);
    this.cosmicActive = true;
    this.vova.setCosmic(true);
    this.arcadeAudio.setCosmic(true);
    this.arcadeAudio.play('bonus');
    this.cosmicEndsAt = this.time.now + 18000;
    this.statusText.setText(this.t.cosmicStart);
    this.cosmicGlow.setAlpha(0.09);
    this.cameras.main.flash(350, 255, 60, 170);
  }

  private updateCosmicMode(time: number): void {
    if (!this.cosmicActive) return;
    const remaining = Math.max(0, this.cosmicEndsAt - time);
    this.cosmicText.setText(`${this.t.cosmic} ${Math.ceil(remaining / 1000)}s`);
    this.cosmicGlow.setAlpha(0.055 + Math.sin(time * 0.012) * 0.03);
    if (remaining > 0) return;
    this.cosmicActive = false;
    this.vova.setCosmic(false);
    this.arcadeAudio.setCosmic(false);
    this.cosmicText.setText('');
    this.cosmicGlow.setAlpha(0);
    this.planetHits.clear();
    for (const graphic of this.planetGraphics.values()) graphic.setFillStyle(COLORS.ink, 0.92);
    this.statusText.setText(this.t.cosmicComplete);
  }

  private emitCosmicTrail(time: number): void {
    if (!this.cosmicActive || !this.ball || time - this.lastTrailAt < 55) return;
    this.lastTrailAt = time;
    const spark = this.add.circle(this.ball.position.x, this.ball.position.y, Phaser.Math.Between(4, 8), Phaser.Math.RND.pick([COLORS.amber, COLORS.pink, COLORS.cyan]), 0.8).setDepth(5);
    this.tweens.add({ targets: spark, scale: 0.1, alpha: 0, duration: 420, onComplete: () => spark.destroy() });
  }

  private updateHud(): void {
    this.scoreText.setText(this.scoring.score.toString().padStart(8, '0'));
    this.scoreLabelText.setText(this.t.score);
    this.bestText.setText(`${this.t.best}  ${this.settings.bestScore.toString().padStart(8, '0')}`);
    this.multiplierText.setText(`${this.t.combo} ${this.scoring.combo}  ×${this.scoring.multiplier}${this.cosmicActive ? `  ×2 ${this.t.cosmic}` : ''}`);
    this.soundText.setText(this.settings.soundEnabled ? this.t.soundOn : this.t.soundOff);
  }

  private toggleLanguage(): void {
    const next: Language = this.settings.language === 'ru' ? 'en' : 'ru';
    this.settings.language = next;
    this.persistSettings();
    this.applyLanguage();
  }

  private toggleSound(): void {
    this.settings.soundEnabled = !this.settings.soundEnabled;
    this.sound.mute = !this.settings.soundEnabled;
    this.arcadeAudio.setEnabled(this.settings.soundEnabled);
    this.persistSettings();
    this.updateHud();
  }

  private applyLanguage(): void {
    this.coreText.setText(this.t.core);
    this.leftHintText.setText(this.t.left);
    this.rightHintText.setText(this.t.right);
    this.pauseTitle.setText(this.t.paused);
    this.pauseHint.setText(this.t.resume);
    this.menuLanguage.setText(this.t.language);
    this.updateLives();
    this.updateHud();
    if (this.state === 'gameover') {
      this.applyGameOverText();
      this.statusText.setText(this.t.gameOver);
      return;
    }
    this.menuTitle.setText(this.t.title);
    this.menuSubtitle.setText(this.t.subtitle);
    this.menuControls.setText(this.t.controls);
    this.menuHint.setText(this.t.firstHint);
    this.menuPrompt.setText(this.t.start);
    if (this.state === 'intro') this.statusText.setText(this.t.ready);
    if (this.state === 'playing') this.statusText.setText(this.isLoaded ? this.t.holdSpace : this.t.inPlay);
  }

  private applyGameOverText(): void {
    this.menuTitle.setText(this.t.blackHole);
    this.menuSubtitle.setText(`${this.t.finalScore}  ${this.scoring.score.toString().padStart(8, '0')}`);
    this.menuControls.setText(this.gameOverIsRecord ? this.t.newRecord : this.t.gameOver);
    this.menuHint.setText(this.t.gameOverBody);
    this.menuPrompt.setText(this.t.restart);
    this.menuLanguage.setText(this.t.language);
  }

  private persistSettings(): void {
    saveSettings(typeof localStorage === 'undefined' ? undefined : localStorage, this.settings);
  }

  private animateSatellite(time: number): void {
    if (!this.satelliteBody || !this.satelliteGraphic || this.state === 'paused') return;
    this.satelliteOrbit = time * 0.00042;
    const x = 490 + Math.cos(this.satelliteOrbit) * 132;
    const y = 330 + Math.sin(this.satelliteOrbit) * 88;
    this.matter.body.setPosition(this.satelliteBody, { x, y });
    this.matter.body.setAngle(this.satelliteBody, this.satelliteOrbit + Math.PI / 2);
    this.satelliteGraphic.setPosition(x, y).setRotation(this.satelliteOrbit + Math.PI / 2);
  }

  private animateStars(): void {
    for (const star of this.stars) {
      star.shape.y += star.speed;
      if (star.shape.y > GAME_HEIGHT) star.shape.y = 0;
    }
  }
}
