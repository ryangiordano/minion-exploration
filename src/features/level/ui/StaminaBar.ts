import Phaser from 'phaser';

export class StaminaBar {
  private scene: Phaser.Scene;
  private label: Phaser.GameObjects.Text;
  private background: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;

  private readonly barWidth = 200;
  private readonly barHeight = 20;
  private readonly x = 10;
  private readonly y = 550;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create label
    this.label = this.scene.add.text(this.x, this.y - 20, 'Stamina', {
      fontSize: '14px',
      color: '#ffffff'
    });
    this.label.setScrollFactor(0);

    // Create background
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.5);
    this.background.fillRect(this.x, this.y, this.barWidth, this.barHeight);
    this.background.setScrollFactor(0);

    // Create foreground bar
    this.bar = this.scene.add.graphics();
    this.bar.setScrollFactor(0);
  }

  public update(staminaPercent: number): void {
    // Clear and redraw
    this.bar.clear();

    // Color based on stamina levelwd
    let color = 0x4caf50; // Green
    if (staminaPercent < 0.3) color = 0xf44336; // Red
    else if (staminaPercent < 0.6) color = 0xff9800; // Orange

    this.bar.fillStyle(color, 1);
    this.bar.fillRect(this.x, this.y, this.barWidth * staminaPercent, this.barHeight);
  }

  public destroy(): void {
    this.label.destroy();
    this.background.destroy();
    this.bar.destroy();
  }
}
