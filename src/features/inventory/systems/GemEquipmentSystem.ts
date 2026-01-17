import { createActor, Actor } from 'xstate';
import { gemEquipmentMachine, GemEquipmentEvent } from './gemEquipmentMachine';
import { InventoryGem, InventoryState } from '../data/InventoryState';
import { AbilityGem } from '../../../core/abilities/types';

/** Interface for entities that can have gems equipped */
export interface GemEquippable {
  equipGem(gem: AbilityGem): void;
}

export interface GemEquipmentSystemConfig {
  inventory: InventoryState;
  /** Called when a gem is successfully equipped */
  onEquip?: (target: GemEquippable, gem: AbilityGem) => void;
}

/**
 * Manages the gem equipment flow:
 * 1. User selects a gem from inventory
 * 2. System enters "awaiting target" state
 * 3. User clicks on a minion
 * 4. Gem is equipped and removed from inventory
 */
export class GemEquipmentSystem {
  private actor: Actor<typeof gemEquipmentMachine>;
  private inventory: InventoryState;
  private onEquipCallback?: (target: GemEquippable, gem: AbilityGem) => void;

  constructor(config: GemEquipmentSystemConfig) {
    this.inventory = config.inventory;
    this.onEquipCallback = config.onEquip;
    this.actor = createActor(gemEquipmentMachine);
    this.actor.start();
  }

  /** Select a gem for equipment (transitions to awaiting target state) */
  selectGem(gem: InventoryGem): void {
    this.actor.send({ type: 'SELECT_GEM', gem });
  }

  /** Cancel the current equipment operation */
  cancel(): void {
    this.actor.send({ type: 'CANCEL' });
  }

  /** Check if currently awaiting a target for equipment */
  isAwaitingTarget(): boolean {
    return this.actor.getSnapshot().value === 'awaitingTarget';
  }

  /** Get the currently pending gem (if any) */
  getPendingGem(): InventoryGem | null {
    return this.actor.getSnapshot().context.pendingGem;
  }

  /**
   * Attempt to equip the pending gem on a target.
   * Returns true if successful, false if no pending gem or gem not in inventory.
   */
  tryEquipOn(target: GemEquippable): boolean {
    const pendingGem = this.getPendingGem();
    if (!pendingGem) return false;

    // Verify gem is still in inventory
    if (!this.inventory.hasGem(pendingGem.instanceId)) {
      this.cancel();
      return false;
    }

    // Create the ability gem instance
    const abilityGem = this.inventory.createGemInstance(pendingGem);
    if (!abilityGem) {
      this.cancel();
      return false;
    }

    // Remove from inventory and equip
    this.inventory.removeGem(pendingGem.instanceId);
    target.equipGem(abilityGem);

    // Notify and complete
    this.onEquipCallback?.(target, abilityGem);
    this.actor.send({ type: 'EQUIP_COMPLETE' });

    return true;
  }

  /** Send an event directly to the state machine */
  send(event: GemEquipmentEvent): void {
    this.actor.send(event);
  }

  /** Clean up the actor */
  destroy(): void {
    this.actor.stop();
  }
}
