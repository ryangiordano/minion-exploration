/**
 * Interface for entities that can be selected
 */
export interface Selectable {
  select(): void;
  deselect(): void;
  isSelected(): boolean;
}

/**
 * Interface for entities that can receive and execute commands
 */
export interface Commandable {
  moveTo(x: number, y: number, onArrival?: () => void): void;
}

/**
 * Combined interface for units that can be selected and commanded (like minions)
 */
export interface Unit extends Selectable, Commandable {}
