import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface StatBarConfig {
  width?: number;
  height?: number;
  offsetY?: number;
  color?: number;             // Bar fill color (required if colorFn not provided)
  backgroundColor?: number;   // Background color (default: dark version of color)
  hideWhenFull?: boolean;     // Hide the bar when at max (default: false)
  hideWhenEmpty?: boolean;    // Hide the bar when at zero (default: false)
  colorFn?: (percent: number) => number;  // Dynamic color based on fill percent (0-1)
  animated?: boolean;         // Enable smooth animations (default: true)
  animationSpeed?: number;    // How fast bar fills/drains (default: 8, higher = faster)
  showGhostBar?: boolean;     // Show trailing damage indicator (default: false)
  ghostColor?: number;        // Color of ghost bar (default: red 0xff0000)
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
  animated: true,
  showGhostBar: true,
  ghostColor: 0xff0000,
};

export const MP_BAR_DEFAULTS: StatBarConfig = {
  color: 0x4488ff,
  hideWhenFull: true,
};

export const XP_BAR_DEFAULTS: StatBarConfig = {
  color: 0xffcc00,
  hideWhenFull: false,
  hideWhenEmpty: true,
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
  private readonly hideWhenEmpty: boolean;
  private readonly colorFn?: (percent: number) => number;

  // Animation state
  private readonly animated: boolean;
  private readonly animationSpeed: number;
  private readonly showGhostBar: boolean;
  private readonly ghostColor: number;
  private displayPercent: number = -1;  // -1 means uninitialized
  private targetPercent: number = 1;
  private ghostPercent: number = 1;

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
    this.hideWhenEmpty = config.hideWhenEmpty ?? false;
    this.colorFn = config.colorFn;

    // Animation config
    this.animated = config.animated ?? true;
    this.animationSpeed = config.animationSpeed ?? 8;
    this.showGhostBar = config.showGhostBar ?? false;
    this.ghostColor = config.ghostColor ?? 0xff0000;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYERS.UI_WORLD);
  }

  /**
   * Update the bar position and fill
   * @param delta Optional delta time in ms for smooth animation (pass from scene.update)
   */
  public update(x: number, y: number, current: number, max: number, delta: number = 16): void {
    // Calculate target percent
    this.targetPercent = Math.min(1, Math.max(0, current / max));

    // Initialize display percent on first update (skip animation from unknown state)
    if (this.displayPercent < 0) {
      this.displayPercent = this.targetPercent;
      this.ghostPercent = this.targetPercent;
    }

    // Auto-hide when full if configured
    if (this.hideWhenFull && this.targetPercent >= 1 && this.displayPercent >= 0.99) {
      this.graphics.setVisible(false);
      return;
    }

    // Auto-hide when empty if configured
    if (this.hideWhenEmpty && this.targetPercent <= 0 && this.displayPercent <= 0.01) {
      this.graphics.setVisible(false);
      return;
    }

    this.graphics.setVisible(true);
    this.graphics.clear();

    // Animate display percent toward target
    if (this.animated) {
      const lerpFactor = Math.min(1, this.animationSpeed * delta / 1000);
      this.displayPercent = this.lerp(this.displayPercent, this.targetPercent, lerpFactor);

      // Animate ghost bar (slower, only when decreasing)
      if (this.showGhostBar) {
        const ghostLerpFactor = Math.min(1, (this.animationSpeed * 0.3) * delta / 1000);
        this.ghostPercent = this.lerp(this.ghostPercent, this.displayPercent, ghostLerpFactor);
      }
    } else {
      this.displayPercent = this.targetPercent;
      this.ghostPercent = this.targetPercent;
    }

    const barX = x - this.width / 2;
    const barY = y + this.offsetY;

    // Background
    this.graphics.fillStyle(this.backgroundColor, 1);
    this.graphics.fillRect(barX, barY, this.width, this.height);

    // Ghost bar (trailing damage indicator) - only show when ghost > display (taking damage)
    if (this.showGhostBar && this.ghostPercent > this.displayPercent + 0.01) {
      this.graphics.fillStyle(this.ghostColor, 1);
      this.graphics.fillRect(barX, barY, this.width * this.ghostPercent, this.height);
    }

    // Main fill bar
    const fillColor = this.colorFn ? this.colorFn(this.displayPercent) : this.color;
    this.graphics.fillStyle(fillColor, 1);
    this.graphics.fillRect(barX, barY, this.width * this.displayPercent, this.height);
  }

  /**
   * Linear interpolation
   */
  private lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor;
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
