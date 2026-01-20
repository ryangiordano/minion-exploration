import { AbilityGem, AttackHitContext } from '../types';
import { lifestealEffect } from '../effects';

export interface LifestealConfig {
  /** Percentage of damage dealt to heal (default: 0.2 = 20%) */
  ratio?: number;
}

/**
 * Attack modifier gem that heals the attacker for a percentage of damage dealt.
 */
export class LifestealGem implements AbilityGem {
  readonly id = 'lifesteal';
  readonly name = 'Vampiric Aura';
  readonly description = 'Attacks heal you';

  private readonly ratio: number;

  constructor(config: LifestealConfig = {}) {
    this.ratio = config.ratio ?? 0.2;
  }

  onAttackHit(context: AttackHitContext): void {
    const { attacker, damage, scene } = context;

    // Lifesteal only heals the attacker
    lifestealEffect(
      {
        executor: attacker,
        scene,
        triggerDamage: damage,
      },
      [attacker],
      { ratio: this.ratio }
    );
  }
}
