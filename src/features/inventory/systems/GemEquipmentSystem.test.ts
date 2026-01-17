import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GemEquipmentSystem, GemEquippable } from './GemEquipmentSystem';
import { InventoryState } from '../data/InventoryState';
import { AbilityGem } from '../../../core/abilities/types';

// Mock the GemRegistry used by InventoryState
vi.mock('../../upgrade', () => ({
  GemRegistry: {
    get: vi.fn((gemId: string) => {
      if (gemId === 'invalid') return null;
      return {
        createGem: () => ({
          id: gemId,
          name: `Test ${gemId}`,
          execute: vi.fn(),
        }),
      };
    }),
  },
}));

class MockTarget implements GemEquippable {
  equippedGems: AbilityGem[] = [];

  equipGem(gem: AbilityGem): void {
    this.equippedGems.push(gem);
  }
}

describe('GemEquipmentSystem', () => {
  let system: GemEquipmentSystem;
  let inventory: InventoryState;

  beforeEach(() => {
    inventory = new InventoryState();
    system = new GemEquipmentSystem({ inventory });
  });

  afterEach(() => {
    system.destroy();
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(system.isAwaitingTarget()).toBe(false);
      expect(system.getPendingGem()).toBeNull();
    });
  });

  describe('selectGem', () => {
    it('should transition to awaiting target state', () => {
      const gem = inventory.addGem('fireball');
      system.selectGem(gem);

      expect(system.isAwaitingTarget()).toBe(true);
      expect(system.getPendingGem()).toBe(gem);
    });

    it('should allow selecting a different gem while awaiting', () => {
      const gem1 = inventory.addGem('fireball');
      const gem2 = inventory.addGem('icebolt');

      system.selectGem(gem1);
      system.selectGem(gem2);

      expect(system.isAwaitingTarget()).toBe(true);
      expect(system.getPendingGem()).toBe(gem2);
    });
  });

  describe('cancel', () => {
    it('should return to idle state', () => {
      const gem = inventory.addGem('fireball');
      system.selectGem(gem);
      system.cancel();

      expect(system.isAwaitingTarget()).toBe(false);
      expect(system.getPendingGem()).toBeNull();
    });

    it('should do nothing when already idle', () => {
      expect(() => system.cancel()).not.toThrow();
      expect(system.isAwaitingTarget()).toBe(false);
    });
  });

  describe('tryEquipOn', () => {
    it('should return false when no pending gem', () => {
      const target = new MockTarget();
      const result = system.tryEquipOn(target);

      expect(result).toBe(false);
      expect(target.equippedGems).toHaveLength(0);
    });

    it('should equip gem and return true on success', () => {
      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      const result = system.tryEquipOn(target);

      expect(result).toBe(true);
      expect(target.equippedGems).toHaveLength(1);
      expect(target.equippedGems[0].id).toBe('fireball');
    });

    it('should remove gem from inventory after equipping', () => {
      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(inventory.hasGem(gem.instanceId)).toBe(false);
    });

    it('should return to idle state after equipping', () => {
      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(system.isAwaitingTarget()).toBe(false);
      expect(system.getPendingGem()).toBeNull();
    });

    it('should return false if gem was removed from inventory', () => {
      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      inventory.removeGem(gem.instanceId); // Remove before equip attempt
      const result = system.tryEquipOn(target);

      expect(result).toBe(false);
      expect(target.equippedGems).toHaveLength(0);
    });

    it('should return false if gem instance cannot be created', () => {
      const gem = inventory.addGem('invalid'); // Mock returns null for 'invalid'
      const target = new MockTarget();

      system.selectGem(gem);
      const result = system.tryEquipOn(target);

      expect(result).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onEquip callback on successful equip', () => {
      const onEquip = vi.fn();
      system = new GemEquipmentSystem({ inventory, onEquip });

      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(onEquip).toHaveBeenCalledOnce();
      expect(onEquip).toHaveBeenCalledWith(target, expect.objectContaining({ id: 'fireball' }));
    });

    it('should check canAffordEquip before equipping', () => {
      const canAffordEquip = vi.fn().mockReturnValue(false);
      system = new GemEquipmentSystem({ inventory, canAffordEquip });

      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      const result = system.tryEquipOn(target);

      expect(canAffordEquip).toHaveBeenCalledWith('fireball');
      expect(result).toBe(false);
      expect(target.equippedGems).toHaveLength(0);
    });

    it('should call spendEquipCost when equipping', () => {
      const spendEquipCost = vi.fn();
      system = new GemEquipmentSystem({ inventory, spendEquipCost });

      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(spendEquipCost).toHaveBeenCalledWith('fireball');
    });

    it('should call onCannotAfford when equip fails due to cost', () => {
      const canAffordEquip = vi.fn().mockReturnValue(false);
      const onCannotAfford = vi.fn();
      system = new GemEquipmentSystem({ inventory, canAffordEquip, onCannotAfford });

      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(onCannotAfford).toHaveBeenCalledWith('fireball');
    });

    it('should not call spendEquipCost if cannot afford', () => {
      const canAffordEquip = vi.fn().mockReturnValue(false);
      const spendEquipCost = vi.fn();
      system = new GemEquipmentSystem({ inventory, canAffordEquip, spendEquipCost });

      const gem = inventory.addGem('fireball');
      const target = new MockTarget();

      system.selectGem(gem);
      system.tryEquipOn(target);

      expect(spendEquipCost).not.toHaveBeenCalled();
    });
  });
});
