import Phaser from 'phaser';
import { DebuffVisual, DebuffType } from './DebuffManager';

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
  type: DebuffType
): DebuffVisual | null {
  switch (type) {
    case 'stun':
      return new StunVisual(scene);
    case 'slow':
      // Could add a slow visual later (e.g., blue tint, frost particles)
      return null;
    case 'poison':
      return new PoisonVisual(scene);
    default:
      return null;
  }
}

const POISON_VERTICAL_OFFSET = -10;

/**
 * Visual effect for poison: green bubbles rising from the entity
 */
export class PoisonVisual implements DebuffVisual {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);

    // Spawn bubbles periodically
    this.spawnTimer = scene.time.addEvent({
      delay: 300,
      callback: () => this.spawnBubble(),
      loop: true,
    });

    // Spawn a few initial bubbles
    for (let i = 0; i < 3; i++) {
      this.spawnBubble();
    }
  }

  private spawnBubble(): void {
    const x = Phaser.Math.Between(-12, 12);
    const startY = Phaser.Math.Between(-5, 5);
    const size = Phaser.Math.Between(2, 4);

    const bubble = this.scene.add.circle(x, startY, size, 0x44ff44, 0.7);
    this.container.add(bubble);

    // Float up and fade out
    this.scene.tweens.add({
      targets: bubble,
      y: startY - 25,
      alpha: 0,
      duration: 800 + Math.random() * 400,
      ease: 'Quad.easeOut',
      onComplete: () => bubble.destroy(),
    });
  }

  update(x: number, y: number): void {
    this.container.setPosition(x, y + POISON_VERTICAL_OFFSET);
  }

  destroy(): void {
    this.spawnTimer?.destroy();
    this.container.destroy();
  }
}
