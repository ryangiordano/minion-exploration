import { Combatable, CombatableWithAttackers } from '../types/interfaces';

/**
 * Centralized combat coordination manager.
 * Handles registration of attackers/defenders without tight coupling.
 */
export class CombatManager {
  // Maps combatants to their current targets
  private combatRelations: Map<Combatable, Combatable> = new Map();

  // Tracks which entities are being attacked and by whom
  private attackersMap: Map<Combatable, Set<Combatable>> = new Map();

  /**
   * Register a combat relationship between attacker and target.
   * The attacker will attack the target, and the target may fight back.
   */
  public startCombat(attacker: Combatable, target: Combatable): void {
    // Store the relationship
    this.combatRelations.set(attacker, target);

    // Track attacker on target
    if (!this.attackersMap.has(target)) {
      this.attackersMap.set(target, new Set());
    }
    this.attackersMap.get(target)!.add(attacker);

    // Notify target if it supports attacker tracking (for fighting back)
    if (this.supportsFightBack(target)) {
      (target as CombatableWithAttackers).addAttacker(attacker);
    }
  }

  /**
   * End combat for an attacker.
   * Called when attacker receives new command or target is defeated.
   */
  public endCombat(attacker: Combatable): void {
    const target = this.combatRelations.get(attacker);
    if (!target) return;

    // Remove from tracking
    this.combatRelations.delete(attacker);
    this.attackersMap.get(target)?.delete(attacker);

    // Notify target
    if (this.supportsFightBack(target)) {
      (target as CombatableWithAttackers).removeAttacker(attacker);
    }
  }

  /**
   * Get the current combat target for an attacker
   */
  public getTarget(attacker: Combatable): Combatable | undefined {
    return this.combatRelations.get(attacker);
  }

  /**
   * Get all attackers currently targeting an entity
   */
  public getAttackers(target: Combatable): Combatable[] {
    return Array.from(this.attackersMap.get(target) ?? []);
  }

  /**
   * Check if an entity is currently in combat (as attacker)
   */
  public isInCombat(attacker: Combatable): boolean {
    return this.combatRelations.has(attacker);
  }

  /**
   * Check if an entity is being attacked
   */
  public isUnderAttack(target: Combatable): boolean {
    const attackers = this.attackersMap.get(target);
    return attackers !== undefined && attackers.size > 0;
  }

  /**
   * Clean up all combat relations involving a defeated entity
   */
  public handleDefeat(defeated: Combatable): void {
    // End combat for all attackers targeting this entity
    const attackers = this.getAttackers(defeated);
    for (const attacker of attackers) {
      this.combatRelations.delete(attacker);
    }
    this.attackersMap.delete(defeated);

    // If defeated was attacking something, end that too
    this.endCombat(defeated);
  }

  /**
   * Check if target supports fighting back
   */
  private supportsFightBack(target: Combatable): boolean {
    return 'addAttacker' in target &&
           typeof (target as CombatableWithAttackers).addAttacker === 'function';
  }
}
