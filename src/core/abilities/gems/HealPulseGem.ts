import { AbilityGem, AbilityDefinition } from '../types';

export interface HealPulseConfig {
  healRadius?: number;      // Range to find allies (default: 80)
  basePower?: number;       // Base HP restored before scaling (default: 2)
  scalingRatio?: number;    // Magic stat contribution (default: 0.5, so +0.5 HP per Magic)
  mpCost?: number;          // MP spent per heal (default: 2)
  cooldownMs?: number;      // Cooldown between heals (default: 3000)
  hpThreshold?: number;     // Only heal allies below this % HP (default: 0.7)
}

/**
 * Active ability gem that automatically heals nearby wounded allies.
 * Heal amount scales with the owner's Magic stat.
 *
 * Formula: heal = basePower + (magic * scalingRatio)
 * Default: heal = 2 + (magic * 0.5)
 */
export class HealPulseGem implements AbilityGem {
  readonly id = 'heal_pulse';
  readonly name = 'Heal Pulse Gem';
  readonly description = 'Auto-heals nearby wounded allies (scales with Magic)';

  private readonly healRadius: number;
  private readonly basePower: number;
  private readonly scalingRatio: number;
  private readonly mpCost: number;
  private readonly cooldownMs: number;
  private readonly hpThreshold: number;

  constructor(config: HealPulseConfig = {}) {
    this.healRadius = config.healRadius ?? 80;
    this.basePower = config.basePower ?? 2;
    this.scalingRatio = config.scalingRatio ?? 0.5;
    this.mpCost = config.mpCost ?? 2;
    this.cooldownMs = config.cooldownMs ?? 3000;
    this.hpThreshold = config.hpThreshold ?? 0.7;
  }

  /**
   * Returns the ability definition - ActionResolver handles the behavior
   */
  getAbility(): AbilityDefinition {
    return {
      id: this.id,
      name: 'Heal Pulse',
      description: 'Restore HP to a wounded ally',
      mpCost: this.mpCost,
      cooldownMs: this.cooldownMs,
      targetType: 'ally',
      range: this.healRadius,
      effectType: 'heal',
      basePower: this.basePower,
      scalingStat: 'magic',
      scalingRatio: this.scalingRatio,
      autoTrigger: {
        condition: 'ally_wounded',
        threshold: this.hpThreshold,
      },
      effectKey: 'heal_pulse',
    };
  }
}
