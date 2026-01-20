import Phaser from 'phaser';

export interface BezierArcConfig {
  /** How high the arc rises, as a ratio of the distance (default: 0.4) */
  heightRatio?: number;
  /** Fixed arc height in pixels (overrides heightRatio if provided) */
  fixedHeight?: number;
  /** If true, arc curves downward instead of upward */
  invertArc?: boolean;
}

/**
 * Utility class for quadratic bezier arc calculations.
 * Encapsulates the math for arcing paths between two points.
 */
export class BezierArc {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly controlX: number;
  readonly controlY: number;

  constructor(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    config: BezierArcConfig = {}
  ) {
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;

    // Calculate control point for the arc
    this.controlX = (startX + endX) / 2;

    const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
    const arcHeight = config.fixedHeight ?? distance * (config.heightRatio ?? 0.4);
    const baseY = config.invertArc ? Math.max(startY, endY) : Math.min(startY, endY);
    this.controlY = baseY + (config.invertArc ? arcHeight : -arcHeight);
  }

  /** Get a point along the arc at position t (0-1) */
  getPointAt(t: number): Phaser.Math.Vector2 {
    return BezierArc.quadraticBezier(
      this.startX,
      this.startY,
      this.controlX,
      this.controlY,
      this.endX,
      this.endY,
      t
    );
  }

  /** Get an array of points along the arc */
  getPoints(segments: number, startT: number = 0, endT: number = 1): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = startT + (endT - startT) * (i / segments);
      points.push(this.getPointAt(t));
    }
    return points;
  }

  /** Static helper: calculate point on quadratic bezier curve */
  static quadraticBezier(
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    t: number
  ): Phaser.Math.Vector2 {
    // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const oneMinusT = 1 - t;
    const x = oneMinusT * oneMinusT * p0x + 2 * oneMinusT * t * p1x + t * t * p2x;
    const y = oneMinusT * oneMinusT * p0y + 2 * oneMinusT * t * p1y + t * t * p2y;
    return new Phaser.Math.Vector2(x, y);
  }
}
