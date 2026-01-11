import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface LevelUpEffectConfig {
  particleCount?: number;     // Number of particles to emit (default: 15)
  colors?: number[];          // Colors to use for particles (default: gold/yellow)
  duration?: number;          // How long particles live in ms (default: 1000)
  speed?: number;             // Initial particle speed (default: 120)
  circleRadius?: number;      // Starting radius of shrinking circle (default: 40)
}

/**
 * Creates a sparkling burst of particles and shrinking circle for level up effects.
 * Call play() to trigger the effect at a position.
 */
export class LevelUpEffect {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private config: Required<LevelUpEffectConfig>;

  constructor(scene: Phaser.Scene, config: LevelUpEffectConfig = {}) {
    this.scene = scene;
    this.config = {
      particleCount: config.particleCount ?? 15,
      colors: config.colors ?? [0xffcc00, 0xffee66, 0xffffff, 0xffaa00],
      duration: config.duration ?? 1000,
      speed: config.speed ?? 120,
      circleRadius: config.circleRadius ?? 40,
    };

    // Create a larger circle texture for particles if it doesn't exist
    if (!scene.textures.exists('levelup_particle_large')) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('levelup_particle_large', 16, 16);
      graphics.destroy();
    }

    // Create the particle emitter (initially inactive)
    this.particles = scene.add.particles(0, 0, 'levelup_particle_large', {
      lifespan: this.config.duration,
      speed: { min: this.config.speed * 0.4, max: this.config.speed },
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 1, end: 0 },
      angle: { min: 0, max: 360 },
      gravityY: 60,
      emitting: false,
    });

    this.particles.setDepth(LAYERS.UI_WORLD + 1);
  }

  /**
   * Play the level up effect at the given position
   */
  public play(x: number, y: number): void {
    this.particles.setPosition(x, y);

    // Set tint to a random color from our palette for the burst
    const colors = this.config.colors;
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    this.particles.particleTint = randomColor;

    // Emit all particles at once
    this.particles.emitParticle(this.config.particleCount);

    // Create shrinking circle effect
    this.createShrinkingCircle(x, y);
  }

  /**
   * Create a circle that shrinks inward toward the position
   */
  private createShrinkingCircle(x: number, y: number): void {
    const circle = this.scene.add.graphics();
    circle.setDepth(LAYERS.UI_WORLD + 1);

    const startRadius = this.config.circleRadius;
    const duration = 400;
    const color = 0xffcc00;

    // Animate the circle shrinking
    let elapsed = 0;
    const lineWidth = 3;

    const update = (delta: number) => {
      elapsed += delta;
      const progress = Math.min(1, elapsed / duration);

      // Ease out - starts fast, slows down
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentRadius = startRadius * (1 - easedProgress);
      const alpha = 1 - progress * 0.5;

      circle.clear();
      circle.lineStyle(lineWidth, color, alpha);
      circle.strokeCircle(x, y, currentRadius);

      if (progress >= 1) {
        circle.destroy();
        this.scene.events.off('update', update);
      }
    };

    this.scene.events.on('update', update);
  }

  public destroy(): void {
    this.particles.destroy();
  }
}
