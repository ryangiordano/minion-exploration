import { AbilityGem, AttackHitContext } from '../types';
import { DebuffType } from '../../components';

const ROBOT_STUN_CHANCE = 0.25; // 25% chance for robot
const NANOBOT_STUN_CHANCE = 0.05; // 5% chance for nanobots
const DEFAULT_STUN_TICKS = 4; // 4 ticks = 2 seconds

/**
 * Attack modifier gem that has a chance to stun enemies on hit.
 * Stunned enemies cannot move or attack for the duration.
 * Robot has higher stun chance (25%) than nanobots (5%).
 */
export class StunGem implements AbilityGem {
  readonly id = 'stun';
  readonly name = 'Stun Gem';
  readonly description = 'Attacks have a chance to stun enemies';

  private readonly stunTicks: number;

  constructor(stunTicks: number = DEFAULT_STUN_TICKS) {
    this.stunTicks = stunTicks;
  }

  onAttackHit(context: AttackHitContext): void {
    // Different stun chance based on attacker type
    const stunChance = context.attackerType === 'robot' ? ROBOT_STUN_CHANCE : NANOBOT_STUN_CHANCE;

    // Roll for stun chance
    if (Math.random() > stunChance) {
      return;
    }

    // Apply stun debuff if target supports it
    const target = context.target as { applyDebuff?: (type: DebuffType, ticks: number) => void };
    if (target.applyDebuff) {
      target.applyDebuff('stun', this.stunTicks);
    }
  }
}
