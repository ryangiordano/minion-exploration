import { AbilityGem, AbilityDefinition, AttackHitContext, CooldownInfo } from '../types';
import { healEffect } from '../effects';

export interface HealPulseConfig {
  healRadius?: number;      // Range to find allies (default: 80)
  basePower?: number;       // Base HP restored before scaling (default: 2)
  scalingRatio?: number;    // Magic stat contribution (default: 0.5, so +0.5 HP per Magic)
  mpCost?: number;          // MP spent per heal (default: 2)
  cooldownMs?: number;      // Cooldown between heals (default: 3000)
  hpThreshold?: number;     // Only heal allies below this % HP (default: 0.7)
}

/**
 * Heal pulse gem with dual behavior:
 * - Robot: Triggers on attack hit, heals all nearby allies
 * - Nanobot: Auto-triggers when allies are wounded (via getAbility)
 *
 * Formula: heal = basePower + (magic * scalingRatio)
 * Default: heal = 2 + (magic * 0.5)
 */
export class HealPulseGem implements AbilityGem {
  readonly id = 'heal_pulse';
  readonly name = 'Heal Pulse Gem';
  readonly description = 'Heals nearby allies on attack';

  private readonly healRadius: number;
  private readonly basePower: number;
  private readonly scalingRatio: number;
  private readonly mpCost: number;
  private readonly cooldownMs: number;
  private readonly hpThreshold: number;

  // Cooldown tracking for onAttackHit
  private lastTriggerTime = 0;

  constructor(config: HealPulseConfig = {}) {
    this.healRadius = config.healRadius ?? 80;
    this.basePower = config.basePower ?? 2;
    this.scalingRatio = config.scalingRatio ?? 0.5;
    this.mpCost = config.mpCost ?? 2;
    this.cooldownMs = config.cooldownMs ?? 5000;
    this.hpThreshold = config.hpThreshold ?? 0.7;
  }

  /**
   * Robot behavior: Trigger heal pulse on attack hit
   * Has cooldown and MP cost to prevent spamming
   */
  onAttackHit(context: AttackHitContext): void {
    const { attacker, scene } = context;
    const now = Date.now();

    // Check cooldown
    if (now - this.lastTriggerTime < this.cooldownMs) {
      return;
    }

    // Find all nearby allies
    const allies = attacker.getNearbyAllies?.(this.healRadius) ?? [];

    // Calculate heal power with stat scaling
    const magicStat = attacker.getStat?.('magic') ?? 0;
    const power = Math.floor(this.basePower + magicStat * this.scalingRatio);

    // Heal all nearby allies (including attacker)
    healEffect(
      { executor: attacker, scene },
      [attacker, ...allies],
      { power, pulseRadius: this.healRadius }
    );

    this.lastTriggerTime = now;
  }

  /**
   * Nanobot behavior: Auto-trigger ability when allies are wounded
   * ActionResolver handles the targeting and execution
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

  /** Get cooldown info for UI display */
  getCooldownInfo(): CooldownInfo {
    const now = Date.now();
    const elapsed = now - this.lastTriggerTime;
    const remaining = Math.max(0, this.cooldownMs - elapsed);

    return {
      remaining,
      total: this.cooldownMs,
    };
  }
}
