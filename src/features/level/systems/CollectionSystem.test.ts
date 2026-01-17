import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionSystem, Collectible, Collector } from './CollectionSystem';

// Mock Phaser's distance calculation
vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
      },
    },
  },
}));

class MockCollectible implements Collectible {
  x: number;
  y: number;
  private collected = false;
  private collectible = true;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  isCollected(): boolean {
    return this.collected;
  }

  isCollectible(): boolean {
    return this.collectible;
  }

  setCollected(value: boolean): void {
    this.collected = value;
  }

  setCollectible(value: boolean): void {
    this.collectible = value;
  }
}

class MockCollector implements Collector {
  constructor(
    public x: number,
    public y: number
  ) {}
}

describe('CollectionSystem', () => {
  let system: CollectionSystem<MockCollectible>;

  beforeEach(() => {
    system = new CollectionSystem();
  });

  describe('add/remove items', () => {
    it('should add items to tracking', () => {
      const item = new MockCollectible(0, 0);
      system.add(item);

      expect(system.getItems()).toContain(item);
    });

    it('should remove items from tracking', () => {
      const item = new MockCollectible(0, 0);
      system.add(item);
      system.remove(item);

      expect(system.getItems()).not.toContain(item);
    });

    it('should handle removing non-existent item', () => {
      const item = new MockCollectible(0, 0);
      expect(() => system.remove(item)).not.toThrow();
    });

    it('should clear all items', () => {
      system.add(new MockCollectible(0, 0));
      system.add(new MockCollectible(10, 10));
      system.clear();

      expect(system.getItems()).toHaveLength(0);
    });
  });

  describe('collection behavior', () => {
    it('should collect item when collector is within distance', () => {
      const item = new MockCollectible(100, 100);
      const collector = new MockCollector(100, 110); // 10 units away
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector]);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith({
        item,
        collector,
        x: 100,
        y: 100,
      });
    });

    it('should not collect item when collector is too far', () => {
      const item = new MockCollectible(100, 100);
      const collector = new MockCollector(100, 200); // 100 units away
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector]);

      expect(callback).not.toHaveBeenCalled();
      expect(system.getItems()).toContain(item);
    });

    it('should use custom collect distance', () => {
      const system = new CollectionSystem<MockCollectible>({ collectDistance: 50 });
      const item = new MockCollectible(100, 100);
      const collector = new MockCollector(100, 140); // 40 units away
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector]);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should remove item from tracking after collection', () => {
      const item = new MockCollectible(100, 100);
      const collector = new MockCollector(100, 100);
      system.add(item);
      system.onCollect(vi.fn());
      system.update([collector]);

      expect(system.getItems()).not.toContain(item);
    });

    it('should skip already collected items', () => {
      const item = new MockCollectible(100, 100);
      item.setCollected(true);
      const collector = new MockCollector(100, 100);
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector]);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should skip non-collectible items', () => {
      const item = new MockCollectible(100, 100);
      item.setCollectible(false);
      const collector = new MockCollector(100, 100);
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector]);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple collectors', () => {
      const item1 = new MockCollectible(100, 100);
      const item2 = new MockCollectible(200, 200);
      const collector1 = new MockCollector(100, 100);
      const collector2 = new MockCollector(200, 200);
      system.add(item1);
      system.add(item2);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector1, collector2]);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should only let one collector collect each item', () => {
      const item = new MockCollectible(100, 100);
      const collector1 = new MockCollector(100, 100);
      const collector2 = new MockCollector(100, 100);
      system.add(item);

      const callback = vi.fn();
      system.onCollect(callback);
      system.update([collector1, collector2]);

      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('onCollect callback chaining', () => {
    it('should support fluent API', () => {
      const result = system.onCollect(() => {});
      expect(result).toBe(system);
    });
  });
});
