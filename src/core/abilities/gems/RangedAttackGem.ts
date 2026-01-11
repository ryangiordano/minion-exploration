import Phaser from 'phaser';
import { AbilityGem, AttackHitContext } from '../types';
import { AttackConfig } from '../../types/interfaces';

export interface RangedAttackConfig {
  projectileSpeed?: number;    // Pixels per second (default: 300)
  projectileSize?: number;     // Radius of projectile (default: 4)
  projectileColor?: number;    // Color of projectile (default: 0x88ccff)
  attackRange?: number;        // Distance at which attacks can be made (default: 150)
}

/**
 * Attack modifier gem that makes attacks ranged projectiles.
 * The projectile travels from attacker to target with visual effect.
 */
export class RangedAttackGem implements AbilityGem {
  readonly id = 'ranged_attack';
  readonly name = 'Ranged Attack Gem';
  readonly description = 'Attacks fire projectiles';

  private readonly projectileSpeed: number;
  private readonly projectileSize: number;
  private readonly projectileColor: number;
  private readonly attackRange: number;

  constructor(config: RangedAttackConfig = {}) {
    this.projectileSpeed = config.projectileSpeed ?? 300;
    this.projectileSize = config.projectileSize ?? 4;
    this.projectileColor = config.projectileColor ?? 0x88ccff;
    this.attackRange = config.attackRange ?? 300;
  }

  getAttackModifiers(): Partial<AttackConfig> {
    return {
      range: this.attackRange,
      effectType: 'ranged',
    };
  }

  onAttackHit(context: AttackHitContext): void {
    const { attacker, target, scene } = context;

    // Create projectile visual
    const projectile = scene.add.circle(
      attacker.x,
      attacker.y,
      this.projectileSize,
      this.projectileColor
    );

    // Add a subtle glow/trail effect
    projectile.setAlpha(0.9);

    // Calculate travel time based on distance and speed
    const distance = Phaser.Math.Distance.Between(
      attacker.x, attacker.y,
      target.x, target.y
    );
    const duration = (distance / this.projectileSpeed) * 1000;

    // Animate projectile to target
    scene.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: Math.max(50, duration), // Minimum 50ms
      ease: 'Linear',
      onComplete: () => {
        // Small impact effect
        this.createImpactEffect(scene, target.x, target.y);
        projectile.destroy();
      }
    });
  }

  private createImpactEffect(scene: Phaser.Scene, x: number, y: number): void {
    const impact = scene.add.circle(x, y, this.projectileSize * 2, this.projectileColor, 0.8);

    scene.tweens.add({
      targets: impact,
      scale: 2,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => impact.destroy()
    });
  }
}
