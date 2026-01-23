import Phaser from 'phaser';

/** Configuration for the arrival animation */
export interface ArrivalConfig {
  /** Duration of the fall/scale-in animation in ms */
  fallDuration?: number;
  /** Starting scale (large, falling from sky) */
  startScale?: number;
  /** Screen shake intensity on landing */
  shakeIntensity?: number;
  /** Screen shake duration in ms */
  shakeDuration?: number;
  /** Dust cloud color */
  dustColor?: number;
  /** Number of dust particles */
  dustCount?: number;
}

const DEFAULT_CONFIG: Required<ArrivalConfig> = {
  fallDuration: 500,
  startScale: 8,
  shakeIntensity: 0.015,
  shakeDuration: 200,
  dustColor: 0xaaaaaa,
  dustCount: 16,
};

/** Interface for targets that support face animations (like RobotVisual) */
interface FaceAnimatable {
  scrollFace?(deltaX: number, deltaY: number): void;
  setSmiling?(smiling: boolean): void;
}

/**
 * Handles the robot arrival animation:
 * - Robot scales in from large (falling from sky)
 * - Face spins and smiles during fall
 * - Screen shake on impact
 * - Dust cloud burst
 */
export class ArrivalSequence {
  private scene: Phaser.Scene;
  private config: Required<ArrivalConfig>;

  constructor(scene: Phaser.Scene, config: ArrivalConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Play the arrival animation for a target.
   * @param target The game object to animate (should have setScale method)
   * @param x Landing position X
   * @param y Landing position Y
   * @param onComplete Callback when animation finishes
   */
  play(
    target: Phaser.GameObjects.GameObject & { setScale(scale: number): void; x: number; y: number },
    x: number,
    y: number,
    onComplete?: () => void
  ): void {
    // Start at y=0 (top of world/screen)
    const startY = 0;

    // Position target at top of screen, at landing X
    if ('setPosition' in target) {
      (target as Phaser.GameObjects.Sprite).setPosition(x, startY);
    }

    // Start large (falling from sky effect)
    target.setScale(this.config.startScale);

    // Start visible (no fade - we want to see it fall)
    if ('setAlpha' in target) {
      (target as Phaser.GameObjects.Sprite).setAlpha(1);
    }

    // If target supports face animation, set it smiling for the fall
    const faceTarget = target as unknown as FaceAnimatable;
    if (faceTarget.setSmiling) {
      faceTarget.setSmiling(true);
    }

    // Animate falling down and scaling to normal
    this.scene.tweens.add({
      targets: target,
      y: y,
      scaleX: 1,
      scaleY: 1,
      duration: this.config.fallDuration,
      ease: 'Power2.easeIn', // Accelerates as it falls (gravity feel)
      onComplete: () => {
        // Stop smiling after landing
        if (faceTarget.setSmiling) {
          faceTarget.setSmiling(false);
        }
        this.onLanding(x, y, onComplete);
      },
    });
  }

  /** Handle landing effects (shake, dust) */
  private onLanding(x: number, y: number, onComplete?: () => void): void {
    // Screen shake
    this.scene.cameras.main.shake(this.config.shakeDuration, this.config.shakeIntensity);

    // Dust cloud burst
    this.createDustCloud(x, y);

    // Complete callback after shake
    this.scene.time.delayedCall(this.config.shakeDuration, () => {
      onComplete?.();
    });
  }

  /** Create expanding dust cloud effect */
  private createDustCloud(x: number, y: number): void {
    const count = this.config.dustCount;
    const color = this.config.dustColor;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const size = 8 + Math.random() * 8;

      const particle = this.scene.add.circle(x, y, size, color);
      particle.setAlpha(0.8);

      // Expand outward and fade - longer duration for more persistence
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 800,
        ease: 'Power2.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    // Central dust ring that expands
    const ring = this.scene.add.circle(x, y, 10, color, 0);
    ring.setStrokeStyle(4, color, 0.9);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 5,
      scaleY: 5,
      alpha: 0,
      duration: 700,
      ease: 'Power2.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
