/** Configuration for a rock type */
export interface RockTypeConfig {
  /** Display name */
  name: string;
  /** Base HP for this rock type */
  baseHp: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Fill color */
  color: number;
  /** Stroke color */
  strokeColor: number;
  /** Whether this rock blocks movement */
  blocksMovement: boolean;
  /** Essence drop range [min, max] */
  essenceDrop: [number, number];
}
