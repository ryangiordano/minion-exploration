import Phaser from 'phaser';

/** Interface for collectible items (treasures, gems, etc.) */
export interface Collectible {
  x: number;
  y: number;
  isCollected(): boolean;
  isCollectible(): boolean;
}

/** Interface for entities that can collect items (minions) */
export interface Collector {
  x: number;
  y: number;
}

export interface CollectionEvent<T extends Collectible> {
  item: T;
  collector: Collector;
  x: number;
  y: number;
}

export interface CollectionSystemConfig {
  /** Distance at which items are collected */
  collectDistance?: number;
}

/**
 * Handles proximity-based collection of items by collectors.
 * Generic over the collectible type to support different item types.
 */
export class CollectionSystem<T extends Collectible> {
  private items: T[] = [];
  private collectDistance: number;
  private onCollectCallback?: (event: CollectionEvent<T>) => void;

  constructor(config: CollectionSystemConfig = {}) {
    this.collectDistance = config.collectDistance ?? 25;
  }

  /** Set the callback for when an item is collected */
  onCollect(callback: (event: CollectionEvent<T>) => void): this {
    this.onCollectCallback = callback;
    return this;
  }

  /** Add an item to be tracked for collection */
  add(item: T): void {
    this.items.push(item);
  }

  /** Remove an item from tracking */
  remove(item: T): void {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
    }
  }

  /** Get all tracked items */
  getItems(): T[] {
    return this.items;
  }

  /** Clear all tracked items */
  clear(): void {
    this.items = [];
  }

  /**
   * Check for collections between collectors and items.
   * Calls the onCollect callback and removes collected items.
   */
  update(collectors: Collector[]): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.isCollected() || !item.isCollectible()) continue;

      for (const collector of collectors) {
        const dist = Phaser.Math.Distance.Between(
          collector.x, collector.y,
          item.x, item.y
        );

        if (dist < this.collectDistance) {
          const x = item.x;
          const y = item.y;

          // Remove from tracking before callback (item may destroy itself)
          this.items.splice(i, 1);

          // Notify listeners
          this.onCollectCallback?.({
            item,
            collector,
            x,
            y,
          });

          break;
        }
      }
    }
  }
}
