import { Combatable } from '../types/interfaces';

export interface ThreatEntry {
  target: Combatable;
  value: number;
  lastDamageTime: number;
}

export interface ThreatTrackerConfig {
  aggroRadius?: number;        // Detection range (default: 150)
  leashRadius?: number;        // Max chase range, clears threat beyond this (default: aggroRadius * 1.5)
  baseThreat?: number;         // Initial threat when detected (default: 10)
  damageMultiplier?: number;   // Threat per damage point (default: 5)
  decayRate?: number;          // Threat decay per second (default: 2)
}

const DEFAULTS = {
  aggroRadius: 150,
  leashMultiplier: 1.5,        // Leash is 1.5x aggro radius by default
  baseThreat: 10,
  damageMultiplier: 5,
  decayRate: 2
};

/**
 * Tracks threat values for nearby entities.
 * Used for aggro detection and target prioritization.
 */
export class ThreatTracker {
  private threatMap: Map<Combatable, ThreatEntry> = new Map();
  private sortedList: ThreatEntry[] = [];
  private needsSort = false;

  private readonly aggroRadius: number;
  private readonly leashRadius: number;
  private readonly baseThreat: number;
  private readonly damageMultiplier: number;
  private readonly decayRate: number;

  private onNewThreatCallback?: (target: Combatable) => void;
  private onThreatClearedCallback?: (target: Combatable) => void;

  constructor(config: ThreatTrackerConfig = {}) {
    this.aggroRadius = config.aggroRadius ?? DEFAULTS.aggroRadius;
    this.leashRadius = config.leashRadius ?? (this.aggroRadius * DEFAULTS.leashMultiplier);
    this.baseThreat = config.baseThreat ?? DEFAULTS.baseThreat;
    this.damageMultiplier = config.damageMultiplier ?? DEFAULTS.damageMultiplier;
    this.decayRate = config.decayRate ?? DEFAULTS.decayRate;
  }

  /**
   * Set callback for when a new threat is detected
   */
  public onNewThreat(callback: (target: Combatable) => void): this {
    this.onNewThreatCallback = callback;
    return this;
  }

  /**
   * Set callback for when a threat is removed (0 threat or defeated)
   */
  public onThreatCleared(callback: (target: Combatable) => void): this {
    this.onThreatClearedCallback = callback;
    return this;
  }

  /**
   * Update threat tracking each frame.
   * - Detects new entities entering aggro radius
   * - Applies threat decay over time
   * - Removes defeated or zero-threat entities
   */
  public update(delta: number, ownerX: number, ownerY: number, nearbyTargets: Combatable[]): void {
    const deltaSeconds = delta / 1000;

    // Check for new entities in aggro radius
    for (const target of nearbyTargets) {
      if (target.isDefeated()) continue;

      const distance = Math.sqrt(
        Math.pow(target.x - ownerX, 2) + Math.pow(target.y - ownerY, 2)
      );

      if (distance <= this.aggroRadius && !this.threatMap.has(target)) {
        // New threat detected
        this.addThreatEntry(target, this.baseThreat);
      }
    }

    // Update existing threats
    const toRemove: Combatable[] = [];

    for (const [target, entry] of this.threatMap) {
      // Remove defeated targets
      if (target.isDefeated()) {
        toRemove.push(target);
        continue;
      }

      // Check leash radius - clear threat if target moved too far away
      const distance = Math.sqrt(
        Math.pow(target.x - ownerX, 2) + Math.pow(target.y - ownerY, 2)
      );
      if (distance > this.leashRadius) {
        toRemove.push(target);
        continue;
      }

      // Apply decay
      entry.value -= this.decayRate * deltaSeconds;

      // Remove if threat reaches zero
      if (entry.value <= 0) {
        toRemove.push(target);
      }
    }

    // Remove cleared threats
    for (const target of toRemove) {
      this.threatMap.delete(target);
      this.needsSort = true;
      this.onThreatClearedCallback?.(target);
    }

    // Rebuild sorted list if needed
    if (this.needsSort) {
      this.rebuildSortedList();
    }
  }

  /**
   * Add threat from an attack or other source
   */
  public addThreat(target: Combatable, amount: number): void {
    const entry = this.threatMap.get(target);
    if (entry) {
      entry.value += amount;
      entry.lastDamageTime = Date.now();
      this.needsSort = true;
    } else {
      // New threat from direct attack (higher than proximity)
      this.addThreatEntry(target, amount);
    }
  }

  /**
   * Add threat scaled by damage dealt
   */
  public addDamageThreat(target: Combatable, damage: number): void {
    this.addThreat(target, damage * this.damageMultiplier);
  }

  /**
   * Get the highest threat target
   */
  public getHighestThreat(): Combatable | undefined {
    if (this.needsSort) {
      this.rebuildSortedList();
    }
    return this.sortedList[0]?.target;
  }

  /**
   * Get all threats sorted by value (highest first)
   */
  public getThreatList(): readonly ThreatEntry[] {
    if (this.needsSort) {
      this.rebuildSortedList();
    }
    return this.sortedList;
  }

  /**
   * Check if there are any active threats
   */
  public hasThreat(): boolean {
    return this.threatMap.size > 0;
  }

  /**
   * Get threat value for a specific target
   */
  public getThreatValue(target: Combatable): number {
    return this.threatMap.get(target)?.value ?? 0;
  }

  /**
   * Clear threat for a specific target
   */
  public clearThreat(target: Combatable): void {
    if (this.threatMap.has(target)) {
      this.threatMap.delete(target);
      this.needsSort = true;
      this.onThreatClearedCallback?.(target);
    }
  }

  /**
   * Clear all threats
   */
  public clearAll(): void {
    for (const target of this.threatMap.keys()) {
      this.onThreatClearedCallback?.(target);
    }
    this.threatMap.clear();
    this.sortedList = [];
    this.needsSort = false;
  }

  /**
   * Get the aggro radius
   */
  public getAggroRadius(): number {
    return this.aggroRadius;
  }

  /**
   * Get the leash radius (max chase distance)
   */
  public getLeashRadius(): number {
    return this.leashRadius;
  }

  private addThreatEntry(target: Combatable, value: number): void {
    const entry: ThreatEntry = {
      target,
      value,
      lastDamageTime: Date.now()
    };
    this.threatMap.set(target, entry);
    this.needsSort = true;
    this.onNewThreatCallback?.(target);
  }

  private rebuildSortedList(): void {
    this.sortedList = Array.from(this.threatMap.values())
      .sort((a, b) => b.value - a.value);
    this.needsSort = false;
  }
}
