import { AbilityGem, StatModifier } from '../types';

/**
 * Passive gem that increases max HP by a percentage
 */
export class VitalityGem implements AbilityGem {
  readonly id = 'vitality';
  readonly name = 'Vitality Gem';
  readonly description = '+10% Max HP';

  private readonly hpBonusPercent: number;

  constructor(hpBonusPercent: number = 0.10) {
    this.hpBonusPercent = hpBonusPercent;
  }

  getStatModifiers(): StatModifier[] {
    return [
      { stat: 'maxHp', type: 'percent', value: this.hpBonusPercent }
    ];
  }
}
