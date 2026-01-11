import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface HpBarConfig {
  width?: number;
  height?: number;
  offsetY?: number;  // Offset above the entity
  hideWhenFull?: boolean;  // Hide the bar when HP is at max (default: true)
}

/**
 * Reusable HP bar component that follows an entity
 */
export class HpBar {
  private graphics: Phaser.GameObjects.Graphics;
  private readonly width: number;
  private readonly height: number;
  private readonly offsetY: number;
  private readonly hideWhenFull: boolean;

  constructor(
    scene: Phaser.Scene,
    config: HpBarConfig = {}
  ) {
    this.width = config.width ?? 32;
    this.height = config.height ?? 4;
    this.offsetY = config.offsetY ?? -24;
    this.hideWhenFull = config.hideWhenFull ?? true;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYERS.UI_WORLD);
  }

  /**
   * Update the HP bar position and fill
   */
  public update(x: number, y: number, currentHp: number, maxHp: number): void {
    // Auto-hide when full if configured
    if (this.hideWhenFull && currentHp >= maxHp) {
      this.graphics.setVisible(false);
      return;
    }

    this.graphics.setVisible(true);
    this.graphics.clear();

    const barX = x - this.width / 2;
    const barY = y + this.offsetY;

    // Background
    this.graphics.fillStyle(0x440000, 1);
    this.graphics.fillRect(barX, barY, this.width, this.height);

    // Health fill (green > yellow > red based on %)
    const hpPercent = currentHp / maxHp;
    const color = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(barX, barY, this.width * hpPercent, this.height);
  }

  /**
   * Show or hide the HP bar
   */
  public setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
