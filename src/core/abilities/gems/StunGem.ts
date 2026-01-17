import { AbilityGem, AttackHitContext } from '../types';

const DEFAULT_STUN_CHANCE = 0.25; // 25% chance to stun
const DEFAULT_STUN_DURATION_MS = 2000; // 2 seconds

/**
 * Attack modifier gem that has a chance to stun enemies on hit.
 * Stunned enemies cannot move or attack for the duration.
 */
export class StunGem implements AbilityGem {
  readonly id = 'stun';
  readonly name = 'Stun Gem';
  readonly description = 'Attacks have a chance to stun enemies';

  private readonly stunChance: number;
  private readonly stunDurationMs: number;

  constructor(stunChance: number = DEFAULT_STUN_CHANCE, stunDurationMs: number = DEFAULT_STUN_DURATION_MS) {
    this.stunChance = stunChance;
    this.stunDurationMs = stunDurationMs;
  }

  onAttackHit(context: AttackHitContext): void {
    // Roll for stun chance
    if (Math.random() > this.stunChance) {
      return;
    }

    // Apply stun debuff if target supports it
    const target = context.target as { applyDebuff?: (type: 'stun' | 'slow', durationMs: number) => void };
    if (target.applyDebuff) {
      target.applyDebuff('stun', this.stunDurationMs);
    }
  }
}
