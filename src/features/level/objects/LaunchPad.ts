import Phaser from 'phaser';

/** Colors for the launch pad states */
const INACTIVE_COLOR = 0xcc4444; // Red when enemies remain
const CHARGING_COLOR = 0x88ffff; // Cyan glow when charging
const PAD_RADIUS = 50;

/** Configuration for the launch pad */
export interface LaunchPadConfig {
  /** Time in ms to fully charge the launch (default 1500) */
  chargeTime?: number;
  /** Rate at which charge decays when released (relative to fill rate, default 0.5) */
  decayRate?: number;
}

/**
 * A launch pad that activates when all enemies are cleared.
 * Player holds boost (spacebar) to charge and launch to next floor.
 */
export class LaunchPad extends Phaser.GameObjects.Container {
  private config: Required<LaunchPadConfig>;
  private outerRing!: Phaser.GameObjects.Arc;
  private innerCircle!: Phaser.GameObjects.Arc;
  private chargeIndicator!: Phaser.GameObjects.Arc;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

  private isActive = false;
  private chargeProgress = 0; // 0 to 1
  private isCharging = false;
  private hasLaunched = false;

  private onLaunchCallback?: () => void;
  private onChargeStartCallback?: () => void;
  private onChargeReleaseCallback?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config: LaunchPadConfig = {}) {
    super(scene, x, y);

    this.config = {
      chargeTime: config.chargeTime ?? 1500,
      decayRate: config.decayRate ?? 0.5,
    };

    scene.add.existing(this);
    this.setDepth(-10); // Render below entities

    // Create visual layers
    this.createVisuals();
    this.createParticleEffect();
    this.createAnimations();
  }

  private createVisuals(): void {
    // Inner circle (main pad surface)
    this.innerCircle = this.scene.add.circle(0, 0, PAD_RADIUS * 0.7, INACTIVE_COLOR);
    this.innerCircle.setAlpha(0.4);
    this.add(this.innerCircle);

    // Outer ring
    this.outerRing = this.scene.add.circle(0, 0, PAD_RADIUS, INACTIVE_COLOR);
    this.outerRing.setStrokeStyle(4, INACTIVE_COLOR);
    this.outerRing.setFillStyle(INACTIVE_COLOR, 0.2);
    this.add(this.outerRing);

    // Charge indicator (fills as player charges)
    this.chargeIndicator = this.scene.add.circle(0, 0, PAD_RADIUS * 0.9, CHARGING_COLOR);
    this.chargeIndicator.setAlpha(0);
    this.add(this.chargeIndicator);
  }

  private createParticleEffect(): void {
    const textureKey = 'launchpad_particle';
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x88ff88, 1);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture(textureKey, 4, 4);
      graphics.destroy();
    }

    this.particles = this.scene.add.particles(0, 0, textureKey, {
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 80,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, PAD_RADIUS * 0.7),
        quantity: 12,
      },
    });

    // Start paused (will activate when pad is active)
    this.particles.stop();
    this.add(this.particles);
  }

  private createAnimations(): void {
    // Subtle pulse on outer ring
    this.scene.tweens.add({
      targets: this.outerRing,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Activate the launch pad (call when all enemies are defeated) */
  public activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    // Use a counter object for the tween to animate
    const colorProgress = { t: 0 };

    // Transition to green
    this.scene.tweens.add({
      targets: colorProgress,
      t: 1,
      duration: 400,
      onUpdate: () => {
        const t = colorProgress.t;
        const r = Math.floor(Phaser.Math.Linear(0xcc, 0x44, t));
        const g = Math.floor(Phaser.Math.Linear(0x44, 0xcc, t));
        const b = Math.floor(Phaser.Math.Linear(0x44, 0x44, t));
        const color = (r << 16) | (g << 8) | b;
        this.innerCircle.setFillStyle(color, 0.4);
        this.outerRing.setStrokeStyle(4, color);
        this.outerRing.setFillStyle(color, 0.2);
      },
    });

    // Start particles
    this.particles?.start();
  }

  /** Check if a point is within the pad's radius */
  public containsPoint(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    return distance < PAD_RADIUS;
  }

  /** Start charging the launch */
  public startCharge(): void {
    if (!this.isActive || this.hasLaunched || this.isCharging) return;
    this.isCharging = true;
    this.onChargeStartCallback?.();

    // Show charge indicator
    this.chargeIndicator.setAlpha(0.3);
  }

  /** Stop charging (release) */
  public stopCharge(): void {
    if (!this.isCharging) return;
    this.isCharging = false;
    this.onChargeReleaseCallback?.();
  }

  /** Update charge progress (call every frame) */
  public updateCharge(delta: number): void {
    if (this.hasLaunched) return;

    if (this.isCharging) {
      // Fill up
      const fillRate = 1 / this.config.chargeTime;
      this.chargeProgress = Math.min(1, this.chargeProgress + fillRate * delta);

      // Check for launch
      if (this.chargeProgress >= 1) {
        this.triggerLaunch();
      }
    } else if (this.chargeProgress > 0) {
      // Decay when not charging
      const decayRate = (1 / this.config.chargeTime) * this.config.decayRate;
      this.chargeProgress = Math.max(0, this.chargeProgress - decayRate * delta);

      // Hide indicator when fully decayed
      if (this.chargeProgress <= 0) {
        this.chargeIndicator.setAlpha(0);
      }
    }

    // Update charge indicator visual
    if (this.chargeProgress > 0) {
      this.chargeIndicator.setScale(this.chargeProgress);
      this.chargeIndicator.setAlpha(0.3 + this.chargeProgress * 0.4);
    }
  }

  private triggerLaunch(): void {
    this.hasLaunched = true;
    this.isCharging = false;
    this.particles?.stop();

    // Flash effect
    this.scene.tweens.add({
      targets: this.chargeIndicator,
      alpha: 1,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      onComplete: () => {
        this.onLaunchCallback?.();
      },
    });
  }

  /** Register callback for when launch is triggered */
  public onLaunch(callback: () => void): this {
    this.onLaunchCallback = callback;
    return this;
  }

  /** Register callback for when charging starts */
  public onChargeStart(callback: () => void): this {
    this.onChargeStartCallback = callback;
    return this;
  }

  /** Register callback for when charging stops (release) */
  public onChargeRelease(callback: () => void): this {
    this.onChargeReleaseCallback = callback;
    return this;
  }

  /** Get current charge progress (0-1) */
  public getChargeProgress(): number {
    return this.chargeProgress;
  }

  /** Check if the pad is active (enemies cleared) */
  public isActivated(): boolean {
    return this.isActive;
  }

  /** Check if launch has been triggered */
  public isLaunched(): boolean {
    return this.hasLaunched;
  }

  /** Get the pad radius */
  public getRadius(): number {
    return PAD_RADIUS;
  }

  destroy(fromScene?: boolean): void {
    this.particles?.stop();
    super.destroy(fromScene);
  }
}
