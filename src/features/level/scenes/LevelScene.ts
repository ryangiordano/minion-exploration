import Phaser from 'phaser';
import { Player } from '../../player';
import { StaminaBar } from '../ui/StaminaBar';

export class LevelScene extends Phaser.Scene {
  private player?: Player;
  private staminaBar?: StaminaBar;

  constructor() {
    super({ key: 'LevelScene' });
  }

  create(): void {
    // Create a larger world than the visible area
    const worldWidth = 1600;
    const worldHeight = 1200;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Add background color
    this.cameras.main.setBackgroundColor('#2d4a3e');

    // Set camera bounds to match world
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // Add visual reference grid
    this.createReferenceGrid(worldWidth, worldHeight);

    // Create player in center of world
    this.player = new Player(this, worldWidth / 2, worldHeight / 2);

    // Camera follows player with smooth delay
    // Parameters: (target, roundPixels, lerpX, lerpY)
    // Lower lerp values (0.05) = more delay/smoothness
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

    // Create UI
    this.staminaBar = new StaminaBar(this);

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD/Arrows: Move | Hold Shift: Sprint',
      {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      }
    );
    instructions.setScrollFactor(0); // Fixed to camera
  }

  update(_: number, delta: number): void {
    if (this.player) {
      this.player.update(delta);

      if (this.staminaBar) {
        this.staminaBar.update(this.player.getStaminaPercentage());
      }
    }
  }

  private createReferenceGrid(worldWidth: number, worldHeight: number): void {
    const graphics = this.add.graphics();
    const gridSize = 100;

    // Draw grid lines
    graphics.lineStyle(1, 0x1a2f24, 0.5);

    // Vertical lines
    for (let x = 0; x <= worldWidth; x += gridSize) {
      graphics.lineBetween(x, 0, x, worldHeight);
    }

    // Horizontal lines
    for (let y = 0; y <= worldHeight; y += gridSize) {
      graphics.lineBetween(0, y, worldWidth, y);
    }

    // Add some scattered reference objects (rocks/trees)
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(50, worldWidth - 50);
      const y = Phaser.Math.Between(50, worldHeight - 50);
      const size = Phaser.Math.Between(8, 20);
      const color = Phaser.Math.Between(0, 1) === 0 ? 0x3d5a46 : 0x556b58;

      const circle = this.add.circle(x, y, size, color);
      circle.setAlpha(0.6);
    }
  }
}
