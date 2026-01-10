import Phaser from 'phaser';
import { TargetedMovement } from '../../../core/components/TargetedMovement';

export class Minion extends Phaser.Physics.Arcade.Sprite {
  private isSelected = false;
  private selectionCircle?: Phaser.GameObjects.Graphics;
  private movement!: TargetedMovement; // Initialized after super()

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (small green circle for MVP)
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x50c878, 1); // Emerald green
    graphics.fillCircle(10, 10, 10); // Draw at center of texture
    graphics.generateTexture('minion', 20, 20);
    graphics.destroy();

    this.setTexture('minion');

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup movement component
    this.movement = new TargetedMovement(this, {
      speed: 120,
      arrivalDistance: 10,
      slowdownDistance: 80,
      minSpeedScale: 0.3
    });

    // Make interactive
    this.setInteractive({ useHandCursor: true });

    // Create selection indicator (invisible by default)
    this.selectionCircle = scene.add.graphics();
    this.selectionCircle.lineStyle(2, 0xffff00, 1); // Yellow outline
    this.selectionCircle.strokeCircle(0, 0, 14);
    this.selectionCircle.setVisible(false);

    // Setup click handler for selection
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.select();
      }
    });
  }

  public select(): void {
    this.isSelected = true;
    this.selectionCircle?.setVisible(true);
  }

  public deselect(): void {
    this.isSelected = false;
    this.selectionCircle?.setVisible(false);
  }

  public getSelected(): boolean {
    return this.isSelected;
  }

  public moveTo(x: number, y: number): void {
    this.movement.moveTo(x, y);
  }

  public stopMoving(): void {
    this.movement.stop();
  }

  update(): void {
    // Update selection circle position to follow minion
    if (this.selectionCircle) {
      this.selectionCircle.setPosition(this.x, this.y);
    }

    // Update movement component
    this.movement.update();
  }

  destroy(fromScene?: boolean): void {
    this.selectionCircle?.destroy();
    super.destroy(fromScene);
  }
}
