import Phaser from 'phaser';

export interface FloatingTextConfig {
  /** Font size */
  fontSize?: string;
  /** Text color (CSS format) */
  color?: string;
  /** Whether to use bold */
  bold?: boolean;
  /** Stroke color for outline */
  stroke?: string;
  /** Stroke thickness */
  strokeThickness?: number;
  /** How far the text floats upward */
  floatDistance?: number;
  /** Duration in ms */
  duration?: number;
  /** Whether this is screen-space (UI) text */
  isUI?: boolean;
  /** Depth for rendering order */
  depth?: number;
}

const DEFAULT_CONFIG: Required<FloatingTextConfig> = {
  fontSize: '14px',
  color: '#ffffff',
  bold: false,
  stroke: '#000000',
  strokeThickness: 2,
  floatDistance: 30,
  duration: 800,
  isUI: false,
  depth: 100,
};

/** Creates floating text that rises and fades out */
export class FloatingText {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show floating text at the given position */
  show(x: number, y: number, message: string, config: FloatingTextConfig = {}): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    const text = this.scene.add.text(x, y - 20, message, {
      fontSize: opts.fontSize,
      color: opts.color,
      fontStyle: opts.bold ? 'bold' : 'normal',
      stroke: opts.stroke,
      strokeThickness: opts.strokeThickness,
    });

    text.setOrigin(0.5, 1);
    text.setDepth(opts.depth);

    if (opts.isUI) {
      text.setScrollFactor(0);
    }

    this.scene.tweens.add({
      targets: text,
      y: y - 20 - opts.floatDistance,
      alpha: 0,
      duration: opts.duration,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
