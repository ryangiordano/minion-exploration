import { Combatable } from '../../../core/types/interfaces';
import { Vfx } from '../../../core/vfx';

/** Visual feedback colors for commands */
const COMMAND_COLORS = {
  move: 0xffff00,     // Yellow - move to location
  attack: 0xff4444,   // Red - attack enemy
  collect: 0x50c878,  // Green - collect treasure
} as const;

/** Interface for units that can receive commands */
export interface Commandable {
  x: number;
  y: number;
  send(event: { type: string; x?: number; y?: number; target?: Combatable }): void;
}

export interface CommandSystemConfig {
  vfx: Vfx;
  /** Returns currently selected units */
  getSelectedUnits: () => Commandable[];
  /** Default scatter radius for move commands */
  scatterRadius?: number;
  /** Spacing for grid formation */
  gridSpacing?: number;
}

/**
 * Handles RTS-style unit commands (move, attack, formations).
 * Provides visual feedback for command locations.
 */
export class CommandSystem {
  private vfx: Vfx;
  private getSelectedUnits: () => Commandable[];
  private scatterRadius: number;
  private gridSpacing: number;

  constructor(config: CommandSystemConfig) {
    this.vfx = config.vfx;
    this.getSelectedUnits = config.getSelectedUnits;
    this.scatterRadius = config.scatterRadius ?? 20;
    this.gridSpacing = config.gridSpacing ?? 30;
  }

  /** Issue a move command to selected units with scatter */
  moveToWithScatter(x: number, y: number): void {
    const units = this.getSelectedUnits();
    if (units.length === 0) return;

    units.forEach(unit => {
      const offset = this.getScatterOffset();
      unit.send({ type: 'MOVE_TO', x: x + offset.x, y: y + offset.y });
    });

    this.vfx.click.show(x, y, COMMAND_COLORS.move);
  }

  /** Issue a move command to exact position (no scatter) */
  moveToExact(x: number, y: number): void {
    const units = this.getSelectedUnits();
    if (units.length === 0) return;

    units.forEach(unit => {
      unit.send({ type: 'MOVE_TO_EXACT', x, y });
    });

    this.vfx.click.show(x, y, COMMAND_COLORS.move);
  }

  /** Issue an attack command to selected units */
  attack(target: Combatable): void {
    const units = this.getSelectedUnits();
    if (units.length === 0) return;

    units.forEach(unit => {
      unit.send({ type: 'ATTACK', target });
    });

    this.vfx.click.show(target.x, target.y, COMMAND_COLORS.attack);
  }

  /** Move selected units to collect at a location (with scatter and collect color) */
  collect(x: number, y: number): void {
    const units = this.getSelectedUnits();
    if (units.length === 0) return;

    units.forEach(unit => {
      const offset = this.getScatterOffset();
      unit.send({ type: 'MOVE_TO', x: x + offset.x, y: y + offset.y });
    });

    this.vfx.click.show(x, y, COMMAND_COLORS.collect);
  }

  /** Arrange selected units in a grid formation centered on the given position */
  gridLineup(centerX: number, centerY: number): void {
    const units = this.getSelectedUnits();
    if (units.length === 0) return;

    const gridSize = Math.ceil(Math.sqrt(units.length));
    const gridWidth = (gridSize - 1) * this.gridSpacing;
    const gridHeight = (gridSize - 1) * this.gridSpacing;
    const startX = centerX - gridWidth / 2;
    const startY = centerY - gridHeight / 2;

    units.forEach((unit, index) => {
      const col = index % gridSize;
      const row = Math.floor(index / gridSize);
      const x = startX + col * this.gridSpacing;
      const y = startY + row * this.gridSpacing;

      unit.send({ type: 'MOVE_TO_EXACT', x, y });
    });

    this.vfx.click.show(centerX, centerY, COMMAND_COLORS.move);
  }

  /** Get a random offset for scattering units around a target point */
  private getScatterOffset(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.scatterRadius;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  }
}
