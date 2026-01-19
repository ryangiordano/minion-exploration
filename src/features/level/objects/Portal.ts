import Phaser from 'phaser';

const PORTAL_COLOR = 0x6644ff;
const PORTAL_INNER_COLOR = 0x220066;
const PORTAL_RADIUS = 40;

export interface PortalConfig {
  onEnter?: () => void;
  /** If true, skip spawn animation and start fully visible at current scale */
  skipSpawnAnimation?: boolean;
}

/**
 * A portal that appears when a floor is cleared.
 * Minions can enter to proceed to the next floor.
 */
export class Portal extends Phaser.GameObjects.Container {
  private config: PortalConfig;
  private outerRing: Phaser.GameObjects.Arc;
  private innerCircle: Phaser.GameObjects.Arc;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private activated = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PortalConfig = {}) {
    super(scene, x, y);
    this.config = config;

    scene.add.existing(this);

    // Render below player and nanobots
    this.setDepth(-10);

    // Create visual layers
    this.innerCircle = scene.add.circle(0, 0, PORTAL_RADIUS * 0.6, PORTAL_INNER_COLOR);
    this.innerCircle.setAlpha(0.8);
    this.add(this.innerCircle);

    this.outerRing = scene.add.circle(0, 0, PORTAL_RADIUS, PORTAL_COLOR);
    this.outerRing.setStrokeStyle(4, 0xaa88ff);
    this.outerRing.setFillStyle(PORTAL_COLOR, 0.3);
    this.add(this.outerRing);

    // Create swirling particle effect
    this.createParticleEffect();

    // Animate the portal
    this.createAnimations();

    // Spawn animation (unless skipped for arrival portals)
    if (!config.skipSpawnAnimation) {
      this.playSpawnAnimation();
    }
  }

  private createParticleEffect(): void {
    const textureKey = 'portal_particle';
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xaa88ff, 1);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture(textureKey, 4, 4);
      graphics.destroy();
    }

    this.particles = this.scene.add.particles(0, 0, textureKey, {
      speed: { min: 20, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 500, max: 1000 },
      frequency: 50,
      quantity: 2,
      blendMode: Phaser.BlendModes.ADD,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, PORTAL_RADIUS * 0.8),
        quantity: 16,
      },
    });

    this.add(this.particles);
  }

  private createAnimations(): void {
    // Pulsing outer ring
    this.scene.tweens.add({
      targets: this.outerRing,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0.6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Rotating inner circle (simulated via scale wobble)
    this.scene.tweens.add({
      targets: this.innerCircle,
      scaleX: 0.9,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private playSpawnAnimation(): void {
    // Start small and invisible
    this.setScale(0);
    this.setAlpha(0);

    // Pop in
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
  }

  /** Check if a point is within the portal's activation radius */
  public containsPoint(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    return distance < PORTAL_RADIUS;
  }

  /** Called when a minion enters the portal */
  public enter(): void {
    if (this.activated) return;
    this.activated = true;

    // Grow large (confetti will shoot at the same time from the transition)
    this.scene.tweens.add({
      targets: this,
      scaleX: 3,
      scaleY: 3,
      duration: 600,
      ease: 'Power2',
    });

    // Trigger the transition immediately (confetti shoots during growth)
    this.config.onEnter?.();
  }

  /** Play the exit animation (shrink and disappear) - called after arriving at new floor */
  public playExitAnimation(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  public isActivated(): boolean {
    return this.activated;
  }

  public getRadius(): number {
    return PORTAL_RADIUS;
  }

  destroy(fromScene?: boolean): void {
    this.particles?.stop();
    super.destroy(fromScene);
  }
}
