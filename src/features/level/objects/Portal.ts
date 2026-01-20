import Phaser from 'phaser';

const PORTAL_COLOR = 0x6644ff;
const PORTAL_INNER_COLOR = 0x220066;
const PORTAL_RADIUS = 40;

/** Timing constants for portal animations */
const PORTAL_GROW_DURATION = 400;
const CHARACTER_SHRINK_DURATION = 300;
const PORTAL_CLOSE_DURATION = 250;
const PORTAL_OPEN_DURATION = 300;
const CHARACTER_APPEAR_DURATION = 250;
const NANOBOT_STAGGER_DELAY = 50;

export interface PortalConfig {
  onEnter?: () => void;
  /** If true, skip spawn animation and start fully visible at current scale */
  skipSpawnAnimation?: boolean;
}

/** A game object that can be animated into/out of the portal */
export interface PortalAnimatable {
  /** The Phaser game object to tween for scale (may be different from position owner) */
  target: Phaser.GameObjects.GameObject & { setScale(scale: number): void };
  /** Object that owns the position (for moving to portal center) */
  positionOwner: { x: number; y: number; setPosition(x: number, y: number): void };
  /** The scale to restore to when appearing from the portal */
  originalScale: number;
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

  /** Called when a minion enters the portal - simple version without party animation */
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

  /**
   * Animated entry sequence: portal grows, party shrinks into it, portal closes.
   * Calls onComplete when the full sequence is done (ready to fade to black).
   */
  public enterWithParty(
    robot: PortalAnimatable,
    nanobots: PortalAnimatable[],
    onComplete: () => void
  ): void {
    if (this.activated) return;
    this.activated = true;

    // Step 1: Portal grows
    this.scene.tweens.add({
      targets: this,
      scaleX: 3,
      scaleY: 3,
      duration: PORTAL_GROW_DURATION,
      ease: 'Power2',
      onComplete: () => {
        // Step 2: Shrink all party members into the portal center
        this.shrinkPartyIntoPortal(robot, nanobots, () => {
          // Step 3: Portal closes
          this.closePortal(onComplete);
        });
      },
    });
  }

  /** Shrink robot and nanobots to scale 0 at portal center */
  private shrinkPartyIntoPortal(
    robot: PortalAnimatable,
    nanobots: PortalAnimatable[],
    onComplete: () => void
  ): void {
    const allTargets = [robot, ...nanobots];
    let completed = 0;

    for (const animatable of allTargets) {
      // Tween both the visual target and the position owner to portal center
      this.scene.tweens.add({
        targets: animatable.positionOwner,
        x: this.x,
        y: this.y,
        duration: CHARACTER_SHRINK_DURATION,
        ease: 'Power2.easeIn',
      });

      this.scene.tweens.add({
        targets: animatable.target,
        scaleX: 0,
        scaleY: 0,
        duration: CHARACTER_SHRINK_DURATION,
        ease: 'Power2.easeIn',
        onComplete: () => {
          completed++;
          if (completed === allTargets.length) {
            onComplete();
          }
        },
      });
    }

    // Handle empty party case
    if (allTargets.length === 0) {
      onComplete();
    }
  }

  /** Close the portal (shrink to 0) */
  private closePortal(onComplete: () => void): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      duration: PORTAL_CLOSE_DURATION,
      ease: 'Power2.easeIn',
      onComplete: () => onComplete(),
    });
  }

  /**
   * Animated exit sequence for arrival portal: portal opens, party appears with stagger.
   * Call this on an arrival portal that starts at scale 0.
   */
  public openWithParty(
    robot: PortalAnimatable,
    nanobots: PortalAnimatable[],
    onComplete: () => void
  ): void {
    // Ensure party starts hidden at portal center
    robot.positionOwner.setPosition(this.x, this.y);
    robot.target.setScale(0);
    for (const nanobot of nanobots) {
      nanobot.positionOwner.setPosition(this.x, this.y);
      nanobot.target.setScale(0);
    }

    // Step 1: Portal opens
    this.scene.tweens.add({
      targets: this,
      scaleX: 3,
      scaleY: 3,
      duration: PORTAL_OPEN_DURATION,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Step 2: Robot appears first
        this.appearFromPortal(robot, () => {
          // Step 3: Nanobots appear with stagger, then complete
          this.appearNanobotsStaggered(nanobots, onComplete);
        });
      },
    });
  }

  /** Scale a single target up from the portal center */
  private appearFromPortal(animatable: PortalAnimatable, onComplete: () => void): void {
    this.scene.tweens.add({
      targets: animatable.target,
      scaleX: animatable.originalScale,
      scaleY: animatable.originalScale,
      duration: CHARACTER_APPEAR_DURATION,
      ease: 'Back.easeOut',
      onComplete: () => onComplete(),
    });
  }

  /** Scale nanobots up with staggered timing */
  private appearNanobotsStaggered(nanobots: PortalAnimatable[], onComplete: () => void): void {
    if (nanobots.length === 0) {
      onComplete();
      return;
    }

    let completed = 0;
    for (let i = 0; i < nanobots.length; i++) {
      const animatable = nanobots[i];
      this.scene.tweens.add({
        targets: animatable.target,
        scaleX: animatable.originalScale,
        scaleY: animatable.originalScale,
        duration: CHARACTER_APPEAR_DURATION,
        ease: 'Back.easeOut',
        delay: i * NANOBOT_STAGGER_DELAY,
        onComplete: () => {
          completed++;
          if (completed === nanobots.length) {
            onComplete();
          }
        },
      });
    }
  }

  /** Play the exit animation (shrink and disappear) - called after arriving at new floor */
  public playExitAnimation(onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy();
        onComplete?.();
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
