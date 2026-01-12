import { AbilityGem, AttackHitContext } from '../types';
import { AttackConfig } from '../../types/interfaces';
import { projectileEffect } from '../effects';

export interface RangedAttackConfig {
  projectileSpeed?: number;    // Pixels per second (default: 300)
  projectileSize?: number;     // Radius of projectile (default: 4)
  projectileColor?: number;    // Color of projectile (default: 0x88ccff)
  attackRange?: number;        // Distance at which attacks can be made (default: 100)
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
    this.attackRange = config.attackRange ?? 100;
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
        onImpact: () => {
          // Apply damage when projectile hits
          context.dealDamage?.();
        },
      }
    );
  }
}
