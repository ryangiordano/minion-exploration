import { AbilityGem, AbilityDefinition, GemOwner, StatModifier, AttackHitContext, TakeDamageContext, AttackerType } from './types';
import { ActionResolver, ActionResolverContext } from './ActionResolver';
import { Combatable, AttackConfig } from '../types/interfaces';
import Phaser from 'phaser';

export interface AbilitySystemConfig {
  maxSlots?: number;  // Default: 1
}

/**
 * Manages equipped ability gems for an entity.
 * Dispatches lifecycle hooks to gems and aggregates stat modifiers.
 * Uses ActionResolver to handle active ability behavior.
 */
export class AbilitySystem {
  private slots: (AbilityGem | null)[];
  private owner: GemOwner;
  private actionResolver: ActionResolver;

  constructor(owner: GemOwner, config: AbilitySystemConfig = {}) {
    this.owner = owner;
    const maxSlots = config.maxSlots ?? 1;
    this.slots = new Array(maxSlots).fill(null);
    this.actionResolver = new ActionResolver();
  }

  /**
   * Equip a gem in a slot
   * @param gem The gem to equip
   * @param slot Slot index (default: first empty slot, or 0 if all full)
   * @returns true if equipped, false if no valid slot
   */
  public equipGem(gem: AbilityGem, slot?: number): boolean {
    // Find slot to use
    let targetSlot = slot;
    if (targetSlot === undefined) {
      // Find first empty slot
      const emptyIndex = this.slots.findIndex(s => s === null);
      targetSlot = emptyIndex >= 0 ? emptyIndex : 0;
    }

    // Validate slot
    if (targetSlot < 0 || targetSlot >= this.slots.length) {
      return false;
    }

    // Unequip existing gem if present
    const existing = this.slots[targetSlot];
    if (existing) {
      existing.onUnequip?.(this.owner);
    }

    // Equip new gem
    this.slots[targetSlot] = gem;
    gem.onEquip?.(this.owner);

    return true;
  }

  /**
   * Unequip a gem from a slot
   * @returns The unequipped gem, or null if slot was empty
   */
  public unequipGem(slot: number): AbilityGem | null {
    if (slot < 0 || slot >= this.slots.length) {
      return null;
    }

    const gem = this.slots[slot];
    if (gem) {
      gem.onUnequip?.(this.owner);
      this.slots[slot] = null;
    }

    return gem;
  }

  /**
   * Get all equipped gems (non-null)
   */
  public getEquippedGems(): AbilityGem[] {
    return this.slots.filter((g): g is AbilityGem => g !== null);
  }

  /**
   * Get the gem in a specific slot
   */
  public getGemInSlot(slot: number): AbilityGem | null {
    return this.slots[slot] ?? null;
  }

  /**
   * Get number of slots
   */
  public getSlotCount(): number {
    return this.slots.length;
  }

  /**
   * Dispatch onAttackHit to all equipped gems
   * @param dealDamage - For ranged attacks, call this to apply damage. Undefined for melee.
   * @param damageDeferred - Whether damage is deferred (ranged) or already applied (melee)
   * @param attackerType - Type of attacker (robot, nanobot, etc.) for gem behavior differentiation
   */
  public onAttackHit(
    target: Combatable,
    damage: number,
    scene: Phaser.Scene,
    dealDamage?: () => void,
    damageDeferred: boolean = false,
    attackerType: AttackerType = 'nanobot'
  ): void {
    const context: AttackHitContext = {
      attacker: this.owner,
      target,
      damage,
      scene,
      attackerType,
      dealDamage,
      damageDeferred,
    };

    for (const gem of this.getEquippedGems()) {
      gem.onAttackHit?.(context);
    }
  }

  /**
   * Dispatch onTakeDamage to all equipped gems
   */
  public onTakeDamage(attacker: Combatable | null, damage: number, scene: Phaser.Scene): void {
    const context: TakeDamageContext = {
      defender: this.owner,
      attacker,
      damage,
      scene
    };

    for (const gem of this.getEquippedGems()) {
      gem.onTakeDamage?.(context);
    }
  }

  /**
   * Update abilities - uses ActionResolver for getAbility() gems,
   * falls back to onUpdate() for legacy gems.
   * @returns true if an ability was executed this frame
   */
  public update(delta: number): boolean {
    return this.updateSlotRange(delta, 0, this.slots.length);
  }

  /**
   * Update abilities for a specific range of slots only.
   * Useful when some slots are for one entity (e.g., robot) and others for another (e.g., nanobots).
   * @param startSlot - First slot index (inclusive)
   * @param endSlot - Last slot index (exclusive)
   * @returns true if an ability was executed this frame
   */
  public updateSlotRange(delta: number, startSlot: number, endSlot: number): boolean {
    // Collect ability definitions from gems in the specified slot range
    const abilities: AbilityDefinition[] = [];
    const legacyGems: AbilityGem[] = [];

    for (let i = startSlot; i < endSlot && i < this.slots.length; i++) {
      const gem = this.slots[i];
      if (!gem) continue;

      const ability = gem.getAbility?.();
      if (ability) {
        abilities.push(ability);
      } else if (gem.onUpdate) {
        // Legacy gem with onUpdate - still support it
        legacyGems.push(gem);
      }
    }

    // Let ActionResolver handle new-style abilities
    let abilityUsed = false;
    if (abilities.length > 0) {
      const context: ActionResolverContext = {
        owner: this.owner,
        delta,
      };
      abilityUsed = this.actionResolver.update(context, abilities);
    }

    // Still call onUpdate for legacy gems (backwards compatibility)
    for (const gem of legacyGems) {
      gem.onUpdate?.(this.owner, delta);
    }

    return abilityUsed;
  }

  /**
   * Get the action resolver (for debugging/UI showing cooldowns)
   */
  public getActionResolver(): ActionResolver {
    return this.actionResolver;
  }

  /**
   * Aggregate all stat modifiers from equipped gems
   */
  public getStatModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = [];

    for (const gem of this.getEquippedGems()) {
      const gemModifiers = gem.getStatModifiers?.() ?? [];
      modifiers.push(...gemModifiers);
    }

    return modifiers;
  }

  /**
   * Get aggregated attack modifiers from all equipped gems.
   * Later gems override earlier ones for conflicting properties.
   */
  public getAttackModifiers(): Partial<AttackConfig> {
    let modifiers: Partial<AttackConfig> = {};

    for (const gem of this.getEquippedGems()) {
      const gemModifiers = gem.getAttackModifiers?.() ?? {};
      modifiers = { ...modifiers, ...gemModifiers };
    }

    return modifiers;
  }
}
