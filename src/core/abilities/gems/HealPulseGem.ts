import { AbilityGem, GemOwner } from '../types';

export interface HealPulseConfig {
  healRadius?: number;      // Range to find allies (default: 80)
  healAmount?: number;      // HP restored per heal (default: 2)
  mpCost?: number;          // MP spent per heal (default: 2)
  cooldownMs?: number;      // Cooldown between heals (default: 3000)
  hpThreshold?: number;     // Only heal allies below this % HP (default: 0.7)
}

/**
 * Active ability gem that automatically heals nearby wounded allies
 */
export class HealPulseGem implements AbilityGem {
  readonly id = 'heal_pulse';
  readonly name = 'Heal Pulse Gem';
  readonly description = 'Auto-heals nearby wounded allies';

  private readonly healRadius: number;
  private readonly healAmount: number;
  private readonly mpCost: number;
  private readonly cooldownMs: number;
  private readonly hpThreshold: number;

  private cooldownTimer: number = 0;

  constructor(config: HealPulseConfig = {}) {
    this.healRadius = config.healRadius ?? 80;
    this.healAmount = config.healAmount ?? 2;
    this.mpCost = config.mpCost ?? 2;
    this.cooldownMs = config.cooldownMs ?? 3000;
    this.hpThreshold = config.hpThreshold ?? 0.7;
  }

  onEquip(): void {
    // Reset cooldown when equipped
    this.cooldownTimer = 0;
  }

  onUpdate(owner: GemOwner, delta: number): void {
    // Update cooldown
    this.cooldownTimer -= delta;
    if (this.cooldownTimer > 0) return;

    // Check if owner has enough MP
    if (owner.getCurrentMp() < this.mpCost) return;

    // Find nearby allies (if owner supports it)
    const allies = owner.getNearbyAllies?.(this.healRadius) ?? [];
    if (allies.length === 0) return;

    // Filter to wounded allies (below HP threshold)
    const wounded = allies.filter(ally => {
      const hpPercent = ally.getCurrentHp() / ally.getMaxHp();
      return hpPercent < this.hpThreshold && hpPercent > 0; // Don't heal dead
    });

    if (wounded.length === 0) return;

    // Find the most wounded ally
    const mostWounded = wounded.reduce((a, b) => {
      const aPercent = a.getCurrentHp() / a.getMaxHp();
      const bPercent = b.getCurrentHp() / b.getMaxHp();
      return aPercent < bPercent ? a : b;
    });

    // Spend MP and heal
    if (owner.spendMp(this.mpCost)) {
      mostWounded.heal(this.healAmount);
      this.cooldownTimer = this.cooldownMs;

      // TODO: Visual effect (green particles from healer to target)
    }
  }
}
