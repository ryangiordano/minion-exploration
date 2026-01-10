import Phaser from 'phaser';

export class Treasure extends Phaser.GameObjects.Container {
  private collected = false;
  private value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, value = 1) {
    super(scene, x, y);

    this.value = value;

    // Add to scene
    scene.add.existing(this);

    // Create visual (gold circle, larger than decorations)
    const circle = scene.add.circle(0, 0, 14, 0xffd700); // Gold color
    circle.setStrokeStyle(2, 0xb8860b); // Darker gold outline
    this.add(circle);

    // Make interactive for click detection
    this.setSize(28, 28);
    this.setInteractive({ useHandCursor: true });
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
