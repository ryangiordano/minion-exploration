import Phaser from 'phaser';
import { BezierArc } from './BezierArc';

export interface CommandIndicatorConfig {
  /** Line color */
  lineColor?: number;
  /** Line alpha (starting) */
  lineAlpha?: number;
  /** Line width */
  lineWidth?: number;
  /** Arc height as ratio of distance */
  arcHeightRatio?: number;
  /** Destination circle radius */
  destinationRadius?: number;
  /** How long the arc takes to draw (ms) */
  duration?: number;
  /** Fade out duration (ms) */
  fadeOutDuration?: number;
}

const DEFAULT_CONFIG: Required<CommandIndicatorConfig> = {
  lineColor: 0xffff00,
  lineAlpha: 0.8,
  lineWidth: 2,
  arcHeightRatio: 0.15,
  destinationRadius: 16,
  duration: 300,
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

  /** Show command arcs from units to destination, then fade out */
  show(units: UnitPosition[], destX: number, destY: number): void {
    if (units.length === 0) return;

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

    // Animate an arc from each unit to destination
    for (const unit of units) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(100);

      this.animateArc(graphics, unit, destX, destY);
    }

    // Fade out circle after arcs complete
    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      duration: this.config.fadeOutDuration,
      delay: this.config.duration,
      onComplete: () => {
        circle.destroy();
      },
    });
  }

  /** Animate an arc drawing itself from start to end, tracking source position */
  private animateArc(
    graphics: Phaser.GameObjects.Graphics,
    source: UnitPosition,
    destX: number,
    destY: number
  ): void {
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: this.config.duration,
      ease: 'Power1',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        // Recalculate arc each frame to track moving source
        const arc = new BezierArc(source.x, source.y, destX, destY, {
          heightRatio: this.config.arcHeightRatio,
        });
        this.drawArc(graphics, arc, t);
      },
      onComplete: () => {
        // Fade out the arc
        this.scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: this.config.fadeOutDuration,
          onComplete: () => graphics.destroy(),
        });
      },
    });
  }

  /** Draw the arc up to the current progress */
  private drawArc(
    graphics: Phaser.GameObjects.Graphics,
    arc: BezierArc,
    progress: number
  ): void {
    graphics.clear();

    if (progress <= 0) return;

    const points = arc.getPoints(20, 0, progress);

    if (points.length < 2) return;

    // Draw main line
    graphics.lineStyle(this.config.lineWidth, this.config.lineColor, this.config.lineAlpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.strokePath();

    // Add subtle glow
    graphics.lineStyle(this.config.lineWidth + 3, this.config.lineColor, this.config.lineAlpha * 0.2);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.strokePath();
  }
}
