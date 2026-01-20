import Phaser from 'phaser';
import { Treasure, EssenceDenomination } from './objects/Treasure';
import { LAYERS } from '../../core/config';

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
  /** Min/max rotation in radians during drop */
  rotation?: [number, number];
}

const DEFAULT_CONFIG: Required<EssenceDropConfig> = {
  spawnInterval: 50,
  arcDuration: 300,
  rollDuration: 600,
  settleDelay: 100,
  arcHeight: [20, 40],
  dropDistance: [15, 35],
  rollDistance: [20, 40],
  rotation: [Math.PI, Math.PI * 3],
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
    // Convert amount to mixed denominations for variety
    const denominations = this.convertToDenominations(amount);

    let delay = 0;
    for (const denom of denominations) {
      this.scene.time.delayedCall(delay, () => {
        const treasure = this.spawnEssence(x, y, denom);
        onSpawn?.(treasure);
      });
      delay += this.config.spawnInterval;
    }
  }

  /** Convert a total value into mixed denominations for visual variety */
  private convertToDenominations(total: number): EssenceDenomination[] {
    const result: EssenceDenomination[] = [];
    let remaining = total;

    // Use 10s for larger amounts
    while (remaining >= 10 && result.length < 2) {
      result.push(10);
      remaining -= 10;
    }

    // Use 5s
    while (remaining >= 5 && result.length < 4) {
      result.push(5);
      remaining -= 5;
    }

    // Fill rest with 1s
    while (remaining > 0) {
      result.push(1);
      remaining -= 1;
    }

    // Shuffle for visual variety
    return result.sort(() => Math.random() - 0.5);
  }

  private spawnEssence(originX: number, originY: number, denomination: EssenceDenomination = 1): Treasure {
    const treasure = new Treasure(this.scene, originX, originY, denomination);
    treasure.setCollectible(false);

    // Start above entities while flying through the air
    treasure.setDepth(LAYERS.EFFECTS);

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

    // Random rotation amount and direction
    const rotationAmount = Phaser.Math.FloatBetween(
      this.config.rotation[0],
      this.config.rotation[1]
    );
    const rotationDirection = Math.random() < 0.5 ? 1 : -1;
    const totalRotation = rotationAmount * rotationDirection;

    // Rotation tween - spins during arc and roll, then settles
    const totalDuration = this.config.arcDuration + this.config.rollDuration;
    this.scene.tweens.add({
      targets: treasure,
      rotation: totalRotation,
      duration: totalDuration,
      ease: 'Cubic.out',
    });

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

    // Random peak scale for variety (some pop big, some small)
    const peakScale = Phaser.Math.FloatBetween(1.1, 1.4);
    const finalScale = Phaser.Math.FloatBetween(0.85, 1.0);

    // Scale up during arc (exploding up)
    this.scene.tweens.add({
      targets: treasure,
      scaleX: peakScale,
      scaleY: peakScale,
      duration: this.config.arcDuration * 0.5,
      ease: 'Quad.out',
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
      onComplete: () => {
        // Move below entities now that it's on the ground
        treasure.setDepth(LAYERS.GROUND);

        // Scale down as it lands (settling to ground)
        this.scene.tweens.add({
          targets: treasure,
          scaleX: finalScale,
          scaleY: finalScale,
          duration: this.config.rollDuration * 0.6,
          ease: 'Bounce.out',
        });
        onComplete();
      },
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
