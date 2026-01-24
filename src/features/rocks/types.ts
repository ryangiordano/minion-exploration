/** Configuration for a rock type */
export interface RockTypeConfig {
  /** Display name */
  name: string;
  /** Base HP for this rock type */
  baseHp: number;
  /** Size in pixels (rocks are square) */
  size: number;
  /** Whether this rock blocks movement */
  blocksMovement: boolean;
  /** Essence drop range [min, max] */
  essenceDrop: [number, number];
}
