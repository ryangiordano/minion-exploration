import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface ShieldConfig {
  /** Maximum shield HP (default: 1) */
  maxHp?: number;
  /** Shield color (default: blue) */
  color?: number;
  /** Scale-in animation duration in ms (default: 300) */
  scaleInDuration?: number;
}

const DEFAULT_COLOR = 0x4488ff;
const DEFAULT_MAX_HP = 1;
const DEFAULT_SCALE_IN_DURATION = 300;

/**
 * Visual and functional shield component that can be attached to any entity.
 * Absorbs damage fully until HP is depleted, then breaks with a shatter effect.
 */
export class ShieldComponent {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private owner: { x: number; y: number; getRadius(): number };

  private currentHp: number;
  private maxHp: number;
  private color: number;
  private broken: boolean = false;
  private destroyed: boolean = false;

  /** Radius multiplier for shield size relative to owner */
  private readonly radiusMultiplier = 1.8;
  private readonly strokeWidth = 3;

  /** Pulse animation state */
  private pulseTime: number = 0;
  private readonly pulseSpeed = 0.003; // Radians per ms
  private readonly pulseAmount = 0.08; // Scale variation (±8%)

  /** Scale-in animation state */
  private scaleInProgress: number = 0;
  private isScalingIn: boolean = true;

  constructor(
    scene: Phaser.Scene,
    owner: { x: number; y: number; getRadius(): number },
    config: ShieldConfig = {}
  ) {
    this.scene = scene;
    this.owner = owner;
    this.maxHp = config.maxHp ?? DEFAULT_MAX_HP;
    this.currentHp = this.maxHp;
    this.color = config.color ?? DEFAULT_COLOR;

    // Create graphics object for shield
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYERS.EFFECTS);

    // Start scale-in animation
    this.startScaleInAnimation(config.scaleInDuration ?? DEFAULT_SCALE_IN_DURATION);
  }

  /** Check if shield is still active */
  public isActive(): boolean {
    return !this.broken && !this.destroyed && this.currentHp > 0;
  }

  /** Get current shield HP */
  public getCurrentHp(): number {
    return this.currentHp;
  }

  /**
   * Attempt to absorb damage. Returns true if damage was fully absorbed.
   * Shield breaks after absorbing damage.
   */
  public absorbDamage(amount: number): boolean {
    if (this.broken || this.destroyed || this.currentHp <= 0) {
      return false;
    }

    // Shield absorbs damage fully (regardless of amount)
    this.currentHp = Math.max(0, this.currentHp - amount);

    if (this.currentHp <= 0) {
      this.breakShield();
    }

    return true; // Damage was absorbed
  }

  /** Update shield position and animation */
  public update(delta: number = 16): void {
    if (this.broken || this.destroyed) return;

    // Update pulse animation
    this.pulseTime += delta;

    // Calculate scale based on animation state
    let scale = 1;
    if (this.isScalingIn) {
      scale = this.scaleInProgress;
    } else {
      // Pulsing animation: oscillate between 1-pulseAmount and 1+pulseAmount
      const pulseOffset = Math.sin(this.pulseTime * this.pulseSpeed) * this.pulseAmount;
      scale = 1 + pulseOffset;
    }

    this.drawShield(scale);
  }

  /** Clean up resources */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.graphics.destroy();
  }

  private startScaleInAnimation(duration: number): void {
    this.isScalingIn = true;
    this.scaleInProgress = 0;

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.ceil(duration / 16),
      callback: () => {
        if (this.destroyed) {
          timer.destroy();
          return;
        }

        this.scaleInProgress += 16 / duration;
        if (this.scaleInProgress >= 1) {
          this.scaleInProgress = 1;
          this.isScalingIn = false;
          timer.destroy();
        }

        // Ease out cubic for smooth scale-in
        const easedScale = 1 - Math.pow(1 - this.scaleInProgress, 3);
        this.drawShield(easedScale);
      },
    });
  }

  private drawShield(scale: number): void {
    if (this.destroyed) return;

    const radius = this.owner.getRadius() * this.radiusMultiplier * scale;

    this.graphics.clear();

    // Outer glow
    this.graphics.fillStyle(this.color, 0.15);
    this.graphics.fillCircle(this.owner.x, this.owner.y, radius + 4);

    // Main shield fill (semi-transparent)
    this.graphics.fillStyle(this.color, 0.3);
    this.graphics.fillCircle(this.owner.x, this.owner.y, radius);

    // Shield stroke
    this.graphics.lineStyle(this.strokeWidth, this.color, 0.8);
    this.graphics.strokeCircle(this.owner.x, this.owner.y, radius);
  }

  private breakShield(): void {
    this.broken = true;
    this.playShatterEffect();
  }

  private playShatterEffect(): void {
    const radius = this.owner.getRadius() * this.radiusMultiplier;
    const shardCount = 8;
    const duration = 400;

    // Create shard particles
    const shards: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 80 + Math.random() * 60;
      shards.push({
        x: this.owner.x + Math.cos(angle) * radius * 0.8,
        y: this.owner.y + Math.sin(angle) * radius * 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 4,
      });
    }

    let elapsed = 0;

    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.ceil(duration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(1, elapsed / duration);
        const alpha = 0.8 * (1 - progress);

        this.graphics.clear();

        // Draw shards
        for (const shard of shards) {
          shard.x += shard.vx * 0.016;
          shard.y += shard.vy * 0.016;

          this.graphics.fillStyle(this.color, alpha);
          this.graphics.fillCircle(shard.x, shard.y, shard.size * (1 - progress * 0.5));
        }

        if (progress >= 1) {
          timer.destroy();
          this.graphics.destroy();
        }
      },
    });
  }
}
