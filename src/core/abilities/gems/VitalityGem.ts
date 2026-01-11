import { AbilityGem, StatModifier } from '../types';

/**
 * Passive gem that increases max HP
 */
export class VitalityGem implements AbilityGem {
  readonly id = 'vitality';
  readonly name = 'Vitality Gem';
  readonly description = '+2 Max HP';

  private readonly hpBonus: number;

  constructor(hpBonus: number = 2) {
    this.hpBonus = hpBonus;
  }

  getStatModifiers(): StatModifier[] {
    return [
      { stat: 'maxHp', type: 'flat', value: this.hpBonus }
    ];
  }
}
