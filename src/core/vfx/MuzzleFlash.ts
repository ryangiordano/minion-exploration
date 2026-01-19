import Phaser from 'phaser';

export interface MuzzleFlashConfig {
  /** Maximum size the flash grows to */
  maxSize?: number;
  /** Duration of grow phase in ms */
  growDuration?: number;
  /** Duration of shrink phase in ms */
  shrinkDuration?: number;
  /** Starting opacity */
  alpha?: number;
  /** Easing for grow phase */
  growEase?: string;
  /** Easing for shrink phase */
  shrinkEase?: string;
}

const DEFAULT_CONFIG: Required<MuzzleFlashConfig> = {
  maxSize: 20,
  growDuration: 60,
  shrinkDuration: 80,
  alpha: 0.8,
  growEase: 'Power2',
  shrinkEase: 'Power2',
};

/**
 * Quick grow-and-shrink sphere effect for muzzle flashes, spell casts, etc.
 */
export class MuzzleFlash {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Play a muzzle flash at the given position */
  play(x: number, y: number, color: number, config: MuzzleFlashConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    const flash = this.scene.add.circle(x, y, 1, color, opts.alpha);

    // Grow phase
    this.scene.tweens.add({
      targets: flash,
      scale: opts.maxSize,
      duration: opts.growDuration,
      ease: opts.growEase,
      onComplete: () => {
        // Shrink and fade phase
        this.scene.tweens.add({
          targets: flash,
          scale: 0,
          alpha: 0,
          duration: opts.shrinkDuration,
          ease: opts.shrinkEase,
          onComplete: () => flash.destroy(),
        });
      },
    });
  }
}
