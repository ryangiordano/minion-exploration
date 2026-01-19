import Phaser from 'phaser';

export interface LaserBeamConfig {
  /** Width of the beam */
  width?: number;
  /** Duration beam is visible in ms */
  duration?: number;
  /** Starting opacity */
  alpha?: number;
  /** Whether to fade out (vs instant disappear) */
  fadeOut?: boolean;
  /** Glow/bloom effect size (0 = no glow) */
  glowSize?: number;
}

const DEFAULT_CONFIG: Required<LaserBeamConfig> = {
  width: 3,
  duration: 100,
  alpha: 0.9,
  fadeOut: true,
  glowSize: 6,
};

/**
 * Instant laser beam effect - draws a line from origin to target that quickly fades.
 */
export class LaserBeam {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Fire a laser beam from origin to target */
  play(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number,
    config: LaserBeamConfig = {}
  ): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    // Create glow layer (wider, more transparent)
    if (opts.glowSize > 0) {
      const glow = this.scene.add.graphics();
      glow.lineStyle(opts.width + opts.glowSize, color, opts.alpha * 0.3);
      glow.lineBetween(fromX, fromY, toX, toY);

      if (opts.fadeOut) {
        this.scene.tweens.add({
          targets: glow,
          alpha: 0,
          duration: opts.duration,
          ease: 'Power2',
          onComplete: () => glow.destroy(),
        });
      } else {
        this.scene.time.delayedCall(opts.duration, () => glow.destroy());
      }
    }

    // Create main beam
    const beam = this.scene.add.graphics();
    beam.lineStyle(opts.width, color, opts.alpha);
    beam.lineBetween(fromX, fromY, toX, toY);

    if (opts.fadeOut) {
      this.scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: opts.duration,
        ease: 'Power2',
        onComplete: () => beam.destroy(),
      });
    } else {
      this.scene.time.delayedCall(opts.duration, () => beam.destroy());
    }

    // Create bright core (thinner, brighter)
    const core = this.scene.add.graphics();
    core.lineStyle(Math.max(1, opts.width - 2), 0xffffff, opts.alpha);
    core.lineBetween(fromX, fromY, toX, toY);

    if (opts.fadeOut) {
      this.scene.tweens.add({
        targets: core,
        alpha: 0,
        duration: opts.duration * 0.7,
        ease: 'Power2',
        onComplete: () => core.destroy(),
      });
    } else {
      this.scene.time.delayedCall(opts.duration, () => core.destroy());
    }
  }
}
