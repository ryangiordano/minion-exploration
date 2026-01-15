import Phaser from 'phaser';
import { Treasure } from './objects/Treasure';

export interface EssenceDropConfig {
  /** Time between each essence spawn in ms */
  spawnInterval?: number;
  /** Duration of the arc phase in ms */
  arcDuration?: number;
  /** Duration of the roll phase in ms */
  rollDuration?: number;
  /** Delay before essence becomes collectible after settling */
  settleDelay?: number;
  /** Min/max arc height */
  arcHeight?: [number, number];
  /** Min/max horizontal distance */
  dropDistance?: [number, number];
  /** Min/max roll distance after landing */
  rollDistance?: [number, number];
}

const DEFAULT_CONFIG: Required<EssenceDropConfig> = {
  spawnInterval: 50,
  arcDuration: 300,
  rollDuration: 600,
  settleDelay: 100,
  arcHeight: [40, 80],
  dropDistance: [40, 80],
  rollDistance: [60, 120],
};

export class EssenceDropper {
  private scene: Phaser.Scene;
  private config: Required<EssenceDropConfig>;

  constructor(scene: Phaser.Scene, config: EssenceDropConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Drops essence at the given position, calls onSpawn for each treasure as it's created */
  drop(x: number, y: number, amount: number, onSpawn?: (treasure: Treasure) => void): void {
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * this.config.spawnInterval, () => {
        const treasure = this.spawnEssence(x, y);
        onSpawn?.(treasure);
      });
    }
  }

  private spawnEssence(originX: number, originY: number): Treasure {
    const treasure = new Treasure(this.scene, originX, originY);
    treasure.setCollectible(false);

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
    const landX = originX + Math.cos(angle) * dropDist;
    const landY = originY + Math.sin(angle) * dropDist;

    // Final position after roll (same direction)
    const finalX = landX + Math.cos(angle) * rollDist;
    const finalY = landY + Math.sin(angle) * rollDist;

    // Arc phase: pop up and out
    this.animateArc(treasure, originX, originY, landX, landY, arcHeight, () => {
      // Roll phase: continue in same direction with deceleration
      this.animateRoll(treasure, finalX, finalY, () => {
        // Settle phase: brief pause then become collectible
        this.scene.time.delayedCall(this.config.settleDelay, () => {
          treasure.setCollectible(true);
        });
      });
    });

    return treasure;
  }

  private animateArc(
    treasure: Treasure,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    arcHeight: number,
    onComplete: () => void
  ): void {
    const midX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - arcHeight;

    // Scale up slightly during arc for "pop" feel
    this.scene.tweens.add({
      targets: treasure,
      scaleX: 1.2,
      scaleY: 1.2,
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
        const x =
          oneMinusT * oneMinusT * startX +
          2 * oneMinusT * t * midX +
          t * t * endX;
        const y =
          oneMinusT * oneMinusT * startY +
          2 * oneMinusT * t * controlY +
          t * t * endY;

        treasure.setPosition(x, y);
      },
      onComplete,
    });
  }

  private animateRoll(
    treasure: Treasure,
    endX: number,
    endY: number,
    onComplete: () => void
  ): void {
    this.scene.tweens.add({
      targets: treasure,
      x: endX,
      y: endY,
      duration: this.config.rollDuration,
      ease: 'Cubic.out', // Deceleration feel
      onComplete,
    });
  }
}
