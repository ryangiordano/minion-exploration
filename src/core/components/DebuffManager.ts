import Phaser from 'phaser';

/** Supported debuff types */
export type DebuffType = 'stun' | 'slow';

/** A single active debuff instance */
export interface ActiveDebuff {
  type: DebuffType;
  remainingMs: number;
  durationMs: number;
}

/** Visual effect interface for debuff rendering */
export interface DebuffVisual {
  update(x: number, y: number): void;
  destroy(): void;
}

/** Factory function type for creating debuff visuals */
export type DebuffVisualFactory = (
  scene: Phaser.Scene,
  type: DebuffType
) => DebuffVisual | null;

/**
 * Manages active debuffs on an entity.
 * Tracks durations, provides query methods, and handles visual effects.
 */
export class DebuffManager {
  private debuffs: Map<DebuffType, ActiveDebuff> = new Map();
  private visuals: Map<DebuffType, DebuffVisual> = new Map();
  private scene: Phaser.Scene;
  private visualFactory?: DebuffVisualFactory;

  constructor(scene: Phaser.Scene, visualFactory?: DebuffVisualFactory) {
    this.scene = scene;
    this.visualFactory = visualFactory;
  }

  /**
   * Apply a debuff to this entity.
   * If already applied, refreshes the duration to the longer of the two.
   */
  apply(type: DebuffType, durationMs: number): void {
    const existing = this.debuffs.get(type);

    if (existing) {
      // Refresh duration (take the longer one)
      existing.remainingMs = Math.max(existing.remainingMs, durationMs);
      existing.durationMs = Math.max(existing.durationMs, durationMs);
    } else {
      // New debuff
      this.debuffs.set(type, {
        type,
        remainingMs: durationMs,
        durationMs,
      });

      // Create visual if factory exists
      if (this.visualFactory) {
        const visual = this.visualFactory(this.scene, type);
        if (visual) {
          this.visuals.set(type, visual);
        }
      }
    }
  }

  /**
   * Remove a specific debuff immediately
   */
  remove(type: DebuffType): void {
    this.debuffs.delete(type);
    const visual = this.visuals.get(type);
    if (visual) {
      visual.destroy();
      this.visuals.delete(type);
    }
  }

  /**
   * Clear all debuffs
   */
  clearAll(): void {
    this.debuffs.clear();
    this.visuals.forEach((visual) => visual.destroy());
    this.visuals.clear();
  }

  /**
   * Check if entity is stunned (cannot move or attack)
   */
  isStunned(): boolean {
    return this.debuffs.has('stun');
  }

  /**
   * Get movement speed multiplier (1.0 = normal, 0.5 = 50% slow)
   */
  getMovementMultiplier(): number {
    if (this.debuffs.has('slow')) {
      return 0.5; // 50% slow for now, could be configurable
    }
    return 1.0;
  }

  /**
   * Check if a specific debuff is active
   */
  has(type: DebuffType): boolean {
    return this.debuffs.has(type);
  }

  /**
   * Get remaining duration of a debuff in ms (0 if not active)
   */
  getRemainingDuration(type: DebuffType): number {
    return this.debuffs.get(type)?.remainingMs ?? 0;
  }

  /**
   * Update debuff timers and visuals. Call each frame.
   */
  update(delta: number, x: number, y: number): void {
    const expired: DebuffType[] = [];

    this.debuffs.forEach((debuff, type) => {
      debuff.remainingMs -= delta;
      if (debuff.remainingMs <= 0) {
        expired.push(type);
      }
    });

    // Remove expired debuffs
    for (const type of expired) {
      this.remove(type);
    }

    // Update visual positions
    this.visuals.forEach((visual) => {
      visual.update(x, y);
    });
  }

  /**
   * Clean up all visuals
   */
  destroy(): void {
    this.clearAll();
  }
}
