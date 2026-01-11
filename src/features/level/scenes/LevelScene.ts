import Phaser from 'phaser';
import { Player } from '../../player';
import { Minion } from '../../minions';
import { Treasure } from '../../treasure';
import { Enemy } from '../../enemies';
import { StaminaBar } from '../ui/StaminaBar';
import { ScoreDisplay } from '../ui/ScoreDisplay';
import { SelectionManager } from '../../../core/components';
import { MoveCommand, CollectCommand, AttackCommand } from '../../../core/commands';

// Command pulse colors by action type
const PULSE_COLORS = {
  move: 0xffff00,     // Yellow - move to location
  collect: 0x50c878,  // Green - collect treasure
  attack: 0xff4444,   // Red - attack enemy (future)
} as const;

export class LevelScene extends Phaser.Scene {
  private player?: Player;
  private staminaBar?: StaminaBar;
  private scoreDisplay?: ScoreDisplay;
  private minions: Minion[] = [];
  private treasures: Treasure[] = [];
  private enemies: Enemy[] = [];
  private selectionManager = new SelectionManager();
  private whistleRadius = 100;
  private whistleCircle?: Phaser.GameObjects.Graphics;
  private spaceKey?: Phaser.Input.Keyboard.Key;

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
    this.scoreDisplay = new ScoreDisplay(this);

    // Spawn treasures around the world
    this.spawnTreasures(worldWidth, worldHeight);

    // Spawn enemies around the world
    this.spawnEnemies(worldWidth, worldHeight);

    // Spawn multiple test minions near the player
    const minionPositions = [
      { x: worldWidth / 2 + 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2 - 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2, y: worldHeight / 2 + 100 }
    ];

    minionPositions.forEach(pos => {
      const minion = new Minion(this, pos.x, pos.y);
      this.minions.push(minion);

      // Setup selection handling
      minion.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (pointer.leftButtonDown()) {
          // Shift-click for multi-select, regular click for single select
          if (this.input.keyboard && this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT).isDown) {
            this.selectionManager.toggleSelection(minion);
          } else {
            this.selectionManager.select(minion);
          }
          // Stop event from propagating to background click
          event.stopPropagation();
        }
      });
    });

    // Setup background click handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        // Show click feedback
        this.showClickPulse(pointer.worldX, pointer.worldY);
        // Issue move command to all selected units
        const moveCommand = new MoveCommand(pointer.worldX, pointer.worldY);
        this.selectionManager.issueCommand(moveCommand);
      } else if (pointer.leftButtonDown()) {
        // Left-click on background clears selection
        this.selectionManager.clearSelection();
      }
    });

    // Setup whistle selection (Space key)
    this.setupWhistleSelection();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD/Arrows: Move | Shift: Sprint | Click: Select | Space: Whistle Select | Right-Click: Command',
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

    // Update all minions with delta time for combat cooldowns
    this.minions.forEach(minion => minion.update(delta));
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

  private setupWhistleSelection(): void {
    // Create whistle circle graphic (hidden by default)
    this.whistleCircle = this.add.graphics();
    this.whistleCircle.setVisible(false);

    // Setup Space key
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

      this.spaceKey.on('down', () => {
        // Show whistle circle
        this.updateWhistleCircle();
        this.whistleCircle?.setVisible(true);

        // Select all minions within radius of cursor
        const pointer = this.input.activePointer;
        const minionsInRadius = this.minions.filter(minion => {
          const distance = Phaser.Math.Distance.Between(
            pointer.worldX, pointer.worldY,
            minion.x, minion.y
          );
          return distance <= this.whistleRadius;
        });

        // Replace selection with minions in radius
        this.selectionManager.clearSelection();
        this.selectionManager.selectMultiple(minionsInRadius);
      });

      this.spaceKey.on('up', () => {
        // Hide whistle circle
        this.whistleCircle?.setVisible(false);
      });
    }
  }

  private updateWhistleCircle(): void {
    if (!this.whistleCircle) return;

    const pointer = this.input.activePointer;
    this.whistleCircle.clear();
    this.whistleCircle.lineStyle(3, 0xffff00, 0.8);
    this.whistleCircle.strokeCircle(pointer.worldX, pointer.worldY, this.whistleRadius);
    this.whistleCircle.fillStyle(0xffff00, 0.1);
    this.whistleCircle.fillCircle(pointer.worldX, pointer.worldY, this.whistleRadius);
  }

  private showClickPulse(x: number, y: number, color: number = PULSE_COLORS.move): void {
    const circle = this.add.circle(x, y, 40, color, 0);
    circle.setStrokeStyle(2, color, 0.8);

    // Shrink and fade out
    this.tweens.add({
      targets: circle,
      radius: 5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onUpdate: () => {
        // Redraw the circle at new radius
        circle.setRadius(circle.radius);
      },
      onComplete: () => {
        circle.destroy();
      }
    });
  }

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    // Spawn 10 treasures randomly around the world
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(100, worldWidth - 100);
      const y = Phaser.Math.Between(100, worldHeight - 100);

      const treasure = new Treasure(this, x, y);
      this.treasures.push(treasure);

      // Setup right-click to collect
      treasure.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
          // Show collect feedback
          this.showClickPulse(treasure.x, treasure.y, PULSE_COLORS.collect);
          const collectCommand = new CollectCommand(treasure, (value) => {
            this.scoreDisplay?.addScore(value);
            // Remove from treasures array
            const index = this.treasures.indexOf(treasure);
            if (index > -1) {
              this.treasures.splice(index, 1);
            }
          });
          this.selectionManager.issueCommand(collectCommand);
          event.stopPropagation();
        }
      });
    }
  }

  private spawnEnemies(worldWidth: number, worldHeight: number): void {
    // Spawn 5 enemies randomly around the world
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(100, worldWidth - 100);
      const y = Phaser.Math.Between(100, worldHeight - 100);

      const enemy = new Enemy(this, x, y, { maxHp: 10 });
      this.enemies.push(enemy);

      // Setup right-click to attack
      enemy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
          // Show attack feedback
          this.showClickPulse(enemy.x, enemy.y, PULSE_COLORS.attack);
          const attackCommand = new AttackCommand(enemy, () => {
            // Remove from enemies array
            const index = this.enemies.indexOf(enemy);
            if (index > -1) {
              this.enemies.splice(index, 1);
            }
          });
          this.selectionManager.issueCommand(attackCommand);
          event.stopPropagation();
        }
      });
    }
  }
}
