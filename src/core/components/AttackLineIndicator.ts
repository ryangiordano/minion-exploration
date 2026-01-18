import Phaser from 'phaser';
import { Combatable } from '../types/interfaces';

export interface AttackLineIndicatorConfig {
  /** Line color */
  lineColor?: number;
  /** Line width */
  lineWidth?: number;
  /** Max alpha when far from target */
  maxAlpha?: number;
  /** Distance at which indicator starts fading */
  fadeStartDistance?: number;
  /** Distance at which indicator is fully faded */
  fadeEndDistance?: number;
}

const DEFAULT_CONFIG: Required<AttackLineIndicatorConfig> = {
  lineColor: 0xff4444, // Red for attacks
  lineWidth: 2,
  maxAlpha: 0.6,
  fadeStartDistance: 100,
  fadeEndDistance: 20,
};

/** Shows a solid line from a unit to its attack target, fading as it approaches */
export class AttackLineIndicator {
  private config: Required<AttackLineIndicatorConfig>;
  private graphics: Phaser.GameObjects.Graphics;
  private target: Combatable | null = null;

  constructor(scene: Phaser.Scene, config: AttackLineIndicatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create graphics for the line (below units)
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(-1);
  }

  /** Set the target to show line to. Pass null to hide. */
  setTarget(target: Combatable | null): void {
    this.target = target;

    if (!target) {
      this.graphics.clear();
    }
  }

  /** Update the indicator based on current unit position */
  update(unitX: number, unitY: number): void {
    if (!this.target || this.target.isDefeated()) {
      this.graphics.clear();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      unitX, unitY,
      this.target.x, this.target.y
    );

    // Calculate alpha based on distance
    const alpha = this.calculateAlpha(dist);

    // Hide if fully faded
    if (alpha <= 0) {
      this.graphics.clear();
      return;
    }

    // Draw line from unit to target
    this.graphics.clear();
    this.graphics.lineStyle(this.config.lineWidth, this.config.lineColor, alpha);
    this.graphics.lineBetween(unitX, unitY, this.target.x, this.target.y);
  }

  /** Calculate alpha based on distance to target */
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
    this.target = null;
    this.graphics.clear();
  }

  /** Clean up resources */
  destroy(): void {
    this.graphics.destroy();
  }
}
