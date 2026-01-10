import Phaser from 'phaser';
import { Player } from '../../player';
import { Minion } from '../../minions';
import { StaminaBar } from '../ui/StaminaBar';

export class LevelScene extends Phaser.Scene {
  private player?: Player;
  private staminaBar?: StaminaBar;
  private minions: Minion[] = [];
  private selectedMinion?: Minion;

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

    // Camera follows player with deadzone (Pikmin-style)
    // Camera doesn't move until player moves 100px from center
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setDeadzone(100, 100);

    // Create UI
    this.staminaBar = new StaminaBar(this);

    // Spawn a test minion near the player
    const minion = new Minion(this, worldWidth / 2 + 100, worldHeight / 2 + 50);
    this.minions.push(minion);

    // Setup minion selection handling
    this.minions.forEach(minion => {
      minion.on('pointerdown', () => {
        // Deselect all other minions
        this.minions.forEach(m => m.deselect());
        // Select this minion
        minion.select();
        this.selectedMinion = minion;
      });
    });

    // Setup right-click to move selected minion
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.selectedMinion) {
        // Get world position (accounting for camera)
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        this.selectedMinion.moveTo(worldX, worldY);
      }
    });

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD/Arrows: Move | Shift: Sprint | Left-Click: Select Minion | Right-Click: Move Minion',
      {
        fontSize: '12px',
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

    // Update all minions
    this.minions.forEach(minion => minion.update());
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
