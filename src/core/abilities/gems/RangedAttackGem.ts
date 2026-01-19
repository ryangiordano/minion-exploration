import { AbilityGem, AttackHitContext, StatModifier } from '../types';
import { AttackConfig } from '../../types/interfaces';
import { projectileEffect } from '../effects';
import { ProjectileVisualType } from '../effects/types';

export interface RangedAttackConfig {
  projectileSpeed?: number;    // Pixels per second (default: 400)
  projectileSize?: number;     // Radius of projectile (default: 4)
  projectileColor?: number;    // Color of projectile (default: 0xdd66ff - pinkish purple)
  attackRange?: number;        // Distance at which attacks can be made (default: 150)
  visualType?: ProjectileVisualType; // 'pellet', 'laser', or 'bolt' (default: 'bolt')
}

/** Pinkish-purple color for laser visuals */
const LASER_COLOR = 0xdd66ff;

/**
 * Attack modifier gem that makes attacks ranged projectiles.
 * Fires traveling laser bolts with muzzle flash and particle effects.
 * Tradeoff: Lower durability (HP) and slower movement speed.
 */
export class RangedAttackGem implements AbilityGem {
  readonly id = 'ranged_attack';
  readonly name = 'Ranged Attack Gem';
  readonly description = 'Ranged attacks, but fragile and slow';

  private readonly projectileSpeed: number;
  private readonly projectileSize: number;
  private readonly projectileColor: number;
  private readonly attackRange: number;
  private readonly visualType: ProjectileVisualType;

  constructor(config: RangedAttackConfig = {}) {
    this.projectileSpeed = config.projectileSpeed ?? 400;
    this.projectileSize = config.projectileSize ?? 4;
    this.projectileColor = config.projectileColor ?? LASER_COLOR;
    this.attackRange = config.attackRange ?? 150;
    this.visualType = config.visualType ?? 'bolt';
  }

  getStatModifiers(): StatModifier[] {
    return [
      // Fragile - reduced max HP
      { stat: 'maxHp', type: 'flat', value: -1 },
      // Slower movement - 30% reduction
      { stat: 'moveSpeed', type: 'percent', value: -0.3 },
    ];
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
