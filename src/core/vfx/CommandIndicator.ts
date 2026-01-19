import Phaser from 'phaser';

export interface CommandIndicatorConfig {
  /** Line color */
  lineColor?: number;
  /** Line alpha (starting) */
  lineAlpha?: number;
  /** Line width */
  lineWidth?: number;
  /** Dash length */
  dashLength?: number;
  /** Gap length between dashes */
  gapLength?: number;
  /** Destination circle radius */
  destinationRadius?: number;
  /** How long the indicator stays visible (ms) */
  duration?: number;
  /** Fade out duration (ms) */
  fadeOutDuration?: number;
}

const DEFAULT_CONFIG: Required<CommandIndicatorConfig> = {
  lineColor: 0xffff00,
  lineAlpha: 0.8,
  lineWidth: 2,
  dashLength: 8,
  gapLength: 6,
  destinationRadius: 16,
  duration: 400,
  fadeOutDuration: 200,
};

interface UnitPosition {
  x: number;
  y: number;
}

/** Shows a brief flash of dashed lines from units to a command destination */
export class CommandIndicator {
  private scene: Phaser.Scene;
  private config: Required<CommandIndicatorConfig>;

  constructor(scene: Phaser.Scene, config: CommandIndicatorConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Show command lines from units to destination, then fade out */
  show(units: UnitPosition[], destX: number, destY: number): void {
    if (units.length === 0) return;

    // Create graphics for this flash
    const graphics = this.scene.add.graphics();
    graphics.setDepth(100);

    // Draw dashed lines from each unit to destination
    graphics.lineStyle(
      this.config.lineWidth,
      this.config.lineColor,
      this.config.lineAlpha
    );

    for (const unit of units) {
      this.drawDashedLine(graphics, unit.x, unit.y, destX, destY);
    }

    // Create destination circle with pulse effect
    const circle = this.scene.add.circle(
      destX,
      destY,
      this.config.destinationRadius
    );
    circle.setStrokeStyle(
      this.config.lineWidth,
      this.config.lineColor,
      this.config.lineAlpha
    );
    circle.setFillStyle(this.config.lineColor, 0.2);
    circle.setDepth(100);

    // Pulse the circle
    this.scene.tweens.add({
      targets: circle,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: this.config.duration / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // Fade out everything
    this.scene.tweens.add({
      targets: [graphics, circle],
      alpha: 0,
      duration: this.config.fadeOutDuration,
      delay: this.config.duration - this.config.fadeOutDuration,
      onComplete: () => {
        graphics.destroy();
        circle.destroy();
      },
    });
  }

  /** Draw a dashed line between two points */
  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

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

      graphics.lineBetween(startX, startY, endX, endY);
    }

    // Draw any remaining partial dash
    const remainingStart = numDashes * dashPlusGap;
    if (remainingStart < distance) {
      const startX = x1 + unitX * remainingStart;
      const startY = y1 + unitY * remainingStart;
      graphics.lineBetween(startX, startY, x2, y2);
    }
  }
}
