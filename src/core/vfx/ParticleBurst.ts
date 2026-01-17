import Phaser from 'phaser';

export interface ParticleBurstConfig {
  /** Number of particles in the burst */
  count?: number;
  /** Starting radius from center */
  startRadius?: number;
  /** How far particles travel outward */
  distance?: number;
  /** Particle size */
  size?: number;
  /** Duration in ms */
  duration?: number;
  /** Easing function */
  ease?: string;
  /** Whether distance should vary randomly */
  randomizeDistance?: boolean;
}

const DEFAULT_CONFIG: Required<ParticleBurstConfig> = {
  count: 8,
  startRadius: 0,
  distance: 30,
  size: 4,
  duration: 250,
  ease: 'Power2',
  randomizeDistance: false,
};

/** Creates a radial burst of particles that expand outward and fade */
export class ParticleBurst {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Play a burst effect at the given position */
  play(x: number, y: number, color: number, config: ParticleBurstConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    for (let i = 0; i < opts.count; i++) {
      const angle = (i / opts.count) * Math.PI * 2;
      const startX = x + Math.cos(angle) * opts.startRadius;
      const startY = y + Math.sin(angle) * opts.startRadius;

      const particle = this.scene.add.circle(startX, startY, opts.size, color);

      const distance = opts.randomizeDistance
        ? opts.distance + Math.random() * (opts.distance * 0.5)
        : opts.distance;

      this.scene.tweens.add({
        targets: particle,
        x: startX + Math.cos(angle) * distance,
        y: startY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: opts.duration,
        ease: opts.ease,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Play a burst with UI depth (for screen-space effects) */
  playUI(x: number, y: number, color: number, config: ParticleBurstConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    for (let i = 0; i < opts.count; i++) {
      const angle = (i / opts.count) * Math.PI * 2;
      const particle = this.scene.add.circle(x, y, opts.size, color);
      particle.setScrollFactor(0);
      particle.setDepth(999);

      const distance = opts.randomizeDistance
        ? opts.distance + Math.random() * (opts.distance * 0.5)
        : opts.distance;

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: opts.duration,
        ease: opts.ease,
        onComplete: () => particle.destroy(),
      });
    }
  }
}
