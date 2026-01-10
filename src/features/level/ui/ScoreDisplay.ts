import Phaser from 'phaser';

export class ScoreDisplay {
  private text: Phaser.GameObjects.Text;
  private score = 0;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(10, 35, 'Score: 0', {
      fontSize: '16px',
      color: '#ffd700',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    });
    this.text.setScrollFactor(0); // Fixed to camera
  }

  public addScore(value: number): void {
    this.score += value;
    this.text.setText(`Score: ${this.score}`);
  }

  public getScore(): number {
    return this.score;
  }

  public destroy(): void {
    this.text.destroy();
  }
}
