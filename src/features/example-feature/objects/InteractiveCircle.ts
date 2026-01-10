import Phaser from 'phaser';

export class InteractiveCircle {
  private graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, color: number = 0x00ff00) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(x, y, radius);
    this.graphics.setInteractive(
      new Phaser.Geom.Circle(x, y, radius),
      Phaser.Geom.Circle.Contains
    );

    this.setupInteractions();
  }

  private setupInteractions(): void {
    this.graphics.on('pointerdown', () => {
      console.log('Circle clicked!');
    });
  }

  update(time: number, delta: number): void {
    // Update logic here if needed
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
