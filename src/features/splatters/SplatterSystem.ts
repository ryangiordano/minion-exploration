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
  opacity: 1.0,
  splatter: true,
  splatterCount: 0, // 0 means random 3-6
  splatterSpread: 1.5,
};

/**
 * Visual splatter system - draws goo/blood splatters on a render texture.
 * Used for enemy death effects and other messy impacts.
 */
/** Tracks an entity leaving a paint trail after crossing goo */
interface TrailState {
  color: number;
  remaining: number; // pixels of trail remaining
  lastX: number;
  lastY: number;
}

export class SplatterSystem {
  private scene: Phaser.Scene;
  private texture: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Graphics;
  private config: Required<SplatterConfig>;

  /** Track entities that picked up goo and are leaving trails */
  private trails: Map<string, TrailState> = new Map();

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
    this.brush.fillStyle(color, 0.4);
    this.brush.fillCircle(0, 0, radius * 1.3);

    // Main splatter
    this.brush.fillStyle(color, 1.0);
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
        this.brush.fillStyle(color, 0.8);
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

  /**
   * Update trail for an entity - call each frame.
   * If entity is over goo, it picks up the color.
   * If entity has picked up goo, it leaves a fading trail.
   */
  updateTrail(entityId: string, x: number, y: number, radius: number = 8): void {
    const trail = this.trails.get(entityId);

    // Check if we're over goo by sampling the texture
    const gooColor = this.sampleColor(x, y);

    if (gooColor !== null) {
      // Picked up goo - start/refresh trail
      this.trails.set(entityId, {
        color: gooColor,
        remaining: 250, // pixels of trail to leave
        lastX: x,
        lastY: y,
      });
    } else if (trail && trail.remaining > 0) {
      // Not over goo but have trail remaining - leave marks
      const dx = x - trail.lastX;
      const dy = y - trail.lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > radius * 0.5) {
        // Draw trail marks along path
        const steps = Math.ceil(distance / (radius * 0.5));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const px = trail.lastX + dx * t;
          const py = trail.lastY + dy * t;

          // Fade based on remaining trail
          const fade = trail.remaining / 250;
          const trailRadius = radius * 0.6 * fade;

          if (trailRadius > 1) {
            this.brush.clear();
            this.brush.fillStyle(trail.color, 0.5 * fade);
            this.brush.fillCircle(0, 0, trailRadius);
            this.texture.draw(this.brush, px, py);
          }
        }

        // Reduce remaining trail
        trail.remaining -= distance;
        trail.lastX = x;
        trail.lastY = y;

        if (trail.remaining <= 0) {
          this.trails.delete(entityId);
        }
      }
    }
  }

  /** Sample color at position - returns color if goo present, null otherwise */
  private sampleColor(x: number, y: number): number | null {
    // Snapshot the render texture to check pixel color
    this.texture.snapshotPixel(Math.floor(x), Math.floor(y), (snapshot) => {
      // This is async, so we cache the result
      if (snapshot instanceof Phaser.Display.Color) {
        // Only count as goo if alpha is very high (ignore trail marks which start at 0.6 opacity)
        if (snapshot.alpha > 250) {
          this.lastSampledColor = Phaser.Display.Color.GetColor(snapshot.red, snapshot.green, snapshot.blue);
        } else {
          this.lastSampledColor = null;
        }
      }
    });

    // Return cached result from previous frame (one frame delay is fine)
    return this.lastSampledColor;
  }

  private lastSampledColor: number | null = null;

  /** Clear trail state for an entity */
  clearTrail(entityId: string): void {
    this.trails.delete(entityId);
  }

  /** Clear all splatters */
  clear(): void {
    this.texture.clear();
    this.trails.clear();
    this.lastSampledColor = null;
  }

  destroy(): void {
    this.texture.destroy();
    this.brush.destroy();
  }
}
