import { AbilityGem } from '../../../core/abilities/types';

export interface GemRegistryEntry {
  id: string;
  name: string;
  description: string;
  essenceCost: number;
  gemType: 'passive' | 'active';
  createGem: () => AbilityGem;
}

/**
 * Central registry of all available gems for upgrades.
 * Gems are registered with their costs and factory functions.
 */
export class GemRegistry {
  private static entries: Map<string, GemRegistryEntry> = new Map();

  /** Register a gem type with its cost */
  public static register(entry: GemRegistryEntry): void {
    GemRegistry.entries.set(entry.id, entry);
  }

  /** Get all registered gems */
  public static getAll(): GemRegistryEntry[] {
    return Array.from(GemRegistry.entries.values());
  }

  /** Get a specific gem by ID */
  public static get(id: string): GemRegistryEntry | undefined {
    return GemRegistry.entries.get(id);
  }

  /** Get N random gems (avoiding duplicates and optionally excluding IDs) */
  public static getRandomGems(count: number, exclude: string[] = []): GemRegistryEntry[] {
    const available = GemRegistry.getAll().filter(entry => !exclude.includes(entry.id));

    if (available.length <= count) {
      return [...available];
    }

    // Fisher-Yates shuffle and take first N
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /** Get number of registered gems */
  public static count(): number {
    return GemRegistry.entries.size;
  }
}
