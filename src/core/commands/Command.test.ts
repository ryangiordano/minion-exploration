import { describe, it, expect } from 'vitest';
import { MoveCommand } from './Command';
import { Commandable } from '../types/interfaces';

// Mock Commandable for testing
class MockCommandable implements Commandable {
  public lastMoveX?: number;
  public lastMoveY?: number;
  public moveCallCount = 0;

  moveTo(x: number, y: number): void {
    this.lastMoveX = x;
    this.lastMoveY = y;
    this.moveCallCount++;
  }
}

describe('MoveCommand', () => {
  it('should execute moveTo with correct coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(100, 200);

    command.execute(unit);

    expect(unit.lastMoveX).toBe(100);
    expect(unit.lastMoveY).toBe(200);
    expect(unit.moveCallCount).toBe(1);
  });

  it('should work with negative coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(-50, -75);

    command.execute(unit);

    expect(unit.lastMoveX).toBe(-50);
    expect(unit.lastMoveY).toBe(-75);
  });

  it('should work with zero coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(0, 0);

    command.execute(unit);

    expect(unit.lastMoveX).toBe(0);
    expect(unit.lastMoveY).toBe(0);
  });

  it('should work with decimal coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(123.456, 789.012);

    command.execute(unit);

    expect(unit.lastMoveX).toBe(123.456);
    expect(unit.lastMoveY).toBe(789.012);
  });

  it('should execute on multiple units independently', () => {
    const unit1 = new MockCommandable();
    const unit2 = new MockCommandable();
    const command = new MoveCommand(50, 100);

    command.execute(unit1);
    command.execute(unit2);

    expect(unit1.lastMoveX).toBe(50);
    expect(unit1.lastMoveY).toBe(100);
    expect(unit2.lastMoveX).toBe(50);
    expect(unit2.lastMoveY).toBe(100);
    expect(unit1.moveCallCount).toBe(1);
    expect(unit2.moveCallCount).toBe(1);
  });

  it('should be reusable for the same coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(75, 150);

    command.execute(unit);
    command.execute(unit);

    expect(unit.lastMoveX).toBe(75);
    expect(unit.lastMoveY).toBe(150);
    expect(unit.moveCallCount).toBe(2);
  });
});
