import Phaser from 'phaser';
import { LAYERS } from '../../../core/config';

export interface EnemyProjectileConfig {
  /** Projectile speed in pixels per second */
  speed?: number;
  /** Projectile radius for collision */
  radius?: number;
  /** Color of the projectile */
  color?: number;
  /** Maximum distance before despawning */
  maxDistance?: number;
  /** Damage dealt on hit */
  damage?: number;
}

const DEFAULT_SPEED = 180;
const DEFAULT_RADIUS = 8;
const DEFAULT_COLOR = 0xffaa00;
const DEFAULT_MAX_DISTANCE = 400;
const DEFAULT_DAMAGE = 1;

/**
 * A physics-based enemy projectile that can be dodged.
 * Travels in a straight line and despawns after max distance or on hit.
 */
export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  private spawnX: number;
  private spawnY: number;
  private maxDistance: number;
  private projectileDamage: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    config: EnemyProjectileConfig = {}
  ) {
    super(scene, x, y, '');

    this.spawnX = x;
    this.spawnY = y;
    this.maxDistance = config.maxDistance ?? DEFAULT_MAX_DISTANCE;
    this.projectileDamage = config.damage ?? DEFAULT_DAMAGE;

    const speed = config.speed ?? DEFAULT_SPEED;
    const radius = config.radius ?? DEFAULT_RADIUS;
    const color = config.color ?? DEFAULT_COLOR;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create texture if needed
    const textureKey = `enemy_projectile_${radius}_${color}`;
    if (!scene.textures.exists(textureKey)) {
      const graphics = scene.add.graphics();

      // Outer glow
      graphics.fillStyle(color, 0.3);
      graphics.fillCircle(radius * 2, radius * 2, radius * 2);

      // Inner core
      graphics.fillStyle(color, 1);
      graphics.fillCircle(radius * 2, radius * 2, radius);

      // Bright center
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(radius * 2, radius * 2, radius * 0.4);

      graphics.generateTexture(textureKey, radius * 4, radius * 4);
      graphics.destroy();
    }

    this.setTexture(textureKey);
    this.setDepth(LAYERS.EFFECTS);

    // Setup physics body
    this.setCircle(radius, radius, radius);

    // Calculate velocity toward target
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    this.setVelocity(velocityX, velocityY);

    // Rotate to face direction of travel
    this.setRotation(angle);
  }

  /** Get the damage this projectile deals */
  public getDamage(): number {
    return this.projectileDamage;
  }

  /** Called when projectile hits something - destroy with effect */
  public onHit(): void {
    this.playImpactEffect();
    this.destroy();
  }

  /** Update - check for max distance despawn */
  public update(): void {
    const distance = Phaser.Math.Distance.Between(
      this.spawnX,
      this.spawnY,
      this.x,
      this.y
    );

    if (distance >= this.maxDistance) {
      this.playFizzleEffect();
      this.destroy();
    }
  }

  private playImpactEffect(): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(LAYERS.EFFECTS);

    const duration = 150;
    let elapsed = 0;

    const updateEvent = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(duration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const currentRadius = 10 + 20 * easedProgress;
        const alpha = 0.6 * (1 - progress);

        graphics.clear();
        graphics.fillStyle(0xffaa00, alpha);
        graphics.fillCircle(this.x, this.y, currentRadius);

        if (progress >= 1) {
          graphics.destroy();
          updateEvent.destroy();
        }
      },
    });
  }

  private playFizzleEffect(): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(LAYERS.EFFECTS);

    const duration = 100;
    let elapsed = 0;

    const updateEvent = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(duration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(1, elapsed / duration);
        const alpha = 0.4 * (1 - progress);

        graphics.clear();
        graphics.fillStyle(0xffaa00, alpha);
        graphics.fillCircle(this.x, this.y, 6 * (1 - progress));

        if (progress >= 1) {
          graphics.destroy();
          updateEvent.destroy();
        }
      },
    });
  }
}
