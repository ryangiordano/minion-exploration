import Phaser from 'phaser';
import { StatBar } from './StatBar';

// Default bar colors
const COLORS = {
  HP: 0x00ff00,      // Green
  MP: 0x4488ff,      // Blue
  XP: 0xffcc00,      // Yellow/Gold
};

export interface UnitStatBarsConfig {
  width?: number;
  barHeight?: number;
  offsetY?: number;   // Offset from entity center to top of first bar
  showMp?: boolean;   // Whether to show MP bar (default: true)
  showXp?: boolean;   // Whether to show XP bar (default: true)
}

/**
 * Composite component that manages HP, MP, and XP bars for any unit.
 * Bars are stacked vertically, flush against each other.
 * Order (top to bottom): HP, MP, XP
 */
export class UnitStatBars {
  private hpBar: StatBar;
  private mpBar?: StatBar;
  private xpBar?: StatBar;

  private readonly barHeight: number;
  private readonly offsetY: number;
  private readonly showMp: boolean;
  private readonly showXp: boolean;

  constructor(scene: Phaser.Scene, config: UnitStatBarsConfig = {}) {
    const width = config.width ?? 20;
    this.barHeight = config.barHeight ?? 3;
    this.offsetY = config.offsetY ?? -16;
    this.showMp = config.showMp ?? true;
    this.showXp = config.showXp ?? true;

    // Calculate offsets for each bar (stacked vertically)
    let currentOffset = this.offsetY;

    this.hpBar = new StatBar(scene, {
      width,
      height: this.barHeight,
      offsetY: currentOffset,
      color: COLORS.HP,
      hideWhenFull: true,
    });
    currentOffset += this.barHeight;

    if (this.showMp) {
      this.mpBar = new StatBar(scene, {
        width,
        height: this.barHeight,
        offsetY: currentOffset,
        color: COLORS.MP,
        hideWhenFull: true,
      });
      currentOffset += this.barHeight;
    }

    if (this.showXp) {
      this.xpBar = new StatBar(scene, {
        width,
        height: this.barHeight,
        offsetY: currentOffset,
        color: COLORS.XP,
        hideWhenFull: false, // Always show XP progress
      });
    }
  }

  /**
   * Update all bars with current values
   */
  public update(
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    mp: number,
    maxMp: number,
    xp: number,
    xpToNext: number
  ): void {
    this.hpBar.update(x, y, hp, maxHp);
    this.mpBar?.update(x, y, mp, maxMp);
    this.xpBar?.update(x, y, xp, xpToNext);
  }

  /**
   * Update HP only (for units without MP/XP)
   */
  public updateHpOnly(x: number, y: number, hp: number, maxHp: number): void {
    this.hpBar.update(x, y, hp, maxHp);
  }

  public destroy(): void {
    this.hpBar.destroy();
    this.mpBar?.destroy();
    this.xpBar?.destroy();
  }
}
