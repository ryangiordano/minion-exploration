import { Commandable } from '../types/interfaces';
import { Treasure } from '../../features/treasure';
import { Enemy } from '../../features/enemies';

/**
 * Base interface for all commands
 */
export interface Command {
  execute(unit: Commandable): void;
}

/**
 * Command to move a unit to a specific position
 * Each unit gets a random offset to spread them around the target point
 */
export class MoveCommand implements Command {
  private readonly spreadRadius = 30;

  constructor(
    private readonly x: number,
    private readonly y: number
  ) {}

  execute(unit: Commandable): void {
    // Add random offset so units don't all clump at the same point
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.spreadRadius;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    unit.moveTo(this.x + offsetX, this.y + offsetY);
  }
}

/**
 * Command to collect a treasure item
 * Unit follows treasure (supports moving targets), first to touch collects it
 */
export class CollectCommand implements Command {
  constructor(
    private readonly treasure: Treasure,
    private readonly onCollect: (value: number) => void
  ) {}

  execute(unit: Commandable): void {
    unit.followTarget(this.treasure, () => {
      // Only collect if treasure hasn't been collected yet
      if (!this.treasure.isCollected()) {
        const value = this.treasure.collect();
        this.onCollect(value);
      }
    });
  }
}

/**
 * Interface for units that can enter combat mode
 */
interface CombatCapable {
  enterCombat(target: Enemy, onDefeated: () => void): void;
}

/**
 * Command to attack an enemy
 * Unit follows enemy, then enters continuous combat mode
 */
export class AttackCommand implements Command {
  constructor(
    private readonly enemy: Enemy,
    private readonly onDefeat: () => void
  ) {}

  execute(unit: Commandable): void {
    unit.followTarget(this.enemy, () => {
      // On arrival, enter combat mode instead of instant defeat
      if ('enterCombat' in unit && typeof (unit as CombatCapable).enterCombat === 'function') {
        (unit as CombatCapable).enterCombat(this.enemy, this.onDefeat);
      }
    });
  }
}
