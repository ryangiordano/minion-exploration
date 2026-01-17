/** Configuration for initial game state - tweak these for balancing */
export interface GameStateConfig {
  /** Number of minions at run start */
  startingMinions: number;
  /** Essence currency at run start */
  startingEssence: number;
  /** Starting floor number */
  startingFloor: number;
}

/** Default configuration values */
const DEFAULT_CONFIG: GameStateConfig = {
  startingMinions: 3,
  startingEssence: 0,
  startingFloor: 1,
};

/**
 * Manages the persistent state of a roguelike run.
 * Tracks current floor, provides reset functionality.
 */
export class GameState {
  private config: GameStateConfig;
  private currentFloor: number;

  constructor(config: Partial<GameStateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentFloor = this.config.startingFloor;
  }

  /** Get the current floor number */
  getFloor(): number {
    return this.currentFloor;
  }

  /** Advance to the next floor */
  advanceFloor(): number {
    this.currentFloor++;
    return this.currentFloor;
  }

  /** Reset to starting state (on death) */
  reset(): void {
    this.currentFloor = this.config.startingFloor;
  }

  /** Get the number of minions to spawn at run start */
  getStartingMinions(): number {
    return this.config.startingMinions;
  }

  /** Get the starting essence amount */
  getStartingEssence(): number {
    return this.config.startingEssence;
  }

  /** Check if this is the first floor of a run */
  isFirstFloor(): boolean {
    return this.currentFloor === this.config.startingFloor;
  }
}
