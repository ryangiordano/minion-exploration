import Phaser from 'phaser';
import { Followable } from '../../../core/types/interfaces';

const TREASURE_RADIUS = 14;

export class Treasure extends Phaser.GameObjects.Container implements Followable {
  private collected = false;
  private value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1) {
    super(scene, x, y);

    this.value = value;

    // Add to scene
    scene.add.existing(this);

    // Create visual (gold essence, larger than decorations)
    const circle = scene.add.circle(0, 0, TREASURE_RADIUS, 0xffd700); // Gold color
    circle.setStrokeStyle(2, 0xb8860b); // Darker gold outline
    this.add(circle);

    // Make interactive for click detection
    this.setSize(TREASURE_RADIUS * 2, TREASURE_RADIUS * 2);
    this.setInteractive({ useHandCursor: true });
  }

  public getRadius(): number {
    return TREASURE_RADIUS;
  }

  public isCollected(): boolean {
    return this.collected;
  }

  public getValue(): number {
    return this.value;
  }

  public collect(): number {
    if (this.collected) {
      return 0;
    }

    this.collected = true;
    this.destroy();
    return this.value;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
