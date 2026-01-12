import { AbilityGem, AttackHitContext } from '../types';
import { knockbackEffect } from '../effects';

/**
 * Attack modifier gem that pushes enemies back on hit
 */
export class KnockbackGem implements AbilityGem {
  readonly id = 'knockback';
  readonly name = 'Knockback Gem';
  readonly description = 'Attacks push enemies back';

  private readonly knockbackDistance: number;
  private readonly knockbackDuration: number;

  constructor(knockbackDistance: number = 30, knockbackDuration: number = 100) {
    this.knockbackDistance = knockbackDistance;
    this.knockbackDuration = knockbackDuration;
  }

  onAttackHit(context: AttackHitContext): void {
    knockbackEffect(
      {
        executor: context.attacker,
        scene: context.scene,
      },
      [context.target],
      {
        distance: this.knockbackDistance,
        duration: this.knockbackDuration,
      }
    );
  }
}
