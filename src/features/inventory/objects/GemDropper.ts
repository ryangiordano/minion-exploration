import Phaser from 'phaser';
import { WorldGem } from './WorldGem';
import { GemRegistry } from '../../upgrade';

export interface GemDropConfig {
  /** Duration of the arc phase in ms */
  arcDuration?: number;
  /** Duration of the roll phase in ms */
  rollDuration?: number;
  /** Delay before gem becomes collectible after settling */
  settleDelay?: number;
  /** Min/max arc height */
  arcHeight?: [number, number];
  /** Min/max horizontal distance */
  dropDistance?: [number, number];
  /** Min/max roll distance after landing */
  rollDistance?: [number, number];
}

const DEFAULT_CONFIG: Required<GemDropConfig> = {
  arcDuration: 350,
  rollDuration: 500,
  settleDelay: 150,
  arcHeight: [50, 90],
  dropDistance: [30, 60],
  rollDistance: [40, 80],
};

/**
 * Handles dropping gems in the world with a satisfying arc animation.
 * Similar to EssenceDropper but for ability gems.
 */
export class GemDropper {
  private scene: Phaser.Scene;
  private config: Required<GemDropConfig>;

  constructor(scene: Phaser.Scene, config: GemDropConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Drop a random gem at the given position */
  dropRandom(x: number, y: number, onSpawn?: (gem: WorldGem) => void): WorldGem | null {
    const entries = GemRegistry.getAll();
    if (entries.length === 0) return null;

    const randomEntry = entries[Math.floor(Math.random() * entries.length)];
    return this.drop(x, y, randomEntry.id, onSpawn);
  }

  /** Drop a specific gem type at the given position */
  drop(x: number, y: number, gemId: string, onSpawn?: (gem: WorldGem) => void): WorldGem {
    const gem = new WorldGem(this.scene, x, y, gemId);
    gem.setCollectible(false);

    // Random direction and distances
    const angle = Math.random() * Math.PI * 2;
    const dropDist = Phaser.Math.Between(
      this.config.dropDistance[0],
      this.config.dropDistance[1]
    );
    const rollDist = Phaser.Math.Between(
      this.config.rollDistance[0],
      this.config.rollDistance[1]
    );
    const arcHeight = Phaser.Math.Between(
      this.config.arcHeight[0],
      this.config.arcHeight[1]
    );

    // Landing position after arc
    const landX = x + Math.cos(angle) * dropDist;
    const landY = y + Math.sin(angle) * dropDist;

    // Final position after roll
    const finalX = landX + Math.cos(angle) * rollDist;
    const finalY = landY + Math.sin(angle) * rollDist;

    // Arc phase
    this.animateArc(gem, x, y, landX, landY, arcHeight, () => {
      // Roll phase
      this.animateRoll(gem, finalX, finalY, () => {
        // Settle phase
        this.scene.time.delayedCall(this.config.settleDelay, () => {
          gem.setCollectible(true);
        });
      });
    });

    onSpawn?.(gem);
    return gem;
  }

  private animateArc(
    gem: WorldGem,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    arcHeight: number,
    onComplete: () => void
  ): void {
    const midX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - arcHeight;

    // Scale up during arc for "pop" feel
    this.scene.tweens.add({
      targets: gem,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: this.config.arcDuration * 0.3,
      yoyo: true,
      ease: 'Sine.out',
    });

    // Position along bezier curve
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: this.config.arcDuration,
      ease: 'Sine.out',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const oneMinusT = 1 - t;

        // Quadratic bezier
        const newX =
          oneMinusT * oneMinusT * startX +
          2 * oneMinusT * t * midX +
          t * t * endX;
        const newY =
          oneMinusT * oneMinusT * startY +
          2 * oneMinusT * t * controlY +
          t * t * endY;

        gem.setPosition(newX, newY);
      },
      onComplete,
    });
  }

  private animateRoll(
    gem: WorldGem,
    endX: number,
    endY: number,
    onComplete: () => void
  ): void {
    this.scene.tweens.add({
      targets: gem,
      x: endX,
      y: endY,
      duration: this.config.rollDuration,
      ease: 'Cubic.out',
      onComplete,
    });
  }
}
