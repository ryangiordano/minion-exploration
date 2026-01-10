import Phaser from 'phaser';
import { InteractiveCircle } from '../objects/InteractiveCircle';

export class ExampleScene extends Phaser.Scene {
  private circle?: InteractiveCircle;

  constructor() {
    super({ key: 'ExampleScene' });
  }

  preload(): void {
    // Load assets for this feature here
  }

  create(): void {
    // Add welcome text
    const text = this.add.text(400, 300, 'Phaser 3 + TypeScript', {
      fontSize: '32px',
      color: '#fff'
    });
    text.setOrigin(0.5);

    // Create interactive circle
    this.circle = new InteractiveCircle(this, 400, 400, 50);
  }

  update(time: number, delta: number): void {
    if (this.circle) {
      this.circle.update(time, delta);
    }
  }
}
