import { AbilityGem, AttackHitContext } from '../types';
import { DebuffType } from '../../components';

const DEFAULT_POISON_CHANCE = 0.35; // 35% chance to poison
const DEFAULT_POISON_TICKS = 6; // 6 ticks = 3 seconds
const DEFAULT_POISON_DAMAGE = 2; // Damage per tick

export interface PoisonConfig {
  /** Chance to apply poison on hit (0-1) */
  chance?: number;
  /** Duration in ticks (1 tick = 500ms) */
  ticks?: number;
  /** Damage dealt per tick */
  damagePerTick?: number;
}

/**
 * Attack modifier gem that has a chance to poison enemies on hit.
 * Poisoned enemies take damage over time.
 */
export class PoisonGem implements AbilityGem {
  readonly id = 'poison';
  readonly name = 'Poison Gem';
  readonly description = 'Attacks have a chance to poison enemies';

  private readonly poisonChance: number;
  private readonly poisonTicks: number;
  private readonly damagePerTick: number;

  constructor(config: PoisonConfig = {}) {
    this.poisonChance = config.chance ?? DEFAULT_POISON_CHANCE;
    this.poisonTicks = config.ticks ?? DEFAULT_POISON_TICKS;
    this.damagePerTick = config.damagePerTick ?? DEFAULT_POISON_DAMAGE;
  }

  onAttackHit(context: AttackHitContext): void {
    // Roll for poison chance
    if (Math.random() > this.poisonChance) {
      return;
    }

    // Apply poison debuff if target supports it
    const target = context.target as {
      applyDebuff?: (type: DebuffType, ticks: number, onTick?: () => void) => void;
      takeDamage?: (amount: number) => void;
    };

    if (target.applyDebuff && target.takeDamage) {
      const damagePerTick = this.damagePerTick;
      target.applyDebuff('poison', this.poisonTicks, () => {
        // Deal poison damage each tick
        target.takeDamage!(damagePerTick);
      });
    }
  }
}
