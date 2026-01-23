import Phaser from 'phaser';

/** Configuration for the launch animation */
export interface LaunchConfig {
  /** Duration of the launch animation in ms */
  launchDuration?: number;
  /** Final scale when launched (mirroring arrival) */
  endScale?: number;
  /** Fusion trail color */
  trailColor?: number;
  /** Number of trail particles per burst */
  trailParticleCount?: number;
  /** How often to spawn trail particles (ms) */
  trailSpawnRate?: number;
  /** Screen shake intensity */
  shakeIntensity?: number;
  /** Screen shake duration */
  shakeDuration?: number;
}

const DEFAULT_CONFIG: Required<LaunchConfig> = {
  launchDuration: 400, // Faster than arrival for snappier feel
  endScale: 8, // Match arrival scale
  trailColor: 0x4488ff,
  trailParticleCount: 8,
  trailSpawnRate: 20, // Faster spawns during quick launch
  shakeIntensity: 0.02, // Slightly stronger than arrival
  shakeDuration: 300,
};

/** Interface for targets that support face animations */
interface FaceAnimatable {
  scrollFace?(deltaX: number, deltaY: number): void;
  setSmiling?(smiling: boolean): void;
}

/**
 * Handles the robot launch animation:
 * - Robot scales up and moves upward
 * - Blue fusion particle trail behind
 * - Fades out at the end
 */
export class LaunchSequence {
  private scene: Phaser.Scene;
  private config: Required<LaunchConfig>;
  private trailTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config: LaunchConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Play the launch animation.
   * @param target The game object to animate
   * @param onComplete Callback when animation finishes (before fade)
   */
  play(
    target: Phaser.GameObjects.GameObject & {
      setScale(scale: number): void;
      x: number;
      y: number;
    },
    onComplete?: () => void
  ): void {
    // Target y=0 (top of screen) - mirrors arrival which comes FROM y=0
    const endY = 0;

    // Start screen shake for dramatic effect
    this.scene.cameras.main.shake(this.config.shakeDuration, this.config.shakeIntensity);

    // Start the fusion trail
    this.startFusionTrail(target);

    // If target supports face animation, set it smiling for launch
    const faceTarget = target as unknown as FaceAnimatable;
    if (faceTarget.setSmiling) {
      faceTarget.setSmiling(true);
    }

    // Launch animation - scale up and fly to top of screen (reverse of arrival)
    this.scene.tweens.add({
      targets: target,
      y: endY,
      scaleX: this.config.endScale,
      scaleY: this.config.endScale,
      duration: this.config.launchDuration,
      ease: 'Power2.easeOut', // Starts fast, decelerates (opposite of arrival's easeIn)
    });

    // Quick fade out only at the very end
    if ('alpha' in target) {
      this.scene.tweens.add({
        targets: target,
        alpha: 0,
        duration: this.config.launchDuration * 0.25,
        delay: this.config.launchDuration * 0.75,
        ease: 'Power3.easeIn',
      });
    }

    // Complete after animation
    this.scene.time.delayedCall(this.config.launchDuration, () => {
      this.stopFusionTrail();
      onComplete?.();
    });
  }

  /** Start emitting fusion trail particles */
  private startFusionTrail(
    target: Phaser.GameObjects.GameObject & { x: number; y: number }
  ): void {
    this.trailTimer = this.scene.time.addEvent({
      delay: this.config.trailSpawnRate,
      callback: () => this.emitTrailBurst(target.x, target.y),
      loop: true,
    });
  }

  /** Stop the fusion trail */
  private stopFusionTrail(): void {
    this.trailTimer?.destroy();
    this.trailTimer = undefined;
  }

  /** Emit a burst of trail particles */
  private emitTrailBurst(x: number, y: number): void {
    const count = this.config.trailParticleCount;
    const color = this.config.trailColor;

    for (let i = 0; i < count; i++) {
      // Particles spread horizontally and fall down
      const offsetX = (Math.random() - 0.5) * 40;
      const size = 4 + Math.random() * 4;

      const particle = this.scene.add.circle(x + offsetX, y + 20, size, color);
      particle.setAlpha(0.8);
      particle.setBlendMode(Phaser.BlendModes.ADD);

      // Particles fall and fade
      this.scene.tweens.add({
        targets: particle,
        y: y + 60 + Math.random() * 40,
        x: x + offsetX + (Math.random() - 0.5) * 20,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 300 + Math.random() * 200,
        ease: 'Power2.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    // Core glow at robot position
    const glow = this.scene.add.circle(x, y + 10, 15, color);
    glow.setAlpha(0.6);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      onComplete: () => glow.destroy(),
    });
  }

  destroy(): void {
    this.stopFusionTrail();
  }
}
