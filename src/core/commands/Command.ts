import { Commandable } from '../types/interfaces';
import { Treasure } from '../../features/treasure';

/**
 * Base interface for all commands
 */
export interface Command {
  execute(unit: Commandable): void;
}

/**
 * Command to move a unit to a specific position
 */
export class MoveCommand implements Command {
  constructor(
    private readonly x: number,
    private readonly y: number
  ) {}

  execute(unit: Commandable): void {
    unit.moveTo(this.x, this.y);
  }
}

/**
 * Command to collect a treasure item
 * Unit moves to treasure, first to arrive collects it
 */
export class CollectCommand implements Command {
  constructor(
    private readonly treasure: Treasure,
    private readonly onCollect: (value: number) => void
  ) {}

  execute(unit: Commandable): void {
    const pos = this.treasure.getPosition();

    unit.moveTo(pos.x, pos.y, () => {
      // Only collect if treasure hasn't been collected yet
      if (!this.treasure.isCollected()) {
        const value = this.treasure.collect();
        this.onCollect(value);
      }
    });
  }
}
