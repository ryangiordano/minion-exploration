import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface FloatingTextConfig {
  text: string;
  x: number;
  y: number;
  color?: string;           // Text color (default: '#ffffff')
  fontSize?: number;        // Font size in pixels (default: 16)
  duration?: number;        // How long before fully faded (default: 1000ms)
  floatSpeed?: number;      // Pixels per second upward (default: 50)
  fontFamily?: string;      // Font family (default: 'Arial')
  stroke?: string;          // Stroke/outline color (default: '#000000')
  strokeWidth?: number;     // Stroke width (default: 2)
}

/**
 * Creates floating text that rises and fades out.
 * Useful for damage numbers, level ups, pickups, etc.
 */
export class FloatingText {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Show floating text at a position
   */
  public show(config: FloatingTextConfig): Phaser.GameObjects.Text {
    const {
      text,
      x,
      y,
      color = '#ffffff',
      fontSize = 16,
      duration = 1000,
      floatSpeed = 50,
      fontFamily = 'Arial',
      stroke = '#000000',
      strokeWidth = 2,
    } = config;

    const textObject = this.scene.add.text(x, y, text, {
      fontFamily,
      fontSize: `${fontSize}px`,
      color,
      stroke,
      strokeThickness: strokeWidth,
    });

    textObject.setOrigin(0.5, 0.5);
    textObject.setDepth(LAYERS.UI_WORLD + 2);

    // Calculate total distance to float
    const floatDistance = (floatSpeed * duration) / 1000;

    // Animate upward and fade out
    this.scene.tweens.add({
      targets: textObject,
      y: y - floatDistance,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => {
        textObject.destroy();
      },
    });

    return textObject;
  }

  /**
   * Convenience method for level up text
   */
  public showLevelUp(x: number, y: number): Phaser.GameObjects.Text {
    return this.show({
      text: 'LEVEL UP!',
      x,
      y: y - 20, // Start above the entity
      color: '#ffcc00',
      fontSize: 14,
      duration: 1200,
      floatSpeed: 40,
      stroke: '#000000',
      strokeWidth: 3,
    });
  }

  /**
   * Convenience method for damage numbers
   */
  public showDamage(x: number, y: number, damage: number): Phaser.GameObjects.Text {
    return this.show({
      text: `-${damage}`,
      x,
      y,
      color: '#ff4444',
      fontSize: 12,
      duration: 800,
      floatSpeed: 60,
    });
  }

  /**
   * Convenience method for healing numbers
   */
  public showHeal(x: number, y: number, amount: number): Phaser.GameObjects.Text {
    return this.show({
      text: `+${amount}`,
      x,
      y,
      color: '#44ff44',
      fontSize: 12,
      duration: 800,
      floatSpeed: 60,
    });
  }
}
