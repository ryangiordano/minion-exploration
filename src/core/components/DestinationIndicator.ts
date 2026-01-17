import Phaser from 'phaser';

export interface DestinationIndicatorConfig {
  /** Line color */
  lineColor?: number;
  /** Line width */
  lineWidth?: number;
  /** Max alpha when far from destination */
  maxAlpha?: number;
  /** Distance at which indicator starts fading */
  fadeStartDistance?: number;
  /** Distance at which indicator is fully faded */
  fadeEndDistance?: number;
  /** Destination circle radius */
  circleRadius?: number;
}

const DEFAULT_CONFIG: Required<DestinationIndicatorConfig> = {
  lineColor: 0xffff00,
  lineWidth: 2,
  maxAlpha: 0.6,
  fadeStartDistance: 100,
  fadeEndDistance: 20,
  circleRadius: 8,
};

/** Shows a line from a unit to its destination, fading as it approaches */
export class DestinationIndicator {
  private config: Required<DestinationIndicatorConfig>;
  private graphics: Phaser.GameObjects.Graphics;
  private circle: Phaser.GameObjects.Arc;
  private destination: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, config: DestinationIndicatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create graphics for the line (below units)
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(-1);

    // Create destination circle
    this.circle = scene.add.circle(0, 0, this.config.circleRadius);
    this.circle.setStrokeStyle(2, this.config.lineColor, this.config.maxAlpha);
    this.circle.setFillStyle(this.config.lineColor, 0.15);
    this.circle.setDepth(-1);
    this.circle.setVisible(false);
  }

  /** Set the destination to show. Pass null to hide. */
  setDestination(dest: { x: number; y: number } | null): void {
    this.destination = dest;

    if (dest) {
      this.circle.setPosition(dest.x, dest.y);
      this.circle.setVisible(true);
    } else {
      this.circle.setVisible(false);
      this.graphics.clear();
    }
  }

  /** Update the indicator based on current unit position */
  update(unitX: number, unitY: number): void {
    if (!this.destination) {
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      unitX, unitY,
      this.destination.x, this.destination.y
    );

    // Calculate alpha based on distance
    const alpha = this.calculateAlpha(dist);

    // Hide if fully faded
    if (alpha <= 0) {
      this.graphics.clear();
      this.circle.setVisible(false);
      return;
    }

    // Draw line from unit to destination
    this.graphics.clear();
    this.graphics.lineStyle(this.config.lineWidth, this.config.lineColor, alpha);
    this.graphics.lineBetween(unitX, unitY, this.destination.x, this.destination.y);

    // Update circle alpha
    this.circle.setVisible(true);
    this.circle.setStrokeStyle(2, this.config.lineColor, alpha);
    this.circle.setFillStyle(this.config.lineColor, alpha * 0.25);
  }

  /** Calculate alpha based on distance to destination */
  private calculateAlpha(distance: number): number {
    const { maxAlpha, fadeStartDistance, fadeEndDistance } = this.config;

    if (distance >= fadeStartDistance) {
      return maxAlpha;
    }

    if (distance <= fadeEndDistance) {
      return 0;
    }

    // Linear interpolation between fade start and end
    const t = (distance - fadeEndDistance) / (fadeStartDistance - fadeEndDistance);
    return maxAlpha * t;
  }

  /** Hide the indicator */
  hide(): void {
    this.destination = null;
    this.graphics.clear();
    this.circle.setVisible(false);
  }

  /** Clean up resources */
  destroy(): void {
    this.graphics.destroy();
    this.circle.destroy();
  }
}
