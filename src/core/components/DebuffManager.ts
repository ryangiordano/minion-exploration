import Phaser from 'phaser';
import { TickSystem } from '../systems';

/** Supported debuff types */
export type DebuffType = 'stun' | 'slow' | 'poison';

/** A single active debuff instance */
export interface ActiveDebuff {
  type: DebuffType;
  ticksRemaining: number;
  totalTicks: number;
  /** Optional callback fired each tick (for DOTs) */
  onTick?: () => void;
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
 * Integrates with TickSystem for timing - debuff durations are in ticks (500ms each).
 */
export class DebuffManager {
  private debuffs: Map<DebuffType, ActiveDebuff> = new Map();
  private visuals: Map<DebuffType, DebuffVisual> = new Map();
  private scene: Phaser.Scene;
  private visualFactory?: DebuffVisualFactory;
  private tickSystem?: TickSystem;
  private entityId: string;

  constructor(
    scene: Phaser.Scene,
    entityId: string,
    options?: {
      visualFactory?: DebuffVisualFactory;
      tickSystem?: TickSystem;
    }
  ) {
    this.scene = scene;
    this.entityId = entityId;
    this.visualFactory = options?.visualFactory;
    this.tickSystem = options?.tickSystem;
  }

  /** Set the tick system (can be set after construction) */
  setTickSystem(tickSystem: TickSystem): void {
    this.tickSystem = tickSystem;
  }

  /**
   * Apply a debuff to this entity.
   * Duration is in ticks (1 tick = 500ms).
   * If already applied, refreshes the duration to the longer of the two.
   */
  apply(type: DebuffType, ticks: number, onTick?: () => void): void {
    const existing = this.debuffs.get(type);

    if (existing) {
      // Refresh duration (take the longer one)
      existing.ticksRemaining = Math.max(existing.ticksRemaining, ticks);
      existing.totalTicks = Math.max(existing.totalTicks, ticks);
      // Update onTick callback if provided
      if (onTick) {
        existing.onTick = onTick;
      }
    } else {
      // New debuff
      const debuff: ActiveDebuff = {
        type,
        ticksRemaining: ticks,
        totalTicks: ticks,
        onTick,
      };
      this.debuffs.set(type, debuff);

      // Register with tick system if available
      if (this.tickSystem) {
        const effectId = this.getEffectId(type);
        this.tickSystem.register({
          id: effectId,
          target: this,
          ticksRemaining: ticks,
          onTick: () => this.handleTick(type),
          onExpire: () => this.remove(type),
        });
      }

      // Create visual if factory exists
      if (this.visualFactory) {
        const visual = this.visualFactory(this.scene, type);
        if (visual) {
          this.visuals.set(type, visual);
        }
      }
    }
  }

  /** Generate unique effect ID for tick system registration */
  private getEffectId(type: DebuffType): string {
    return `debuff-${this.entityId}-${type}`;
  }

  /** Handle a tick for a specific debuff type */
  private handleTick(type: DebuffType): void {
    const debuff = this.debuffs.get(type);
    if (!debuff) return;

    // Call onTick callback if present (for DOTs)
    if (debuff.onTick) {
      debuff.onTick();
    }

    // Decrement local counter (tick system handles removal via onExpire)
    debuff.ticksRemaining--;
  }

  /**
   * Remove a specific debuff immediately
   */
  remove(type: DebuffType): void {
    this.debuffs.delete(type);

    // Unregister from tick system
    if (this.tickSystem) {
      this.tickSystem.unregister(this.getEffectId(type));
    }

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
    // Unregister all from tick system
    if (this.tickSystem) {
      this.debuffs.forEach((_, type) => {
        this.tickSystem!.unregister(this.getEffectId(type));
      });
    }

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
   * Get remaining ticks of a debuff (0 if not active)
   */
  getRemainingTicks(type: DebuffType): number {
    return this.debuffs.get(type)?.ticksRemaining ?? 0;
  }

  /**
   * Update visual positions. Call each frame.
   * Note: Tick countdown is now handled by TickSystem, not here.
   */
  update(x: number, y: number): void {
    // Update visual positions
    this.visuals.forEach((visual) => {
      visual.update(x, y);
    });
  }

  /**
   * Clean up all visuals and unregister from tick system
   */
  destroy(): void {
    this.clearAll();
  }
}
