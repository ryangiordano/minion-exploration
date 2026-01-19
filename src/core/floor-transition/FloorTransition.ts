import Phaser from 'phaser';

/** Configuration for floor transition */
export interface FloorTransitionConfig {
  /** Duration of confetti celebration (ms) */
  confettiDuration?: number;
  /** Duration of fade to black (ms) */
  fadeDuration?: number;
  /** Duration text is displayed (ms) */
  textDisplayDuration?: number;
  /** Text to display during transition */
  transitionText?: string;
  /** Called while screen is black, before fade in - use for repositioning */
  onScreenBlack?: () => void;
  /** World position to shoot confetti from (e.g., portal location) */
  confettiOrigin?: { x: number; y: number };
}

const DEFAULT_CONFIG: Required<FloorTransitionConfig> = {
  confettiDuration: 1500,
  fadeDuration: 500,
  textDisplayDuration: 1500,
  transitionText: 'Delving deeper into the depths...',
  onScreenBlack: () => {},
  confettiOrigin: { x: 0, y: 0 },
};

/**
 * Handles the floor transition sequence:
 * 1. Confetti celebration
 * 2. Fade to black
 * 3. Display text
 * 4. Fade in
 */
export class FloorTransition {
  private scene: Phaser.Scene;
  private config: Required<FloorTransitionConfig>;
  private confettiParticles: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, config: FloorTransitionConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Run the full transition sequence, then call onComplete */
  play(onComplete: () => void): void {
    this.showConfetti(() => {
      this.fadeToBlack(() => {
        // Call onScreenBlack while screen is black (for repositioning, spawning, etc.)
        this.config.onScreenBlack();
        this.showText(() => {
          this.fadeIn(() => {
            onComplete();
          });
        });
      });
    });
  }

  private showConfetti(onComplete: () => void): void {
    const particleCount = 60;
    const colors = [0x6644ff, 0xaa88ff, 0x4ecdc4, 0x45b7d1, 0xffd700, 0xffeaa7];
    const origin = this.config.confettiOrigin;

    // Spawn confetti particles shooting outward from origin
    for (let i = 0; i < particleCount; i++) {
      const color = Phaser.Math.RND.pick(colors);
      const size = Phaser.Math.Between(4, 10);

      // Start at the origin point (world coordinates)
      const particle = this.scene.add.circle(origin.x, origin.y, size, color);
      particle.setDepth(2000);
      this.confettiParticles.push(particle);

      // Shoot outward in random direction
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(150, 400);
      const targetX = origin.x + Math.cos(angle) * distance;
      const targetY = origin.y + Math.sin(angle) * distance;

      const duration = Phaser.Math.Between(800, this.config.confettiDuration);

      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        rotation: Phaser.Math.Between(-5, 5),
        duration,
        ease: 'Power2',
        delay: Phaser.Math.Between(0, 200),
        onComplete: () => {
          particle.destroy();
          const idx = this.confettiParticles.indexOf(particle);
          if (idx > -1) this.confettiParticles.splice(idx, 1);
        },
      });
    }

    // Wait for confetti duration then continue
    this.scene.time.delayedCall(this.config.confettiDuration, onComplete);
  }

  private fadeToBlack(onComplete: () => void): void {
    const camera = this.scene.cameras.main;

    camera.once('camerafadeoutcomplete', onComplete);
    camera.fadeOut(this.config.fadeDuration, 0, 0, 0);
  }

  private showText(onComplete: () => void): void {
    const { width, height } = this.scene.cameras.main;

    const text = this.scene.add.text(width / 2, height / 2, this.config.transitionText, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'italic',
    });
    text.setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(2002);
    text.setAlpha(0);

    // Fade in text
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });

    // Wait, then fade out and continue
    this.scene.time.delayedCall(this.config.textDisplayDuration, () => {
      this.scene.tweens.add({
        targets: text,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          text.destroy();
          onComplete();
        },
      });
    });
  }

  private fadeIn(onComplete: () => void): void {
    const camera = this.scene.cameras.main;

    camera.once('camerafadeincomplete', onComplete);
    camera.fadeIn(this.config.fadeDuration, 0, 0, 0);
  }

  /** Clean up any remaining particles */
  destroy(): void {
    this.confettiParticles.forEach(p => p.destroy());
    this.confettiParticles = [];
  }
}
