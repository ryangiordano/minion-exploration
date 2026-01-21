import Phaser from 'phaser';

export interface WanderBehaviorConfig {
  /** Movement speed in pixels per second */
  speed: number;
  /** Minimum time to wait before picking a new direction (ms) */
  minWaitTime?: number;
  /** Maximum time to wait before picking a new direction (ms) */
  maxWaitTime?: number;
  /** Minimum distance to travel before potentially changing direction */
  minTravelDistance?: number;
  /** Maximum distance to travel in one direction */
  maxTravelDistance?: number;
}

/**
 * Simple aimless wandering behavior.
 * Picks random directions and travels short distances with pauses.
 */
export class WanderBehavior {
  private readonly speed: number;
  private readonly minWaitTime: number;
  private readonly maxWaitTime: number;
  private readonly minTravelDistance: number;
  private readonly maxTravelDistance: number;

  private isWaiting = false;
  private waitTimer = 0;
  private targetX?: number;
  private targetY?: number;
  private enabled = true;

  constructor(
    private sprite: Phaser.Physics.Arcade.Sprite,
    config: WanderBehaviorConfig
  ) {
    this.speed = config.speed;
    this.minWaitTime = config.minWaitTime ?? 500;
    this.maxWaitTime = config.maxWaitTime ?? 2000;
    this.minTravelDistance = config.minTravelDistance ?? 50;
    this.maxTravelDistance = config.maxTravelDistance ?? 150;

    // Start with a short wait before first movement
    this.startWaiting();
  }

  /** Enable or disable wandering */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /** Stop all movement immediately */
  public stop(): void {
    if (this.sprite.body) {
      this.sprite.setVelocity(0, 0);
    }
    this.targetX = undefined;
    this.targetY = undefined;
    this.isWaiting = false;
  }

  /** Update wandering - call each frame */
  public update(delta: number): void {
    if (!this.enabled) return;

    if (this.isWaiting) {
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.pickNewTarget();
      }
      return;
    }

    // Moving toward target
    if (this.targetX !== undefined && this.targetY !== undefined) {
      const distance = Phaser.Math.Distance.Between(
        this.sprite.x,
        this.sprite.y,
        this.targetX,
        this.targetY
      );

      // Arrived at target
      if (distance < 10) {
        this.stop();
        this.startWaiting();
        return;
      }

      // Continue moving toward target
      const angle = Phaser.Math.Angle.Between(
        this.sprite.x,
        this.sprite.y,
        this.targetX,
        this.targetY
      );

      if (this.sprite.body) {
        this.sprite.setVelocity(
          Math.cos(angle) * this.speed,
          Math.sin(angle) * this.speed
        );
      }
    } else {
      // No target, start waiting
      this.startWaiting();
    }
  }

  private startWaiting(): void {
    this.isWaiting = true;
    this.waitTimer = Phaser.Math.Between(this.minWaitTime, this.maxWaitTime);
    if (this.sprite.body) {
      this.sprite.setVelocity(0, 0);
    }
  }

  private pickNewTarget(): void {
    this.isWaiting = false;

    // Pick a random direction and distance
    const angle = Math.random() * Math.PI * 2;
    const distance = Phaser.Math.Between(this.minTravelDistance, this.maxTravelDistance);

    this.targetX = this.sprite.x + Math.cos(angle) * distance;
    this.targetY = this.sprite.y + Math.sin(angle) * distance;
  }
}
