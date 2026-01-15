import Phaser from 'phaser';

export class CurrencyDisplay {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private currency = 0;
  private scene: Phaser.Scene;
  private baseX: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Position in bottom-right
    const padding = 10;
    this.baseX = scene.cameras.main.width - padding;
    const y = scene.cameras.main.height - padding;

    this.text = scene.add.text(0, 0, 'Essence: 0', {
      fontSize: '16px',
      color: '#ffd700',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
    });
    this.text.setOrigin(1, 1);

    this.container = scene.add.container(this.baseX, y, [this.text]);
    this.container.setScrollFactor(0);
  }

  public add(value: number): void {
    this.currency += value;
    this.updateDisplay();
  }

  public spend(amount: number): boolean {
    if (this.currency >= amount) {
      this.currency -= amount;
      this.updateDisplay();
      return true;
    }
    this.shakeInsufficient();
    return false;
  }

  public getAmount(): number {
    return this.currency;
  }

  public canAfford(amount: number): boolean {
    return this.currency >= amount;
  }

  private updateDisplay(): void {
    this.text.setText(`Essence: ${this.currency}`);
  }

  /** Shake the display when player can't afford something */
  private shakeInsufficient(): void {
    // Stop any existing shake
    this.scene.tweens.killTweensOf(this.container);
    this.container.x = this.baseX;

    // Quick horizontal shake
    this.scene.tweens.add({
      targets: this.container,
      x: this.baseX - 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        this.container.x = this.baseX;
      },
    });
  }

  /** Pop scale effect when essence is collected */
  public pop(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(1);

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 80,
      yoyo: true,
      ease: 'Back.out',
    });
  }

  /** Get the screen position where essence should fly to */
  public getTargetPosition(): { x: number; y: number } {
    return {
      x: this.baseX - this.text.width / 2,
      y: this.scene.cameras.main.height - 10 - this.text.height / 2,
    };
  }

  public destroy(): void {
    this.container.destroy();
  }
}
