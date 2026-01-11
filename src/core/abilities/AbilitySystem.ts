import { AbilityGem, GemOwner, StatModifier, AttackHitContext, TakeDamageContext } from './types';
import { Combatable, AttackConfig } from '../types/interfaces';
import Phaser from 'phaser';

export interface AbilitySystemConfig {
  maxSlots?: number;  // Default: 1
}

/**
 * Manages equipped ability gems for an entity.
 * Dispatches lifecycle hooks to gems and aggregates stat modifiers.
 */
export class AbilitySystem {
  private slots: (AbilityGem | null)[];
  private owner: GemOwner;

  constructor(owner: GemOwner, config: AbilitySystemConfig = {}) {
    this.owner = owner;
    const maxSlots = config.maxSlots ?? 1;
    this.slots = new Array(maxSlots).fill(null);
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
   */
  public onAttackHit(target: Combatable, damage: number, scene: Phaser.Scene): void {
    const context: AttackHitContext = {
      attacker: this.owner,
      target,
      damage,
      scene
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
   * Update all equipped gems (for abilities that tick)
   */
  public update(delta: number): void {
    for (const gem of this.getEquippedGems()) {
      gem.onUpdate?.(this.owner, delta);
    }
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
