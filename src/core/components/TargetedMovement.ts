import Phaser from 'phaser';

export interface TargetedMovementConfig {
  speed: number;
  arrivalDistance?: number;
  slowdownDistance?: number;
  minSpeedScale?: number;
}

export class TargetedMovement {
  private targetX?: number;
  private targetY?: number;

  private readonly speed: number;
  private readonly arrivalDistance: number;
  private readonly slowdownDistance: number;
  private readonly minSpeedScale: number;

  constructor(
    private sprite: Phaser.Physics.Arcade.Sprite,
    config: TargetedMovementConfig
  ) {
    this.speed = config.speed;
    this.arrivalDistance = config.arrivalDistance ?? 10;
    this.slowdownDistance = config.slowdownDistance ?? 80;
    this.minSpeedScale = config.minSpeedScale ?? 0.3;
  }

  /**
   * Set a target position for the sprite to move toward
   */
  public moveTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Stop all movement and clear the target
   */
  public stop(): void {
    if (this.sprite.body) {
      this.sprite.setVelocity(0, 0);
    }
    this.targetX = undefined;
    this.targetY = undefined;
  }

  /**
   * Check if currently moving toward a target
   */
  public isMoving(): boolean {
    return this.targetX !== undefined && this.targetY !== undefined;
  }

  /**
   * Get the current target position if one exists
   */
  public getTarget(): { x: number; y: number } | undefined {
    if (this.targetX !== undefined && this.targetY !== undefined) {
      return { x: this.targetX, y: this.targetY };
    }
    return undefined;
  }

  /**
   * Update movement - call this every frame
   * @returns true if arrived at target, false otherwise
   */
  public update(): boolean {
    if (this.targetX === undefined || this.targetY === undefined) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.targetX,
      this.targetY
    );

    // Check if arrived
    if (distance < this.arrivalDistance) {
      if (this.sprite.body) {
        this.sprite.setVelocity(0, 0);
      }
      this.targetX = undefined;
      this.targetY = undefined;
      return true;
    }

    // Calculate direction to target
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.targetX,
      this.targetY
    );

    // Scale speed based on distance (slow down as we approach)
    let speedScale = 1;
    if (distance < this.slowdownDistance) {
      speedScale = distance / this.slowdownDistance;
      speedScale = Math.max(speedScale, this.minSpeedScale);
    }

    // Set velocity toward target
    const currentSpeed = this.speed * speedScale;
    const velocityX = Math.cos(angle) * currentSpeed;
    const velocityY = Math.sin(angle) * currentSpeed;
    if (this.sprite.body) {
      this.sprite.setVelocity(velocityX, velocityY);
    }

    return false;
  }

  /**
   * Update the movement speed
   */
  public setSpeed(speed: number): void {
    (this as any).speed = speed;
  }

  /**
   * Get the current movement speed
   */
  public getSpeed(): number {
    return this.speed;
  }
}
