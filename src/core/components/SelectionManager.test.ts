import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from './SelectionManager';
import { Selectable } from '../types/interfaces';

// Mock Selectable implementation for testing
class MockSelectable implements Selectable {
  private _selected = false;

  select(): void {
    this._selected = true;
  }

  deselect(): void {
    this._selected = false;
  }

  isSelected(): boolean {
    return this._selected;
  }
}

describe('SelectionManager', () => {
  let manager: SelectionManager;
  let unit1: MockSelectable;
  let unit2: MockSelectable;
  let unit3: MockSelectable;

  beforeEach(() => {
    manager = new SelectionManager();
    unit1 = new MockSelectable();
    unit2 = new MockSelectable();
    unit3 = new MockSelectable();
  });

  describe('select', () => {
    it('should select a single unit', () => {
      manager.select(unit1);

      expect(unit1.isSelected()).toBe(true);
      expect(manager.getSelected()).toEqual([unit1]);
      expect(manager.hasSelection()).toBe(true);
      expect(manager.getSelectionCount()).toBe(1);
    });

    it('should clear previous selection when selecting a new unit', () => {
      manager.select(unit1);
      manager.select(unit2);

      expect(unit1.isSelected()).toBe(false);
      expect(unit2.isSelected()).toBe(true);
      expect(manager.getSelected()).toEqual([unit2]);
      expect(manager.getSelectionCount()).toBe(1);
    });
  });

  describe('addToSelection', () => {
    it('should add a unit to existing selection', () => {
      manager.select(unit1);
      manager.addToSelection(unit2);

      expect(unit1.isSelected()).toBe(true);
      expect(unit2.isSelected()).toBe(true);
      expect(manager.getSelected()).toContain(unit1);
      expect(manager.getSelected()).toContain(unit2);
      expect(manager.getSelectionCount()).toBe(2);
    });

    it('should not duplicate units in selection', () => {
      manager.addToSelection(unit1);
      manager.addToSelection(unit1);

      expect(manager.getSelectionCount()).toBe(1);
    });
  });

  describe('removeFromSelection', () => {
    it('should remove a unit from selection', () => {
      manager.select(unit1);
      manager.addToSelection(unit2);
      manager.removeFromSelection(unit1);

      expect(unit1.isSelected()).toBe(false);
      expect(unit2.isSelected()).toBe(true);
      expect(manager.getSelected()).toEqual([unit2]);
      expect(manager.getSelectionCount()).toBe(1);
    });

    it('should do nothing if unit is not selected', () => {
      manager.select(unit1);
      manager.removeFromSelection(unit2);

      expect(manager.getSelected()).toEqual([unit1]);
      expect(manager.getSelectionCount()).toBe(1);
    });
  });

  describe('toggleSelection', () => {
    it('should add unit if not selected', () => {
      manager.toggleSelection(unit1);

      expect(unit1.isSelected()).toBe(true);
      expect(manager.getSelected()).toContain(unit1);
    });

    it('should remove unit if already selected', () => {
      manager.select(unit1);
      manager.toggleSelection(unit1);

      expect(unit1.isSelected()).toBe(false);
      expect(manager.getSelected()).not.toContain(unit1);
      expect(manager.hasSelection()).toBe(false);
    });

    it('should support multi-select toggling', () => {
      manager.toggleSelection(unit1);
      manager.toggleSelection(unit2);
      manager.toggleSelection(unit3);

      expect(manager.getSelectionCount()).toBe(3);

      manager.toggleSelection(unit2);

      expect(manager.getSelectionCount()).toBe(2);
      expect(manager.getSelected()).toContain(unit1);
      expect(manager.getSelected()).toContain(unit3);
      expect(manager.getSelected()).not.toContain(unit2);
    });
  });

  describe('selectMultiple', () => {
    it('should select multiple units at once', () => {
      const units = [unit1, unit2, unit3];
      manager.selectMultiple(units);

      expect(unit1.isSelected()).toBe(true);
      expect(unit2.isSelected()).toBe(true);
      expect(unit3.isSelected()).toBe(true);
      expect(manager.getSelectionCount()).toBe(3);
    });

    it('should clear previous selection', () => {
      manager.select(unit1);
      manager.selectMultiple([unit2, unit3]);

      expect(unit1.isSelected()).toBe(false);
      expect(manager.getSelectionCount()).toBe(2);
      expect(manager.getSelected()).toContain(unit2);
      expect(manager.getSelected()).toContain(unit3);
    });
  });

  describe('clearSelection', () => {
    it('should deselect all units', () => {
      manager.selectMultiple([unit1, unit2, unit3]);
      manager.clearSelection();

      expect(unit1.isSelected()).toBe(false);
      expect(unit2.isSelected()).toBe(false);
      expect(unit3.isSelected()).toBe(false);
      expect(manager.hasSelection()).toBe(false);
      expect(manager.getSelectionCount()).toBe(0);
      expect(manager.getSelected()).toEqual([]);
    });

    it('should work when no units are selected', () => {
      expect(() => manager.clearSelection()).not.toThrow();
      expect(manager.hasSelection()).toBe(false);
    });
  });

  describe('hasSelection', () => {
    it('should return false when no units selected', () => {
      expect(manager.hasSelection()).toBe(false);
    });

    it('should return true when units are selected', () => {
      manager.select(unit1);
      expect(manager.hasSelection()).toBe(true);
    });
  });

  describe('getSelectionCount', () => {
    it('should return 0 when no units selected', () => {
      expect(manager.getSelectionCount()).toBe(0);
    });

    it('should return correct count for multiple selections', () => {
      manager.selectMultiple([unit1, unit2, unit3]);
      expect(manager.getSelectionCount()).toBe(3);

      manager.removeFromSelection(unit2);
      expect(manager.getSelectionCount()).toBe(2);
    });
  });
});
