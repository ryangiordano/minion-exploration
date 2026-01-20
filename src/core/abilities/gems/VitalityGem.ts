import { AbilityGem, StatModifier } from '../types';

/**
 * Passive gem that increases max HP by a flat amount.
 * Can be upgraded via gem mastery system later.
 */
export class VitalityGem implements AbilityGem {
  readonly id = 'vitality';
  readonly name = 'Vitality Gem';
  readonly description = '+5 Max HP';

  private readonly hpBonus: number;

  constructor(hpBonus: number = 5) {
    this.hpBonus = hpBonus;
  }

  getStatModifiers(): StatModifier[] {
    return [
      { stat: 'maxHp', type: 'flat', value: this.hpBonus }
    ];
  }
}
