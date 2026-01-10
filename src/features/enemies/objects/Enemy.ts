import Phaser from 'phaser';
import { Followable } from '../../../core/types/interfaces';

const ENEMY_RADIUS = 16;

export class Enemy extends Phaser.GameObjects.Container implements Followable {
  private defeated = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Add to scene
    scene.add.existing(this);

    // Create visual (red circle)
    const circle = scene.add.circle(0, 0, ENEMY_RADIUS, 0xff4444); // Red color
    circle.setStrokeStyle(2, 0xaa0000); // Darker red outline
    this.add(circle);

    // Make interactive for click detection
    this.setSize(ENEMY_RADIUS * 2, ENEMY_RADIUS * 2);
    this.setInteractive({ useHandCursor: true });
  }

  public getRadius(): number {
    return ENEMY_RADIUS;
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  public defeat(): void {
    if (this.defeated) {
      return;
    }

    this.defeated = true;
    this.destroy();
  }
}
