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
}

const DEFAULT_CONFIG: Required<FloorTransitionConfig> = {
  confettiDuration: 1500,
  fadeDuration: 500,
  textDisplayDuration: 1500,
  transitionText: 'Delving deeper into the depths...',
  onScreenBlack: () => {},
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
    const { width, height } = this.scene.cameras.main;
    const particleCount = 50;
    const colors = [0xffd700, 0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffeaa7];

    // Spawn confetti particles
    for (let i = 0; i < particleCount; i++) {
      const x = Phaser.Math.Between(0, width);
      const startY = -20;
      const color = Phaser.Math.RND.pick(colors);
      const size = Phaser.Math.Between(4, 8);

      const particle = this.scene.add.circle(x, startY, size, color);
      particle.setScrollFactor(0);
      particle.setDepth(2000);
      this.confettiParticles.push(particle);

      // Animate falling with wobble
      const targetY = height + 50;
      const duration = Phaser.Math.Between(1000, this.config.confettiDuration);
      const wobbleAmount = Phaser.Math.Between(30, 80);

      this.scene.tweens.add({
        targets: particle,
        y: targetY,
        x: x + Phaser.Math.Between(-wobbleAmount, wobbleAmount),
        rotation: Phaser.Math.Between(-3, 3),
        duration,
        ease: 'Power1',
        delay: Phaser.Math.Between(0, 300),
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
