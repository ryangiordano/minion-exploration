import { AbilityGem, AttackHitContext } from '../types';
import { AttackConfig } from '../../types/interfaces';
import { projectileEffect } from '../effects';
import { ProjectileVisualType } from '../effects/types';

export interface RangedAttackConfig {
  projectileSpeed?: number;    // Pixels per second (default: 300)
  projectileSize?: number;     // Radius of projectile (default: 4)
  projectileColor?: number;    // Color of projectile (default: 0xdd66ff - pinkish purple)
  attackRange?: number;        // Distance at which attacks can be made (default: 300)
  visualType?: ProjectileVisualType; // 'pellet' or 'laser' (default: 'laser')
}

/** Pinkish-purple color for laser visuals */
const LASER_COLOR = 0xdd66ff;

/**
 * Attack modifier gem that makes attacks ranged projectiles.
 * By default fires instant laser beams with muzzle flash and particle effects.
 */
export class RangedAttackGem implements AbilityGem {
  readonly id = 'ranged_attack';
  readonly name = 'Ranged Attack Gem';
  readonly description = 'Attacks fire laser beams';

  private readonly projectileSpeed: number;
  private readonly projectileSize: number;
  private readonly projectileColor: number;
  private readonly attackRange: number;
  private readonly visualType: ProjectileVisualType;

  constructor(config: RangedAttackConfig = {}) {
    this.projectileSpeed = config.projectileSpeed ?? 300;
    this.projectileSize = config.projectileSize ?? 4;
    this.projectileColor = config.projectileColor ?? LASER_COLOR;
    this.attackRange = config.attackRange ?? 300;
    this.visualType = config.visualType ?? 'laser';
  }

  getAttackModifiers(): Partial<AttackConfig> {
    return {
      range: this.attackRange,
      effectType: 'ranged',
    };
  }

  onAttackHit(context: AttackHitContext): void {
    projectileEffect(
      {
        executor: context.attacker,
        scene: context.scene,
      },
      [context.target],
      {
        speed: this.projectileSpeed,
        size: this.projectileSize,
        color: this.projectileColor,
        visualType: this.visualType,
        // Muzzle flash: quick grow/shrink sphere at origin
        muzzleFlash: {
          color: this.projectileColor,
          maxSize: 15,
          growDuration: 40,
          shrinkDuration: 60,
        },
        // Particle burst on impact
        impactBurst: {
          count: 8,
          color: this.projectileColor,
        },
        // Laser beam settings
        laserWidth: 3,
        laserGlowSize: 8,
        onImpact: () => {
          // Apply damage when projectile hits
          context.dealDamage?.();
        },
      }
    );
  }
}
