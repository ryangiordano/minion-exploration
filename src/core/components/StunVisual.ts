import Phaser from 'phaser';
import { DebuffVisual } from './DebuffManager';

const NUM_CIRCLES = 3;
const CIRCLE_RADIUS = 3;
const ELLIPSE_WIDTH = 20;
const ELLIPSE_HEIGHT = 6;
const VERTICAL_OFFSET = -30; // Above the entity

/**
 * Visual effect for stun: spinning circles in a thin ellipse above the entity
 */
export class StunVisual implements DebuffVisual {
  private container: Phaser.GameObjects.Container;
  private circles: Phaser.GameObjects.Arc[] = [];
  private angle = 0;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100); // Above most things

    // Create circles evenly spaced around the ellipse
    for (let i = 0; i < NUM_CIRCLES; i++) {
      const circle = scene.add.circle(0, 0, CIRCLE_RADIUS, 0xffff00);
      circle.setStrokeStyle(1, 0xffffff, 0.8);
      this.circles.push(circle);
      this.container.add(circle);
    }

    // Start animation
    this.startAnimation(scene);
  }

  private startAnimation(scene: Phaser.Scene): void {
    scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 1500,
      repeat: -1,
      onUpdate: (tween) => {
        this.angle = tween.getValue() ?? 0;
        this.updateCirclePositions();
      },
    });
  }

  private updateCirclePositions(): void {
    for (let i = 0; i < NUM_CIRCLES; i++) {
      // Evenly space circles around the ellipse
      const circleAngle = this.angle + (i * Math.PI * 2) / NUM_CIRCLES;
      const x = Math.cos(circleAngle) * ELLIPSE_WIDTH;
      const y = Math.sin(circleAngle) * ELLIPSE_HEIGHT;
      this.circles[i].setPosition(x, y);
    }
  }

  update(x: number, y: number): void {
    this.container.setPosition(x, y + VERTICAL_OFFSET);
  }

  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Factory function for creating debuff visuals
 */
export function createDebuffVisual(
  scene: Phaser.Scene,
  type: 'stun' | 'slow'
): DebuffVisual | null {
  switch (type) {
    case 'stun':
      return new StunVisual(scene);
    case 'slow':
      // Could add a slow visual later (e.g., blue tint, frost particles)
      return null;
    default:
      return null;
  }
}
