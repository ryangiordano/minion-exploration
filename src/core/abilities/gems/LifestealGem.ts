import { AbilityGem, AttackHitContext } from '../types';
import { lifestealEffect } from '../effects';

export interface LifestealConfig {
  /** Percentage of damage dealt to heal (default: 0.2 = 20%) */
  ratio?: number;
  /** Radius to find nearby allies for group heal (default: 80) */
  healRadius?: number;
}

/**
 * Attack modifier gem that heals the attacker and nearby allies
 * for a percentage of damage dealt.
 */
export class LifestealGem implements AbilityGem {
  readonly id = 'lifesteal';
  readonly name = 'Vampiric Aura';
  readonly description = 'Attacks heal you and nearby allies';

  private readonly ratio: number;
  private readonly healRadius: number;

  constructor(config: LifestealConfig = {}) {
    this.ratio = config.ratio ?? 0.2;
    this.healRadius = config.healRadius ?? 80;
  }

  onAttackHit(context: AttackHitContext): void {
    const { attacker, damage, scene } = context;

    // Get nearby allies (attacker will be included in the heal)
    const allies = attacker.getNearbyAllies?.(this.healRadius) ?? [];

    // Heal attacker + all nearby allies
    lifestealEffect(
      {
        executor: attacker,
        scene,
        triggerDamage: damage,
      },
      [attacker, ...allies],
      { ratio: this.ratio }
    );
  }
}
