import { AbilityDefinition, GemOwner } from './types';
import { Combatable } from '../types/interfaces';
import { GameEvents, DamageEvent } from '../components/GameEventManager';
import { healEffect } from './effects';

/**
 * Context provided to ActionResolver each frame
 */
export interface ActionResolverContext {
  owner: GemOwner;
  delta: number;
}

/**
 * Result of evaluating an ability
 */
interface AbilityEvaluation {
  canUse: boolean;
  target: GemOwner | Combatable | null;
  priority: number;  // Higher = more urgent
}

/**
 * Handles the behavior logic for when and how to use abilities.
 * Separates decision-making from ability definitions (which are pure data).
 */
export class ActionResolver {
  private cooldowns: Map<string, number> = new Map();

  /**
   * Update cooldowns and evaluate/execute abilities.
   * @returns true if an ability was used this frame
   */
  public update(context: ActionResolverContext, abilities: AbilityDefinition[]): boolean {
    const { delta } = context;

    // Update all cooldowns
    for (const [id, remaining] of this.cooldowns.entries()) {
      const newRemaining = remaining - delta;
      if (newRemaining <= 0) {
        this.cooldowns.delete(id);
      } else {
        this.cooldowns.set(id, newRemaining);
      }
    }

    // Evaluate each ability
    const evaluations: Array<{ ability: AbilityDefinition; eval: AbilityEvaluation }> = [];

    for (const ability of abilities) {
      const evaluation = this.evaluateAbility(ability, context);
      if (evaluation.canUse) {
        evaluations.push({ ability, eval: evaluation });
      }
    }

    // Sort by priority (highest first) and execute the best one
    if (evaluations.length > 0) {
      evaluations.sort((a, b) => b.eval.priority - a.eval.priority);
      const best = evaluations[0];
      this.executeAbility(best.ability, context.owner, best.eval.target);
      return true;
    }

    return false;
  }

  /**
   * Check if an ability is on cooldown
   */
  public isOnCooldown(abilityId: string): boolean {
    return this.cooldowns.has(abilityId);
  }

  /**
   * Get remaining cooldown time for an ability
   */
  public getCooldownRemaining(abilityId: string): number {
    return this.cooldowns.get(abilityId) ?? 0;
  }

  /**
   * Evaluate whether an ability can be used and find its target
   */
  private evaluateAbility(ability: AbilityDefinition, context: ActionResolverContext): AbilityEvaluation {
    const { owner } = context;
    const noUse: AbilityEvaluation = { canUse: false, target: null, priority: 0 };

    // Check cooldown
    if (this.cooldowns.has(ability.id)) {
      return noUse;
    }

    // Check MP cost
    if (owner.getCurrentMp() < ability.mpCost) {
      return noUse;
    }

    // Find target based on ability type
    const targetResult = this.findTarget(ability, context);
    if (!targetResult.target && ability.targetType !== 'self') {
      return noUse;
    }

    // Check auto-trigger conditions
    if (ability.autoTrigger) {
      if (!this.checkTriggerCondition(ability, context, targetResult.target)) {
        return noUse;
      }
    }

    return {
      canUse: true,
      target: targetResult.target,
      priority: targetResult.priority,
    };
  }

  /**
   * Find a valid target for the ability
   */
  private findTarget(
    ability: AbilityDefinition,
    context: ActionResolverContext
  ): { target: GemOwner | Combatable | null; priority: number } {
    const { owner } = context;

    switch (ability.targetType) {
      case 'self':
        return { target: owner, priority: this.calculateSelfPriority(ability, owner) };

      case 'ally': {
        const allies = owner.getNearbyAllies?.(ability.range) ?? [];
        const validAlly = this.findBestAlly(ability, allies);
        return validAlly;
      }

      case 'enemy': {
        const enemies = owner.getNearbyEnemies?.(ability.range) ?? [];
        const validEnemy = this.findBestEnemy(ability, enemies);
        return validEnemy;
      }

      case 'area_allies': {
        // For area heals, we just need any ally in range
        const allies = owner.getNearbyAllies?.(ability.range) ?? [];
        if (allies.length > 0) {
          const priority = this.calculateAreaAllyPriority(ability, allies);
          return { target: allies[0], priority };
        }
        return { target: null, priority: 0 };
      }

      case 'area_enemies': {
        const enemies = owner.getNearbyEnemies?.(ability.range) ?? [];
        if (enemies.length > 0) {
          return { target: enemies[0], priority: enemies.length * 10 };
        }
        return { target: null, priority: 0 };
      }

      default:
        return { target: null, priority: 0 };
    }
  }

  /**
   * Find the best ally target (most wounded for heals)
   */
  private findBestAlly(
    ability: AbilityDefinition,
    allies: GemOwner[]
  ): { target: GemOwner | null; priority: number } {
    if (allies.length === 0) {
      return { target: null, priority: 0 };
    }

    // For heal abilities, find the most wounded ally below threshold
    if (ability.effectType === 'heal' && ability.autoTrigger?.threshold) {
      const threshold = ability.autoTrigger.threshold;
      const wounded = allies
        .filter(ally => {
          const hpPercent = ally.getCurrentHp() / ally.getMaxHp();
          return hpPercent < threshold && hpPercent > 0;
        })
        .sort((a, b) => {
          const aPercent = a.getCurrentHp() / a.getMaxHp();
          const bPercent = b.getCurrentHp() / b.getMaxHp();
          return aPercent - bPercent;  // Most wounded first
        });

      if (wounded.length > 0) {
        const mostWounded = wounded[0];
        const hpPercent = mostWounded.getCurrentHp() / mostWounded.getMaxHp();
        // Priority increases as HP gets lower
        const priority = Math.floor((1 - hpPercent) * 100);
        return { target: mostWounded, priority };
      }
      return { target: null, priority: 0 };
    }

    // For buff abilities, just pick nearest
    return { target: allies[0], priority: 10 };
  }

  /**
   * Find the best enemy target
   */
  private findBestEnemy(
    ability: AbilityDefinition,
    enemies: Combatable[]
  ): { target: Combatable | null; priority: number } {
    if (enemies.length === 0) {
      return { target: null, priority: 0 };
    }

    // For damage abilities, prefer low HP targets
    if (ability.effectType === 'damage') {
      const sorted = [...enemies].sort((a, b) => a.getCurrentHp() - b.getCurrentHp());
      const lowestHp = sorted[0];
      // Priority based on how close to death
      const priority = Math.floor((1 - lowestHp.getCurrentHp() / lowestHp.getMaxHp()) * 50);
      return { target: lowestHp, priority };
    }

    return { target: enemies[0], priority: 10 };
  }

  /**
   * Calculate priority for self-targeting abilities
   */
  private calculateSelfPriority(ability: AbilityDefinition, owner: GemOwner): number {
    if (ability.effectType === 'heal') {
      const hpPercent = owner.getCurrentHp() / owner.getMaxHp();
      if (ability.autoTrigger?.threshold && hpPercent >= ability.autoTrigger.threshold) {
        return 0;  // Don't self-heal if above threshold
      }
      return Math.floor((1 - hpPercent) * 100);
    }
    return 10;
  }

  /**
   * Calculate priority for area ally abilities
   */
  private calculateAreaAllyPriority(ability: AbilityDefinition, allies: GemOwner[]): number {
    if (ability.effectType === 'heal' && ability.autoTrigger?.threshold) {
      const threshold = ability.autoTrigger.threshold;
      const woundedCount = allies.filter(a => a.getCurrentHp() / a.getMaxHp() < threshold).length;
      return woundedCount * 20;
    }
    return allies.length * 10;
  }

  /**
   * Check if auto-trigger conditions are met
   */
  private checkTriggerCondition(
    ability: AbilityDefinition,
    context: ActionResolverContext,
    target: GemOwner | Combatable | null
  ): boolean {
    const trigger = ability.autoTrigger;
    if (!trigger) return true;

    const { owner } = context;

    switch (trigger.condition) {
      case 'always':
        return true;

      case 'ally_wounded':
        // Already checked in findTarget for heal abilities
        return target !== null;

      case 'enemy_in_range':
        return target !== null;

      case 'self_wounded': {
        const threshold = trigger.threshold ?? 0.5;
        const hpPercent = owner.getCurrentHp() / owner.getMaxHp();
        return hpPercent < threshold;
      }

      default:
        return false;
    }
  }

  /**
   * Execute an ability on the target
   */
  private executeAbility(
    ability: AbilityDefinition,
    owner: GemOwner,
    target: GemOwner | Combatable | null
  ): void {
    // Spend MP
    if (!owner.spendMp(ability.mpCost)) {
      return;  // Shouldn't happen if we checked properly, but safety first
    }

    // Calculate effect power with stat scaling
    let power = ability.basePower;
    if (ability.scalingStat && ability.scalingRatio) {
      const statValue = owner.getStat?.(ability.scalingStat) ?? 0;
      power += statValue * ability.scalingRatio;
    }
    power = Math.floor(power);

    const scene = owner.getScene();

    // Apply effect
    switch (ability.effectType) {
      case 'heal':
        if (target) {
          healEffect(
            { executor: owner, scene },
            [target],
            { power, pulseRadius: ability.range }
          );
        }
        break;

      case 'damage':
        if (target && 'takeDamage' in target && typeof target.takeDamage === 'function') {
          target.takeDamage(power);
          // Emit damage event for floating text
          scene.events.emit(GameEvents.DAMAGE, {
            x: target.x,
            y: target.y,
            amount: power,
          } as DamageEvent);
        }
        break;

      case 'buff':
      case 'debuff':
        // TODO: Implement buff/debuff system
        break;
    }

    // Set cooldown
    this.cooldowns.set(ability.id, ability.cooldownMs);
  }

}
