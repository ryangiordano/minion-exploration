/** Configuration for a tick effect */
export interface TickEffectConfig {
  /** Unique identifier for this effect */
  id: string;
  /** The entity this effect is attached to (for cleanup/querying) */
  target: unknown;
  /** Called each tick while effect is active */
  onTick: () => void;
  /** Number of ticks remaining (decrements each tick, removed at 0) */
  ticksRemaining: number;
  /** Optional callback when effect expires naturally */
  onExpire?: () => void;
}

/** Internal representation of an active tick effect */
interface ActiveTickEffect extends TickEffectConfig {
  /** Total ticks this effect was created with */
  totalTicks: number;
}

/** Default tick interval in milliseconds */
const DEFAULT_TICK_INTERVAL_MS = 500;

/**
 * Centralized timing system for periodic game effects.
 * Provides a global "heartbeat" that effects can subscribe to.
 *
 * Use for: DOTs, HOTs, buff/debuff durations, periodic effects.
 * Don't use for: Attack cooldowns, movement, animations.
 */
export class TickSystem {
  private effects: Map<string, ActiveTickEffect> = new Map();
  private elapsed: number = 0;
  private currentTick: number = 0;
  private paused: boolean = false;
  private tickIntervalMs: number;

  constructor(tickIntervalMs: number = DEFAULT_TICK_INTERVAL_MS) {
    this.tickIntervalMs = tickIntervalMs;
  }

  /** Current tick count since system started */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /** Tick interval in milliseconds */
  getTickInterval(): number {
    return this.tickIntervalMs;
  }

  /** Whether the system is paused */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Register a new tick effect.
   * The effect's onTick will be called immediately on the first tick,
   * then every tick thereafter until ticksRemaining reaches 0.
   */
  register(config: TickEffectConfig): string {
    const effect: ActiveTickEffect = {
      ...config,
      totalTicks: config.ticksRemaining,
    };
    this.effects.set(config.id, effect);
    return config.id;
  }

  /** Remove an effect by ID */
  unregister(id: string): void {
    this.effects.delete(id);
  }

  /** Get all effects attached to a specific target */
  getEffectsForTarget(target: unknown): ActiveTickEffect[] {
    const results: ActiveTickEffect[] = [];
    this.effects.forEach((effect) => {
      if (effect.target === target) {
        results.push(effect);
      }
    });
    return results;
  }

  /** Remove all effects attached to a specific target */
  clearEffectsForTarget(target: unknown): void {
    const toRemove: string[] = [];
    this.effects.forEach((effect, id) => {
      if (effect.target === target) {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => this.effects.delete(id));
  }

  /** Check if a specific effect ID is active */
  hasEffect(id: string): boolean {
    return this.effects.has(id);
  }

  /** Get remaining ticks for an effect (0 if not found) */
  getRemainingTicks(id: string): number {
    return this.effects.get(id)?.ticksRemaining ?? 0;
  }

  /** Pause the tick system (no ticks will fire) */
  pause(): void {
    this.paused = true;
  }

  /** Resume the tick system */
  resume(): void {
    this.paused = false;
  }

  /**
   * Update the tick system. Call every frame with delta time.
   * Fires tick callbacks when the accumulated time exceeds the tick interval.
   */
  update(delta: number): void {
    if (this.paused) return;

    this.elapsed += delta;

    // Process ticks while we have enough accumulated time
    while (this.elapsed >= this.tickIntervalMs) {
      this.elapsed -= this.tickIntervalMs;
      this.currentTick++;
      this.processTick();
    }
  }

  /** Process a single tick: call all effect callbacks and handle expiration */
  private processTick(): void {
    const expired: string[] = [];

    this.effects.forEach((effect, id) => {
      // Call the tick callback
      effect.onTick();

      // Decrement remaining ticks
      effect.ticksRemaining--;

      // Mark for removal if expired
      if (effect.ticksRemaining <= 0) {
        expired.push(id);
      }
    });

    // Remove expired effects and call their onExpire callbacks
    for (const id of expired) {
      const effect = this.effects.get(id);
      if (effect?.onExpire) {
        effect.onExpire();
      }
      this.effects.delete(id);
    }
  }

  /** Clear all effects */
  clear(): void {
    this.effects.clear();
  }

  /** Get the number of active effects */
  getActiveEffectCount(): number {
    return this.effects.size;
  }
}
