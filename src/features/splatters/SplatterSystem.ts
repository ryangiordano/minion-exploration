import Phaser from "phaser";

/** Splatter color palette */
export const SPLATTER_COLORS = {
  brown: 0x4a3728,
  grey: 0x3a3a3a,
  darkBrown: 0x2d2018,
  murky: 0x3d3525,
  red: 0x8b0000,
  green: 0x2d5a27,
};

export interface SplatterConfig {
  /** Base opacity (0-1). Default: 0.7 */
  opacity?: number;
  /** Add random splatter dots. Default: true */
  splatter?: boolean;
  /** Number of splatter dots. Default: 3-6 random */
  splatterCount?: number;
  /** Splatter spread multiplier (1 = radius). Default: 1.5 */
  splatterSpread?: number;
}

const DEFAULT_CONFIG: Required<SplatterConfig> = {
  opacity: 0.35,
  splatter: true,
  splatterCount: 0, // 0 means random 3-6
  splatterSpread: 1.5,
};

/**
 * Visual splatter system - draws goo/blood splatters on a render texture.
 * Used for enemy death effects and other messy impacts.
 */
export class SplatterSystem {
  private scene: Phaser.Scene;
  private texture: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Graphics;
  private config: Required<SplatterConfig>;

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    depth: number = 5,
    config: SplatterConfig = {}
  ) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create splatter layer
    this.texture = scene.add.renderTexture(0, 0, worldWidth, worldHeight);
    this.texture.setOrigin(0, 0);
    this.texture.setDepth(depth);

    // Reusable brush graphic
    this.brush = scene.add.graphics();
    this.brush.setVisible(false);
  }

  /** Add a splatter at a position */
  addSplatter(
    x: number,
    y: number,
    radius: number = 15,
    color: number = SPLATTER_COLORS.brown,
    config?: SplatterConfig
  ): void {
    const cfg = { ...this.config, ...config };

    this.brush.clear();

    // Outer glow
    this.brush.fillStyle(color, cfg.opacity * 0.4);
    this.brush.fillCircle(0, 0, radius * 1.3);

    // Main splatter
    this.brush.fillStyle(color, cfg.opacity);
    this.brush.fillCircle(0, 0, radius);

    this.texture.draw(this.brush, x, y);

    // Splatter dots
    if (cfg.splatter) {
      const count = cfg.splatterCount || 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * (0.8 + Math.random() * cfg.splatterSpread);
        const dotX = x + Math.cos(angle) * dist;
        const dotY = y + Math.sin(angle) * dist;
        const dotRadius = radius * (0.1 + Math.random() * 0.2);

        this.brush.clear();
        this.brush.fillStyle(color, cfg.opacity * 0.6);
        this.brush.fillCircle(0, 0, dotRadius);
        this.texture.draw(this.brush, dotX, dotY);
      }
    }
  }

  /** Animated burst splatter - main splat with staggered outer splashes */
  addBurst(
    x: number,
    y: number,
    radius: number = 40,
    color: number = SPLATTER_COLORS.brown
  ): void {
    // Main splatter (single draw, no stacking)
    this.addSplatter(x, y, radius * 0.5, color, { splatter: false });

    // Animated outward splashes (staggered)
    const numSplats = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numSplats; i++) {
      const angle = (i / numSplats) * Math.PI * 2 + Math.random() * 0.5;
      const delay = 20 + i * 20;

      this.scene.time.delayedCall(delay, () => {
        const dist = radius * (0.3 + Math.random() * 0.4);
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        const splatRadius = radius * (0.12 + Math.random() * 0.15);
        this.addSplatter(px, py, splatRadius, color, { splatter: false });
      });
    }
  }

  /** Clear all splatters */
  clear(): void {
    this.texture.clear();
  }

  destroy(): void {
    this.texture.destroy();
    this.brush.destroy();
  }
}
