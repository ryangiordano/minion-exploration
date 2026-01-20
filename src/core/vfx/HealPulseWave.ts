import Phaser from 'phaser';

export interface HealPulseWaveConfig {
  /** Starting radius of the wave */
  startRadius?: number;
  /** Final radius of the wave */
  endRadius?: number;
  /** Duration of the wave expansion in ms */
  duration?: number;
  /** Color of the wave (default: green) */
  color?: number;
  /** Number of sparkle particles */
  sparkleCount?: number;
  /** Line width of the wave ring */
  lineWidth?: number;
}

const DEFAULT_CONFIG: Required<HealPulseWaveConfig> = {
  startRadius: 12,
  endRadius: 250,
  duration: 800,
  color: 0x00ff88,
  sparkleCount: 20,
  lineWidth: 4,
};

/**
 * A healing pulse wave effect - an expanding green circle with sparkles.
 * Used for area heal effects like Heal Pulse.
 */
export class HealPulseWave {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Play the heal pulse wave at the given position */
  play(x: number, y: number, config: HealPulseWaveConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    // Create the expanding ring
    this.createExpandingRing(x, y, opts);

    // Create the sparkle particles
    this.createSparkles(x, y, opts);

    // Create inner glow circle
    this.createInnerGlow(x, y, opts);
  }

  /** Create the main expanding ring */
  private createExpandingRing(x: number, y: number, opts: Required<HealPulseWaveConfig>): void {
    const ring = this.scene.add.circle(x, y, opts.startRadius);
    ring.setStrokeStyle(opts.lineWidth, opts.color, 0.8);
    ring.setFillStyle(opts.color, 0.1);

    this.scene.tweens.add({
      targets: ring,
      radius: opts.endRadius,
      alpha: 0,
      duration: opts.duration,
      ease: 'Power2',
      onUpdate: () => {
        // Manually update the stroke as the circle expands
        ring.setStrokeStyle(opts.lineWidth, opts.color, ring.alpha * 0.8);
        ring.setFillStyle(opts.color, ring.alpha * 0.1);
      },
      onComplete: () => ring.destroy(),
    });
  }

  /** Create sparkle particles that travel outward with the ring */
  private createSparkles(x: number, y: number, opts: Required<HealPulseWaveConfig>): void {
    // Create particle texture if it doesn't exist
    const textureKey = 'heal_sparkle';
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(3, 3, 3);
      graphics.generateTexture(textureKey, 6, 6);
      graphics.destroy();
    }

    // Create particles that expand outward
    for (let i = 0; i < opts.sparkleCount; i++) {
      const angle = (i / opts.sparkleCount) * Math.PI * 2;
      // Stagger the start positions slightly
      const startOffset = opts.startRadius + Math.random() * 5;
      const startX = x + Math.cos(angle) * startOffset;
      const startY = y + Math.sin(angle) * startOffset;

      const sparkle = this.scene.add.image(startX, startY, textureKey);
      sparkle.setTint(opts.color);
      sparkle.setScale(0.5 + Math.random() * 0.5);
      sparkle.setBlendMode(Phaser.BlendModes.ADD);
      sparkle.setAlpha(0.9);

      // Add a slight random angle variation for organic feel
      const angleVariation = (Math.random() - 0.5) * 0.3;
      const finalAngle = angle + angleVariation;
      const endX = x + Math.cos(finalAngle) * opts.endRadius;
      const endY = y + Math.sin(finalAngle) * opts.endRadius;

      // Sparkles travel outward with slight delay based on position
      const delay = Math.random() * 50;

      this.scene.tweens.add({
        targets: sparkle,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0.2,
        duration: opts.duration + 100,
        delay,
        ease: 'Power2',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  /** Create an inner glow that fades quickly */
  private createInnerGlow(x: number, y: number, opts: Required<HealPulseWaveConfig>): void {
    const glow = this.scene.add.circle(x, y, opts.startRadius * 2, opts.color, 0.4);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: glow,
      scale: 2,
      alpha: 0,
      duration: opts.duration * 0.6,
      ease: 'Power2',
      onComplete: () => glow.destroy(),
    });
  }
}
