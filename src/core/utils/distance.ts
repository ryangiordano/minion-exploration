import Phaser from 'phaser';

/**
 * Calculate the edge-to-edge distance between two entities.
 * This accounts for the physical size of both entities, returning
 * the gap between their edges rather than center-to-center distance.
 *
 * @returns The distance between edges (0 or negative means touching/overlapping)
 */
export function getEdgeDistance(
  x1: number,
  y1: number,
  radius1: number,
  x2: number,
  y2: number,
  radius2: number
): number {
  const centerDistance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
  return centerDistance - radius1 - radius2;
}

/**
 * Check if two entities are within attack range of each other.
 * Uses edge-to-edge distance calculation.
 *
 * @param attackRange - Additional range beyond touching (0 for melee)
 * @param tolerance - Extra buffer distance for leniency (default 5)
 */
export function isWithinAttackRange(
  attackerX: number,
  attackerY: number,
  attackerRadius: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
  attackRange: number,
  tolerance: number = 5
): boolean {
  const edgeDistance = getEdgeDistance(
    attackerX,
    attackerY,
    attackerRadius,
    targetX,
    targetY,
    targetRadius
  );

  // In range if edge distance is less than attack range + tolerance
  return edgeDistance <= attackRange + tolerance;
}
