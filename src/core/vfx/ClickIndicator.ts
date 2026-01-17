import Phaser from 'phaser';

export interface ClickIndicatorConfig {
  /** Starting radius of the ring */
  startRadius?: number;
  /** Ending radius of the ring */
  endRadius?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Duration in ms */
  duration?: number;
  /** Easing function */
  ease?: string;
}

const DEFAULT_CONFIG: Required<ClickIndicatorConfig> = {
  startRadius: 30,
  endRadius: 8,
  strokeWidth: 3,
  duration: 250,
  ease: 'Power2',
};

/** Creates a shrinking ring effect to indicate a click/command location */
export class ClickIndicator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show a click indicator at the given world position */
  show(x: number, y: number, color: number, config: ClickIndicatorConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    const circle = this.scene.add.circle(x, y, opts.startRadius, color, 0);
    circle.setStrokeStyle(opts.strokeWidth, color, 0.8);

    this.scene.tweens.add({
      targets: circle,
      radius: opts.endRadius,
      alpha: 0,
      duration: opts.duration,
      ease: opts.ease,
      onUpdate: () => {
        circle.setRadius(circle.radius);
      },
      onComplete: () => {
        circle.destroy();
      },
    });
  }
}
