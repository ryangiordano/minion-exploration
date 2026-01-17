import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandSystem, Commandable, CommandSystemConfig } from './CommandSystem';
import { Combatable } from '../../../core/types/interfaces';

// Mock Vfx
const mockVfx = {
  click: {
    show: vi.fn(),
  },
  burst: { play: vi.fn(), playUI: vi.fn() },
  text: { show: vi.fn() },
  arc: { launch: vi.fn() },
};

class MockUnit implements Commandable {
  x = 0;
  y = 0;
  events: Array<{ type: string; x?: number; y?: number; target?: Combatable }> = [];

  send(event: { type: string; x?: number; y?: number; target?: Combatable }): void {
    this.events.push(event);
  }

  lastEvent() {
    return this.events[this.events.length - 1];
  }
}

class MockTarget implements Combatable {
  x = 100;
  y = 100;

  getCurrentHp(): number {
    return 10;
  }
  getMaxHp(): number {
    return 10;
  }
  takeDamage(): void {}
  isDefeated(): boolean {
    return false;
  }
  getRadius(): number {
    return 16;
  }
}

describe('CommandSystem', () => {
  let system: CommandSystem;
  let units: MockUnit[];

  beforeEach(() => {
    vi.clearAllMocks();
    units = [new MockUnit(), new MockUnit(), new MockUnit()];
    system = new CommandSystem({
      vfx: mockVfx as unknown as CommandSystemConfig['vfx'],
      getSelectedUnits: () => units,
      scatterRadius: 20,
      gridSpacing: 30,
    });
  });

  describe('moveToWithScatter', () => {
    it('should send MOVE_TO to all selected units', () => {
      system.moveToWithScatter(100, 200);

      units.forEach(unit => {
        expect(unit.lastEvent()?.type).toBe('MOVE_TO');
      });
    });

    it('should apply scatter offset within radius', () => {
      system.moveToWithScatter(100, 200);

      units.forEach(unit => {
        const event = unit.lastEvent();
        const dx = Math.abs(event.x! - 100);
        const dy = Math.abs(event.y! - 200);
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeLessThanOrEqual(20);
      });
    });

    it('should show click effect', () => {
      system.moveToWithScatter(100, 200);

      expect(mockVfx.click.show).toHaveBeenCalledWith(100, 200, 0xffff00);
    });

    it('should do nothing with no selected units', () => {
      units = [];
      system = new CommandSystem({
        vfx: mockVfx as unknown as CommandSystemConfig['vfx'],
        getSelectedUnits: () => units,
      });

      system.moveToWithScatter(100, 200);

      expect(mockVfx.click.show).not.toHaveBeenCalled();
    });
  });

  describe('moveToExact', () => {
    it('should send MOVE_TO_EXACT with exact coordinates', () => {
      system.moveToExact(100, 200);

      units.forEach(unit => {
        const event = unit.lastEvent();
        expect(event.type).toBe('MOVE_TO_EXACT');
        expect(event.x).toBe(100);
        expect(event.y).toBe(200);
      });
    });

    it('should show click effect', () => {
      system.moveToExact(100, 200);

      expect(mockVfx.click.show).toHaveBeenCalledWith(100, 200, 0xffff00);
    });
  });

  describe('attack', () => {
    it('should send ATTACK with target to all units', () => {
      const target = new MockTarget();
      system.attack(target);

      units.forEach(unit => {
        const event = unit.lastEvent();
        expect(event.type).toBe('ATTACK');
        expect(event.target).toBe(target);
      });
    });

    it('should show click effect at target position', () => {
      const target = new MockTarget();
      target.x = 150;
      target.y = 250;
      system.attack(target);

      expect(mockVfx.click.show).toHaveBeenCalledWith(150, 250, 0xff4444);
    });
  });

  describe('collect', () => {
    it('should send MOVE_TO with scatter', () => {
      system.collect(100, 200);

      units.forEach(unit => {
        expect(unit.lastEvent()?.type).toBe('MOVE_TO');
      });
    });

    it('should show click effect with collect color', () => {
      system.collect(100, 200);

      expect(mockVfx.click.show).toHaveBeenCalledWith(100, 200, 0x50c878);
    });
  });

  describe('gridLineup', () => {
    it('should arrange units in a grid formation', () => {
      system.gridLineup(100, 100);

      // With 3 units and gridSize=2, positions should be:
      // Row 0: (85, 85), (115, 85)
      // Row 1: (85, 115)
      const positions = units.map(u => ({ x: u.lastEvent()?.x, y: u.lastEvent()?.y }));

      // All should be MOVE_TO_EXACT
      units.forEach(unit => {
        expect(unit.lastEvent()?.type).toBe('MOVE_TO_EXACT');
      });

      // Check grid layout - all positions should be unique
      const positionStrings = positions.map(p => `${p.x},${p.y}`);
      const uniquePositions = new Set(positionStrings);
      expect(uniquePositions.size).toBe(3);
    });

    it('should center the grid on the given position', () => {
      // With 4 units: gridSize=2, spacing=30
      // Grid width = (2-1)*30 = 30
      // Start X = 100 - 15 = 85
      units = [new MockUnit(), new MockUnit(), new MockUnit(), new MockUnit()];
      system = new CommandSystem({
        vfx: mockVfx as unknown as CommandSystemConfig['vfx'],
        getSelectedUnits: () => units,
        gridSpacing: 30,
      });

      system.gridLineup(100, 100);

      // Calculate center of all positions
      const xs = units.map(u => u.lastEvent()?.x!);
      const ys = units.map(u => u.lastEvent()?.y!);
      const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;

      // Average should be close to center (allowing for grid rounding)
      expect(avgX).toBeCloseTo(100, 0);
      expect(avgY).toBeCloseTo(100, 0);
    });

    it('should show click effect', () => {
      system.gridLineup(100, 100);

      expect(mockVfx.click.show).toHaveBeenCalledWith(100, 100, 0xffff00);
    });

    it('should handle single unit', () => {
      units = [new MockUnit()];
      system = new CommandSystem({
        vfx: mockVfx as unknown as CommandSystemConfig['vfx'],
        getSelectedUnits: () => units,
      });

      system.gridLineup(100, 100);

      expect(units[0].lastEvent()?.type).toBe('MOVE_TO_EXACT');
      expect(units[0].lastEvent()?.x).toBe(100);
      expect(units[0].lastEvent()?.y).toBe(100);
    });
  });
});
