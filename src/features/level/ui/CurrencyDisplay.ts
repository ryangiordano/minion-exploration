import Phaser from 'phaser';

/** Essence bar configuration - must match React EssenceDisplay defaults */
const ESSENCE_CONFIG = {
  barCount: 5,
  pillCount: 10,
  essencePerPill: 5,
  maxEssence: 100, // Must match React EssenceDisplay default max
  get essencePerBar() {
    return this.pillCount * this.essencePerPill; // 50
  },
};

/** HUD position config - must match React CSS positioning */
const HUD_POSITION = {
  padding: 16,
  barWidth: 118, // 10 pills * 8px + gaps + padding
  barHeight: 16, // pill height + padding
  barGap: 2,
};

export class CurrencyDisplay {
  private currency = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Add essence, capping at max. Excess essence is lost. */
  public add(value: number): void {
    this.currency = Math.min(this.currency + value, ESSENCE_CONFIG.maxEssence);
  }

  public spend(amount: number): boolean {
    if (this.currency >= amount) {
      this.currency -= amount;
      return true;
    }
    return false;
  }

  public getAmount(): number {
    return this.currency;
  }

  public canAfford(amount: number): boolean {
    return this.currency >= amount;
  }

  /** No-op - visual feedback now handled by React */
  public pop(): void {
    // React handles visual feedback
  }

  /** Get the screen position where essence should fly to (the currently filling bar) */
  public getTargetPosition(): { x: number; y: number } {
    const camera = this.scene.cameras.main;

    // Calculate which bar is currently being filled (0-indexed)
    const currentBarIndex = Math.min(
      Math.floor(this.currency / ESSENCE_CONFIG.essencePerBar),
      ESSENCE_CONFIG.barCount - 1
    );

    // Bottom-right corner positioning (matching React CSS)
    const baseX = camera.width - HUD_POSITION.padding;
    const baseY = camera.height - HUD_POSITION.padding;

    // Calculate Y position for the current bar (bars stack from top to bottom)
    // The topmost bar (index 0) is at the top of the stack
    const barY = baseY - (ESSENCE_CONFIG.barCount - 1 - currentBarIndex) * (HUD_POSITION.barHeight + HUD_POSITION.barGap);

    return {
      x: baseX - HUD_POSITION.barWidth / 2,
      y: barY - HUD_POSITION.barHeight / 2,
    };
  }

  public destroy(): void {
    // Nothing to destroy - no Phaser objects
  }
}
