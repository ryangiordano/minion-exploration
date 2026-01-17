import { AbilityGem } from '../../../core/abilities/types';
import { GemRegistry } from '../../upgrade';

/**
 * Represents a gem instance in the inventory.
 * Stores the gem ID and creates the actual AbilityGem when equipped.
 */
export interface InventoryGem {
  /** Unique instance ID for this specific gem */
  instanceId: string;
  /** Gem type ID (matches GemRegistry) */
  gemId: string;
}

/**
 * Manages the player's gem inventory.
 * Gems are stored by ID and instantiated when equipped to minions.
 */
export class InventoryState {
  private gems: InventoryGem[] = [];
  private nextInstanceId = 1;

  /** Add a gem to inventory by its type ID */
  addGem(gemId: string): InventoryGem {
    const gem: InventoryGem = {
      instanceId: `gem_${this.nextInstanceId++}`,
      gemId,
    };
    this.gems.push(gem);
    return gem;
  }

  /** Remove a gem from inventory by instance ID */
  removeGem(instanceId: string): boolean {
    const index = this.gems.findIndex(g => g.instanceId === instanceId);
    if (index === -1) return false;
    this.gems.splice(index, 1);
    return true;
  }

  /** Get all gems in inventory */
  getGems(): readonly InventoryGem[] {
    return this.gems;
  }

  /** Get gem count */
  getCount(): number {
    return this.gems.length;
  }

  /** Check if inventory has a specific gem instance */
  hasGem(instanceId: string): boolean {
    return this.gems.some(g => g.instanceId === instanceId);
  }

  /** Create an AbilityGem instance from an inventory gem */
  createGemInstance(inventoryGem: InventoryGem): AbilityGem | null {
    const entry = GemRegistry.get(inventoryGem.gemId);
    if (!entry) return null;
    return entry.createGem();
  }
}
