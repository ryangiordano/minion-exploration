import { Commandable } from '../types/interfaces';

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
