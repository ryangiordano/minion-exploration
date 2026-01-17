import Phaser from 'phaser';

export interface TargetingIndicatorConfig {
  /** Line color */
  lineColor?: number;
  /** Line alpha */
  lineAlpha?: number;
  /** Line width */
  lineWidth?: number;
  /** Dash length */
  dashLength?: number;
  /** Gap length between dashes */
  gapLength?: number;
  /** Destination circle radius */
  destinationRadius?: number;
}

const DEFAULT_CONFIG: Required<TargetingIndicatorConfig> = {
  lineColor: 0xffff00,
  lineAlpha: 0.6,
  lineWidth: 2,
  dashLength: 8,
  gapLength: 6,
  destinationRadius: 12,
};

interface UnitPosition {
  x: number;
  y: number;
}

/** Shows dashed lines from units to cursor during move command targeting */
export class TargetingIndicator {
  private config: Required<TargetingIndicatorConfig>;
  private graphics: Phaser.GameObjects.Graphics;
  private destinationCircle: Phaser.GameObjects.Arc;
  private isVisible = false;
  private getUnits: () => UnitPosition[] = () => [];

  constructor(scene: Phaser.Scene, config: TargetingIndicatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create graphics for dashed lines
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);

    // Create destination circle (dashed stroke)
    this.destinationCircle = scene.add.circle(0, 0, this.config.destinationRadius);
    this.destinationCircle.setStrokeStyle(
      this.config.lineWidth,
      this.config.lineColor,
      this.config.lineAlpha
    );
    this.destinationCircle.setFillStyle(this.config.lineColor, 0.15);
    this.destinationCircle.setDepth(100);
    this.destinationCircle.setVisible(false);
  }

  /** Set the function that provides unit positions */
  setUnitSource(getUnits: () => UnitPosition[]): this {
    this.getUnits = getUnits;
    return this;
  }

  /** Show the indicator */
  show(): void {
    this.isVisible = true;
    this.destinationCircle.setVisible(true);
  }

  /** Hide the indicator */
  hide(): void {
    this.isVisible = false;
    this.graphics.clear();
    this.destinationCircle.setVisible(false);
  }

  /** Update the indicator to draw dashed lines to the given destination */
  update(destX: number, destY: number): void {
    if (!this.isVisible) return;

    const units = this.getUnits();

    // Update destination circle position
    this.destinationCircle.setPosition(destX, destY);

    // Clear and redraw dashed lines
    this.graphics.clear();
    this.graphics.lineStyle(
      this.config.lineWidth,
      this.config.lineColor,
      this.config.lineAlpha
    );

    for (const unit of units) {
      this.drawDashedLine(unit.x, unit.y, destX, destY);
    }
  }

  /** Draw a dashed line between two points */
  private drawDashedLine(x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dashPlusGap = this.config.dashLength + this.config.gapLength;
    const numDashes = Math.floor(distance / dashPlusGap);

    const unitX = dx / distance;
    const unitY = dy / distance;

    for (let i = 0; i < numDashes; i++) {
      const startDist = i * dashPlusGap;
      const endDist = startDist + this.config.dashLength;

      const startX = x1 + unitX * startDist;
      const startY = y1 + unitY * startDist;
      const endX = x1 + unitX * Math.min(endDist, distance);
      const endY = y1 + unitY * Math.min(endDist, distance);

      this.graphics.lineBetween(startX, startY, endX, endY);
    }

    // Draw any remaining partial dash
    const remainingStart = numDashes * dashPlusGap;
    if (remainingStart < distance) {
      const startX = x1 + unitX * remainingStart;
      const startY = y1 + unitY * remainingStart;
      this.graphics.lineBetween(startX, startY, x2, y2);
    }
  }

  /** Check if indicator is currently visible */
  isActive(): boolean {
    return this.isVisible;
  }

  /** Clean up resources */
  destroy(): void {
    this.graphics.destroy();
    this.destinationCircle.destroy();
  }
}
