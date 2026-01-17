/**
 * Manages party composition and enforces limits.
 * Central authority for minion count restrictions.
 */
export class PartyManager {
  private currentSize = 0;
  private maxSize: number;

  constructor(maxSize = 3) {
    this.maxSize = maxSize;
  }

  /** Check if another minion can be added to the party */
  canAddMinion(): boolean {
    return this.currentSize < this.maxSize;
  }

  /** Register a minion being added to the party */
  addMinion(): boolean {
    if (!this.canAddMinion()) return false;
    this.currentSize++;
    return true;
  }

  /** Register a minion being removed from the party (death or other) */
  removeMinion(): void {
    this.currentSize = Math.max(0, this.currentSize - 1);
  }

  /** Get current party size */
  getSize(): number {
    return this.currentSize;
  }

  /** Get maximum party size */
  getMaxSize(): number {
    return this.maxSize;
  }

  /** Check if party is at capacity */
  isFull(): boolean {
    return this.currentSize >= this.maxSize;
  }

  /** Reset party count (for game restart) */
  reset(): void {
    this.currentSize = 0;
  }
}
