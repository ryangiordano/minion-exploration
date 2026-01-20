import Phaser from 'phaser';
import { BezierArc } from './BezierArc';

export interface HealArcConfig {
  /** Line color (default: healing green) */
  color?: number;
  /** Line width */
  lineWidth?: number;
  /** Duration of the arc animation in ms */
  duration?: number;
  /** Base arc height - scales with distance */
  arcHeightRatio?: number;
  /** Animation mode: 'fade' leaves trail, 'snake' has tail following head */
  mode?: 'fade' | 'snake';
  /** For snake mode: length of the body as ratio of total arc (0-1) */
  snakeLength?: number;
  /** Time for the arc to fade out after completing (ms) */
  fadeOutDuration?: number;
  /** Easing function for the arc animation */
  ease?: string;
  /** Delay before starting the arc (ms) - useful for staggering multiple arcs */
  delay?: number;
  /** Random duration variance as a ratio (0.3 = ±30% of base duration) */
  durationVariance?: number;
}

const DEFAULT_CONFIG: Required<HealArcConfig> = {
  color: 0x00ff88,
  lineWidth: 3,
  duration: 600,
  arcHeightRatio: 0.4,
  mode: 'fade',
  snakeLength: 0.3,
  fadeOutDuration: 200,
  ease: 'Power1',
  delay: 0,
  durationVariance: 0.3,
};

/**
 * A healing arc effect - a curved beam that draws itself from source to target.
 * Supports two modes:
 * - 'fade': Line draws from start to end, then fades out
 * - 'snake': A segment travels along the arc path, tail following head
 */
export class HealArc {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Play a heal arc from source to target position (static coordinates) */
  play(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    config: HealArcConfig = {}
  ): void {
    this.animateArc(fromX, fromY, () => ({ x: toX, y: toY }), config);
  }

  /** Play a heal arc that tracks a moving target */
  playToTarget(
    fromX: number,
    fromY: number,
    target: { x: number; y: number },
    config: HealArcConfig = {}
  ): void {
    this.animateArc(fromX, fromY, () => ({ x: target.x, y: target.y }), config);
  }

  /** Internal: animate arc with a position getter for the target */
  private animateArc(
    fromX: number,
    fromY: number,
    getTargetPos: () => { x: number; y: number },
    config: HealArcConfig = {}
  ): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    const graphics = this.scene.add.graphics();
    graphics.setDepth(100);

    // Apply random variance to duration
    const variance = (Math.random() * 2 - 1) * opts.durationVariance;
    const actualDuration = opts.duration * (1 + variance);

    // Animate the arc drawing
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: actualDuration,
      delay: opts.delay,
      ease: opts.ease,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;

        // Get current target position each frame
        const targetPos = getTargetPos();
        const arc = new BezierArc(fromX, fromY, targetPos.x, targetPos.y, {
          heightRatio: opts.arcHeightRatio,
        });

        this.drawArc(graphics, arc, t, opts);
      },
      onComplete: () => {
        // Fade out after arc completes
        if (opts.mode === 'fade') {
          this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: opts.fadeOutDuration,
            onComplete: () => graphics.destroy(),
          });
        } else {
          // Snake mode: already fading as it goes, just destroy
          graphics.destroy();
        }
      },
    });
  }

  /** Draw the arc at the current progress */
  private drawArc(
    graphics: Phaser.GameObjects.Graphics,
    arc: BezierArc,
    progress: number,
    opts: Required<HealArcConfig>
  ): void {
    graphics.clear();

    const startT = opts.mode === 'snake' ? Math.max(0, progress - opts.snakeLength) : 0;
    const endT = progress;

    if (endT <= startT) return;

    const points = arc.getPoints(20, startT, endT);

    if (points.length < 2) return;

    // For snake mode, fade alpha along the length
    if (opts.mode === 'snake') {
      this.drawSnakeArc(graphics, points, opts);
    } else {
      // Fade mode: solid line
      graphics.lineStyle(opts.lineWidth, opts.color, 0.9);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.strokePath();

      // Add glow effect
      graphics.lineStyle(opts.lineWidth + 4, opts.color, 0.2);
      graphics.beginPath();
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.strokePath();
    }
  }

  /** Draw snake-style arc with fading tail */
  private drawSnakeArc(
    graphics: Phaser.GameObjects.Graphics,
    points: Phaser.Math.Vector2[],
    opts: Required<HealArcConfig>
  ): void {
    // Draw segments with decreasing alpha toward the tail
    for (let i = 1; i < points.length; i++) {
      const alpha = i / points.length; // 0 at tail, 1 at head

      // Main line
      graphics.lineStyle(opts.lineWidth, opts.color, alpha * 0.9);
      graphics.beginPath();
      graphics.moveTo(points[i - 1].x, points[i - 1].y);
      graphics.lineTo(points[i].x, points[i].y);
      graphics.strokePath();

      // Glow
      graphics.lineStyle(opts.lineWidth + 4, opts.color, alpha * 0.2);
      graphics.beginPath();
      graphics.moveTo(points[i - 1].x, points[i - 1].y);
      graphics.lineTo(points[i].x, points[i].y);
      graphics.strokePath();
    }

    // Bright head
    if (points.length > 0) {
      const head = points[points.length - 1];
      graphics.fillStyle(opts.color, 1);
      graphics.fillCircle(head.x, head.y, opts.lineWidth);
    }
  }

}
