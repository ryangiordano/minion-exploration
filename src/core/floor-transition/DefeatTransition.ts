import Phaser from 'phaser';

/** Configuration for defeat transition */
export interface DefeatTransitionConfig {
  /** Duration of fade to white (ms) */
  fadeDuration?: number;
  /** Duration text is displayed (ms) */
  textDisplayDuration?: number;
  /** Text to display during transition */
  transitionText?: string;
  /** Text color */
  textColor?: string;
}

const DEFAULT_CONFIG: Required<DefeatTransitionConfig> = {
  fadeDuration: 800,
  textDisplayDuration: 1500,
  transitionText: 'You return to the surface...',
  textColor: '#000000',
};

/**
 * Handles the defeat transition sequence:
 * 1. Fade to white
 * 2. Display text
 * 3. Call onComplete
 */
export class DefeatTransition {
  private scene: Phaser.Scene;
  private config: Required<DefeatTransitionConfig>;
  private overlay?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, config: DefeatTransitionConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Run the defeat transition sequence, then call onComplete */
  play(onComplete: () => void): void {
    this.fadeToWhite(() => {
      this.showText(() => {
        onComplete();
      });
    });
  }

  private fadeToWhite(onComplete: () => void): void {
    const { width, height } = this.scene.cameras.main;

    // Create full-screen white overlay
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(2001);

    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: this.config.fadeDuration,
      ease: 'Power2',
      onComplete,
    });
  }

  private showText(onComplete: () => void): void {
    const { width, height } = this.scene.cameras.main;

    const text = this.scene.add.text(width / 2, height / 2, this.config.transitionText, {
      fontSize: '28px',
      color: this.config.textColor,
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

    // Wait then complete
    this.scene.time.delayedCall(this.config.textDisplayDuration, onComplete);
  }

  /** Clean up overlay */
  destroy(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
  }
}
