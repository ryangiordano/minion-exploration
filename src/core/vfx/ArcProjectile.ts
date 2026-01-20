import Phaser from 'phaser';
import { BezierArc } from './BezierArc';

export interface ArcProjectileConfig {
  /** Projectile radius */
  size?: number;
  /** Fill color */
  color?: number;
  /** Stroke color */
  strokeColor?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Duration in ms */
  duration?: number;
  /** How high the arc rises above the start/end points */
  arcHeight?: number;
  /** Interval in ms between trail particles */
  trailInterval?: number;
  /** Trail particle size */
  trailSize?: number;
  /** Easing function */
  ease?: string;
}

const DEFAULT_CONFIG: Required<ArcProjectileConfig> = {
  size: 8,
  color: 0xffd700,
  strokeColor: 0xb8860b,
  strokeWidth: 3,
  duration: 400,
  arcHeight: 150,
  trailInterval: 40,
  trailSize: 5,
  ease: 'Power2.in',
};

/** Creates an arcing projectile that travels from point A to B with a trail */
export class ArcProjectile {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Launch a projectile from start to end position
   * @param startX World X coordinate
   * @param startY World Y coordinate
   * @param endX Screen X coordinate (for UI targets)
   * @param endY Screen Y coordinate (for UI targets)
   * @param onComplete Callback when projectile arrives
   */
  launch(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    onComplete: () => void,
    config: ArcProjectileConfig = {}
  ): void {
    const opts = { ...DEFAULT_CONFIG, ...config };

    // Convert world position to screen position
    const screenStartX = startX - this.scene.cameras.main.scrollX;
    const screenStartY = startY - this.scene.cameras.main.scrollY;

    // Create the projectile
    const orb = this.scene.add.circle(screenStartX, screenStartY, opts.size, opts.color);
    orb.setStrokeStyle(opts.strokeWidth, opts.strokeColor, 0.8);
    orb.setScrollFactor(0);
    orb.setDepth(1000);

    // Calculate arc - cap height based on vertical distance
    const arcHeight = Math.min(opts.arcHeight, Math.abs(endY - screenStartY) + 80);
    const arc = new BezierArc(screenStartX, screenStartY, endX, endY, {
      fixedHeight: arcHeight,
    });

    // Trail tracking
    let lastTrailTime = 0;

    // Animate along the arc
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: opts.duration,
      ease: opts.ease,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const pos = arc.getPointAt(t);

        orb.setPosition(pos.x, pos.y);

        // Pulse scale during flight
        const pulse = 1 + Math.sin(t * Math.PI * 3) * 0.2;
        orb.setScale(pulse);

        // Spawn trail particles at intervals
        const currentTime = t * opts.duration;
        if (currentTime - lastTrailTime >= opts.trailInterval) {
          lastTrailTime = currentTime;
          this.spawnTrail(pos.x, pos.y, opts.color, opts.trailSize);
        }
      },
      onComplete: () => {
        orb.destroy();
        onComplete();
      },
    });
  }

  private spawnTrail(x: number, y: number, color: number, size: number): void {
    const trail = this.scene.add.circle(x, y, size, color, 1);
    trail.setScrollFactor(0);
    trail.setDepth(999);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 0.3,
      duration: 500,
      ease: 'Power1',
      onComplete: () => trail.destroy(),
    });
  }
}
