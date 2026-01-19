import { StatModifier } from '../abilities/types';

/**
 * Stats that can be tracked and scaled by the leveling system.
 * All stats are optional - only include what the unit uses.
 */
export interface UnitStats {
  maxHp: number;
  maxMp: number;
  strength: number;      // Physical damage
  dexterity: number;     // Attack speed, crit, dodge
  magic: number;         // Magical damage, ability power
  resilience: number;    // Damage reduction, status resistance
}

/**
 * Configuration for the leveling system.
 */
export interface LevelingConfig {
  /** Base stats at level 1 */
  baseStats: UnitStats;
  /** Stat growth per level (added to base stats) */
  growthPerLevel: Partial<UnitStats>;
  /** Function that returns XP needed to reach the next level */
  xpCurve: (currentLevel: number) => number;
  /** Optional max level cap */
  maxLevel?: number;
}

/**
 * Default XP curve: fast early, slower later.
 * Level 1->2: 10 XP, 2->3: 15 XP, 3->4: 22 XP, etc.
 */
export const defaultXpCurve = (level: number): number =>
  Math.floor(10 * Math.pow(1.5, level - 1));

/**
 * Composable leveling system that can be added to any unit (minion, enemy, etc.).
 * Manages level, XP, and stat calculations.
 */
export class LevelingSystem {
  private level = 1;
  private xp = 0;
  private config: LevelingConfig;
  private cachedStats: UnitStats;

  // Callbacks
  private onLevelUpCallback?: (newLevel: number, stats: UnitStats) => void;

  constructor(config: LevelingConfig) {
    this.config = config;
    this.cachedStats = { ...config.baseStats };
  }

  /**
   * Get the current level
   */
  public getLevel(): number {
    return this.level;
  }

  /**
   * Get current XP
   */
  public getXp(): number {
    return this.xp;
  }

  /**
   * Get XP needed to reach the next level
   */
  public getXpToNextLevel(): number {
    return this.config.xpCurve(this.level);
  }

  /**
   * Get XP progress as a fraction (0-1) toward next level
   */
  public getXpProgress(): number {
    return this.xp / this.getXpToNextLevel();
  }

  /**
   * Get current calculated stats (base + growth)
   */
  public getStats(): UnitStats {
    return this.cachedStats;
  }

  /**
   * Get a specific stat value
   */
  public getStat<K extends keyof UnitStats>(stat: K): number {
    return this.cachedStats[stat];
  }

  /**
   * Add XP and trigger level-ups if thresholds are reached
   */
  public addXp(amount: number): void {
    if (amount <= 0) return;
    if (this.config.maxLevel && this.level >= this.config.maxLevel) return;

    this.xp += amount;

    // Check for level ups (can level multiple times from one XP gain)
    while (this.xp >= this.getXpToNextLevel()) {
      if (this.config.maxLevel && this.level >= this.config.maxLevel) {
        // Cap XP at max level threshold
        this.xp = this.getXpToNextLevel();
        break;
      }
      this.xp -= this.getXpToNextLevel();
      this.levelUp();
    }
  }

  /**
   * Set callback for when level increases
   */
  public onLevelUp(callback: (newLevel: number, stats: UnitStats) => void): void {
    this.onLevelUpCallback = callback;
  }

  /**
   * Force set level (for testing or special cases)
   */
  public setLevel(level: number): void {
    this.level = Math.max(1, level);
    this.xp = 0;
    this.recalculateStats();
  }

  private levelUp(): void {
    this.level++;
    this.recalculateStats();

    if (this.onLevelUpCallback) {
      this.onLevelUpCallback(this.level, this.cachedStats);
    }
  }

  private recalculateStats(): void {
    const { baseStats, growthPerLevel } = this.config;
    const levelsGained = this.level - 1;

    this.cachedStats = {
      maxHp: baseStats.maxHp + (growthPerLevel.maxHp ?? 0) * levelsGained,
      maxMp: baseStats.maxMp + (growthPerLevel.maxMp ?? 0) * levelsGained,
      strength: baseStats.strength + (growthPerLevel.strength ?? 0) * levelsGained,
      dexterity: baseStats.dexterity + (growthPerLevel.dexterity ?? 0) * levelsGained,
      magic: baseStats.magic + (growthPerLevel.magic ?? 0) * levelsGained,
      resilience: baseStats.resilience + (growthPerLevel.resilience ?? 0) * levelsGained,
    };
  }

  /**
   * Get stats with external modifiers applied (e.g., from equipped gems)
   * @param modifiers Array of stat modifiers to apply
   * @returns Stats with all modifiers applied (flat first, then percent)
   */
  public getEffectiveStats(modifiers: StatModifier[]): UnitStats {
    // Start with base calculated stats
    const stats = { ...this.cachedStats };

    // Filter to only stats that exist on UnitStats (exclude moveSpeed which is handled separately)
    const validStats = ['maxHp', 'maxMp', 'strength', 'dexterity', 'magic', 'resilience'] as const;
    const validMods = modifiers.filter(m => validStats.includes(m.stat as typeof validStats[number]));

    // Separate flat and percent modifiers
    const flatMods = validMods.filter(m => m.type === 'flat');
    const percentMods = validMods.filter(m => m.type === 'percent');

    // Apply flat modifiers first
    for (const mod of flatMods) {
      const stat = mod.stat as keyof UnitStats;
      stats[stat] += mod.value;
    }

    // Then apply percent modifiers
    for (const mod of percentMods) {
      const stat = mod.stat as keyof UnitStats;
      stats[stat] *= (1 + mod.value / 100);
    }

    // Floor all values
    stats.maxHp = Math.floor(stats.maxHp);
    stats.maxMp = Math.floor(stats.maxMp);
    stats.strength = Math.floor(stats.strength);
    stats.dexterity = Math.floor(stats.dexterity);
    stats.magic = Math.floor(stats.magic);
    stats.resilience = Math.floor(stats.resilience);

    return stats;
  }
}
