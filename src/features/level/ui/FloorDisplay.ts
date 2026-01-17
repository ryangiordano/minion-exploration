import Phaser from 'phaser';

/** Simple UI element showing current floor number */
export class FloorDisplay {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number = 10, y: number = 50) {
    this.text = scene.add.text(x, y, 'Floor 1', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.text.setScrollFactor(0);
    this.text.setDepth(100);
  }

  setFloor(floor: number): void {
    this.text.setText(`Floor ${floor}`);
  }

  destroy(): void {
    this.text.destroy();
  }
}
