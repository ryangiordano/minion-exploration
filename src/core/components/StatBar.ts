import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface StatBarConfig {
  width?: number;
  height?: number;
  offsetY?: number;
  color?: number;             // Bar fill color (required if colorFn not provided)
  backgroundColor?: number;   // Background color (default: dark version of color)
  hideWhenFull?: boolean;     // Hide the bar when at max (default: false)
  colorFn?: (percent: number) => number;  // Dynamic color based on fill percent (0-1)
}

// Preset color functions
export const hpColorFn = (percent: number): number => {
  if (percent > 0.5) return 0x00ff00;      // Green
  if (percent > 0.25) return 0xffff00;     // Yellow
  return 0xff0000;                          // Red
};

// Preset configs for common bar types
export const HP_BAR_DEFAULTS: StatBarConfig = {
  color: 0x00ff00,
  colorFn: hpColorFn,
  hideWhenFull: true,
};

export const MP_BAR_DEFAULTS: StatBarConfig = {
  color: 0x4488ff,
  hideWhenFull: true,
};

export const XP_BAR_DEFAULTS: StatBarConfig = {
  color: 0xffcc00,
  hideWhenFull: false,
};

/**
 * Reusable stat bar component that follows an entity.
 * Can be used for HP, MP, XP, or any other stat.
 */
export class StatBar {
  private graphics: Phaser.GameObjects.Graphics;
  private readonly width: number;
  private readonly height: number;
  private readonly offsetY: number;
  private readonly color: number;
  private readonly backgroundColor: number;
  private readonly hideWhenFull: boolean;
  private readonly colorFn?: (percent: number) => number;

  constructor(
    scene: Phaser.Scene,
    config: StatBarConfig
  ) {
    this.width = config.width ?? 32;
    this.height = config.height ?? 4;
    this.offsetY = config.offsetY ?? -24;
    this.color = config.color ?? 0xffffff;
    this.backgroundColor = config.backgroundColor ?? this.darkenColor(this.color);
    this.hideWhenFull = config.hideWhenFull ?? false;
    this.colorFn = config.colorFn;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYERS.UI_WORLD);
  }

  /**
   * Update the bar position and fill
   */
  public update(x: number, y: number, current: number, max: number): void {
    // Auto-hide when full if configured
    if (this.hideWhenFull && current >= max) {
      this.graphics.setVisible(false);
      return;
    }

    this.graphics.setVisible(true);
    this.graphics.clear();

    const barX = x - this.width / 2;
    const barY = y + this.offsetY;

    // Background
    this.graphics.fillStyle(this.backgroundColor, 1);
    this.graphics.fillRect(barX, barY, this.width, this.height);

    // Fill
    const percent = Math.min(1, Math.max(0, current / max));
    const fillColor = this.colorFn ? this.colorFn(percent) : this.color;
    this.graphics.fillStyle(fillColor, 1);
    this.graphics.fillRect(barX, barY, this.width * percent, this.height);
  }

  /**
   * Show or hide the bar
   */
  public setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  /**
   * Create a darker version of a color for backgrounds
   */
  private darkenColor(color: number): number {
    const r = ((color >> 16) & 0xff) * 0.3;
    const g = ((color >> 8) & 0xff) * 0.3;
    const b = (color & 0xff) * 0.3;
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }
}
