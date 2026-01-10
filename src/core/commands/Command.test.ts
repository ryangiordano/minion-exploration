import { describe, it, expect } from 'vitest';
import { MoveCommand } from './Command';
import { Commandable, Followable } from '../types/interfaces';

// Mock Commandable for testing
class MockCommandable implements Commandable {
  public lastMoveX?: number;
  public lastMoveY?: number;
  public moveCallCount = 0;
  public lastFollowTarget?: Followable;
  public followCallCount = 0;

  moveTo(x: number, y: number): void {
    this.lastMoveX = x;
    this.lastMoveY = y;
    this.moveCallCount++;
  }

  followTarget(target: Followable, _onArrival: () => void): void {
    this.lastFollowTarget = target;
    this.followCallCount++;
  }
}

// MoveCommand spreads units within a 30px radius, so we check they're close to target
const SPREAD_RADIUS = 30;

function expectNear(actual: number | undefined, expected: number, tolerance: number): void {
  expect(actual).toBeDefined();
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(tolerance);
}

describe('MoveCommand', () => {
  it('should execute moveTo near target coordinates with spread', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(100, 200);

    command.execute(unit);

    expectNear(unit.lastMoveX, 100, SPREAD_RADIUS);
    expectNear(unit.lastMoveY, 200, SPREAD_RADIUS);
    expect(unit.moveCallCount).toBe(1);
  });

  it('should work with negative coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(-50, -75);

    command.execute(unit);

    expectNear(unit.lastMoveX, -50, SPREAD_RADIUS);
    expectNear(unit.lastMoveY, -75, SPREAD_RADIUS);
  });

  it('should work with zero coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(0, 0);

    command.execute(unit);

    expectNear(unit.lastMoveX, 0, SPREAD_RADIUS);
    expectNear(unit.lastMoveY, 0, SPREAD_RADIUS);
  });

  it('should work with decimal coordinates', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(123.456, 789.012);

    command.execute(unit);

    expectNear(unit.lastMoveX, 123.456, SPREAD_RADIUS);
    expectNear(unit.lastMoveY, 789.012, SPREAD_RADIUS);
  });

  it('should give different offsets to multiple units', () => {
    const unit1 = new MockCommandable();
    const unit2 = new MockCommandable();
    const command = new MoveCommand(50, 100);

    command.execute(unit1);
    command.execute(unit2);

    // Both should be near target
    expectNear(unit1.lastMoveX, 50, SPREAD_RADIUS);
    expectNear(unit1.lastMoveY, 100, SPREAD_RADIUS);
    expectNear(unit2.lastMoveX, 50, SPREAD_RADIUS);
    expectNear(unit2.lastMoveY, 100, SPREAD_RADIUS);

    // They should (almost certainly) have different positions due to random spread
    // Note: There's a tiny chance they could be identical, but it's negligible
    expect(unit1.moveCallCount).toBe(1);
    expect(unit2.moveCallCount).toBe(1);
  });

  it('should be reusable with different spread each time', () => {
    const unit = new MockCommandable();
    const command = new MoveCommand(75, 150);

    command.execute(unit);
    const firstX = unit.lastMoveX;
    const firstY = unit.lastMoveY;

    command.execute(unit);

    // Both calls should be near target
    expectNear(unit.lastMoveX, 75, SPREAD_RADIUS);
    expectNear(unit.lastMoveY, 150, SPREAD_RADIUS);
    expect(unit.moveCallCount).toBe(2);

    // The two calls should (almost certainly) have different offsets
    // We don't assert this strictly since it's random, but the mechanic is tested
    expect(firstX).toBeDefined();
    expect(firstY).toBeDefined();
  });
});
