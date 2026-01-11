import { Combatable } from '../types/interfaces';

/**
 * Interface for units that can receive XP
 */
export interface XpReceiver {
  addXp(amount: number): void;
}

/**
 * Configuration for combat XP tracking
 */
export interface CombatXpTrackerConfig {
  /** Base XP awarded per enemy kill */
  baseXpPerKill?: number;
}

/**
 * Tracks combat participation for XP distribution.
 * Records which units participated in combat with each enemy,
 * then distributes XP equally among participants when the enemy dies.
 */
export class CombatXpTracker {
  private baseXpPerKill: number;

  // Map from enemy to set of participating minions
  private participation: Map<Combatable, Set<XpReceiver>> = new Map();

  constructor(config: CombatXpTrackerConfig = {}) {
    this.baseXpPerKill = config.baseXpPerKill ?? 10;
  }

  /**
   * Record that a unit participated in combat with an enemy.
   * Call this when a unit deals damage to or receives damage from an enemy.
   */
  public recordParticipation(unit: XpReceiver, enemy: Combatable): void {
    if (!this.participation.has(enemy)) {
      this.participation.set(enemy, new Set());
    }
    this.participation.get(enemy)!.add(unit);
  }

  /**
   * Distribute XP to all participants when an enemy is defeated.
   * XP is split equally among all participants.
   * @param enemy The defeated enemy
   * @param xpOverride Optional XP value to use instead of default baseXpPerKill
   */
  public distributeXp(enemy: Combatable, xpOverride?: number): void {
    const participants = this.participation.get(enemy);
    if (!participants || participants.size === 0) {
      this.clearEnemy(enemy);
      return;
    }

    const totalXp = xpOverride ?? this.baseXpPerKill;
    const xpPerUnit = Math.floor(totalXp / participants.size);

    // Award at least 1 XP per participant
    const xpToAward = Math.max(1, xpPerUnit);

    for (const unit of participants) {
      unit.addXp(xpToAward);
    }

    this.clearEnemy(enemy);
  }

  /**
   * Clear participation records for an enemy.
   * Call this when an enemy dies or combat ends.
   */
  public clearEnemy(enemy: Combatable): void {
    this.participation.delete(enemy);
  }

  /**
   * Get the number of participants currently tracked for an enemy.
   * Useful for debugging.
   */
  public getParticipantCount(enemy: Combatable): number {
    return this.participation.get(enemy)?.size ?? 0;
  }
}
