import Phaser from 'phaser';
import { Player } from '../../player';
import { Minion } from '../../minions';
import { Treasure } from '../../treasure';
import { Enemy, TargetDummy } from '../../enemies';
import { StaminaBar } from '../ui/StaminaBar';
import { ScoreDisplay } from '../ui/ScoreDisplay';
import { SelectionManager, WhistleSelection, CombatManager, CombatXpTracker } from '../../../core/components';
import { MoveCommand, CollectCommand, AttackCommand, FollowCommand } from '../../../core/commands';
import { VitalityGem, KnockbackGem, HealPulseGem, RangedAttackGem } from '../../../core/abilities';

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
  private targetDummies: TargetDummy[] = [];
  private selectionManager = new SelectionManager();
  private combatManager = new CombatManager();
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private whistleSelection?: WhistleSelection;

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

    // Spawn a target dummy near the player for ability testing
    this.spawnTargetDummy(worldWidth / 2 + 200, worldHeight / 2);

    // Spawn multiple test minions near the player
    const minionPositions = [
      { x: worldWidth / 2 + 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2 - 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2, y: worldHeight / 2 + 100 },
      { x: worldWidth / 2, y: worldHeight / 2 - 100 }
    ];

    // Spawn minions with different gems for testing
    const testGems = [
      new KnockbackGem(),      // First minion (right): knockback attacks
      new HealPulseGem(),      // Second minion (left): auto-heals allies
      new VitalityGem(),       // Third minion (bottom): +2 max HP
      new RangedAttackGem(),   // Fourth minion (top): ranged projectiles
    ];

    minionPositions.forEach((pos, index) => {
      const minion = this.spawnMinion(pos.x, pos.y);
      if (testGems[index]) {
        minion.equipGem(testGems[index]);
      }
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

    // Setup follow command (F key)
    this.setupFollowCommand();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD/Arrows: Move | Shift: Sprint | Click: Select | Space: Whistle | F: Follow | Right-Click: Command',
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

    // Get active (non-defeated) entities for aggro detection
    const activeMinions = this.minions.filter(m => !m.isDefeated());
    const activeEnemies = this.enemies.filter(e => !e.isDefeated());

    // Update all minions with delta time for combat cooldowns
    this.minions.forEach(minion => {
      minion.setNearbyEnemies(activeEnemies);
      minion.setNearbyAllies(activeMinions);
      minion.update(delta);
    });

    // Update all enemies (for fighting back and aggro detection)
    this.enemies.forEach(enemy => {
      enemy.setNearbyTargets(activeMinions);
      enemy.update(delta);
    });

    // Update whistle selection animation
    this.whistleSelection?.update(delta);
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
    this.whistleSelection = new WhistleSelection(this)
      .bindKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .setSelectableSource(() => this.minions)
      .onSelect((units) => {
        // Additive selection - don't clear existing
        this.selectionManager.addMultipleToSelection(units as Minion[]);
      });
  }

  private setupFollowCommand(): void {
    if (!this.input.keyboard) return;

    const fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on('down', () => {
      if (this.player && this.selectionManager.hasSelection()) {
        const followCommand = new FollowCommand(this.player);
        this.selectionManager.issueCommand(followCommand);
      }
    });
  }

  private spawnMinion(x: number, y: number): Minion {
    const minion = new Minion(this, x, y, {
      combatManager: this.combatManager,
      xpTracker: this.xpTracker,
    });
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

    // Handle death - remove from arrays
    minion.onDeath(() => {
      const index = this.minions.indexOf(minion);
      if (index > -1) {
        this.minions.splice(index, 1);
      }
      this.selectionManager.removeFromSelection(minion);
    });

    return minion;
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
    const playerSpawnX = worldWidth / 2;
    const playerSpawnY = worldHeight / 2;
    const safeRadius = 400; // Don't spawn enemies within this radius of player start

    // Spawn weak enemies (level 1) far from player - good for XP testing
    for (let i = 0; i < 3; i++) {
      const pos = this.getSpawnPositionAwayFrom(
        playerSpawnX, playerSpawnY, safeRadius,
        worldWidth, worldHeight
      );
      this.spawnEnemy(pos.x, pos.y, 1);
    }

    // Spawn medium enemies (level 3) even further
    for (let i = 0; i < 2; i++) {
      const pos = this.getSpawnPositionAwayFrom(
        playerSpawnX, playerSpawnY, safeRadius + 100,
        worldWidth, worldHeight
      );
      this.spawnEnemy(pos.x, pos.y, 3);
    }
  }

  private getSpawnPositionAwayFrom(
    avoidX: number, avoidY: number, minDistance: number,
    worldWidth: number, worldHeight: number
  ): { x: number; y: number } {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = Phaser.Math.Between(100, worldWidth - 100);
      y = Phaser.Math.Between(100, worldHeight - 100);
      attempts++;
    } while (
      Phaser.Math.Distance.Between(x, y, avoidX, avoidY) < minDistance &&
      attempts < 50
    );
    return { x, y };
  }

  private spawnEnemy(x: number, y: number, level: number): Enemy {
    const enemy = new Enemy(this, x, y, { level });
    this.enemies.push(enemy);

    // Handle enemy death - distribute XP and remove from array
    enemy.onDeath((deadEnemy) => {
      // Distribute XP to all minions that participated in this fight
      this.xpTracker.distributeXp(deadEnemy);

      // Remove from enemies array
      const index = this.enemies.indexOf(deadEnemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    });

    // Setup right-click to attack
    enemy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        // Show attack feedback
        this.showClickPulse(enemy.x, enemy.y, PULSE_COLORS.attack);
        const attackCommand = new AttackCommand(enemy, () => {
          // onDeath callback handles cleanup now
        });
        this.selectionManager.issueCommand(attackCommand);
        event.stopPropagation();
      }
    });

    return enemy;
  }

  private spawnTargetDummy(x: number, y: number): TargetDummy {
    const dummy = new TargetDummy(this, x, y, { maxHp: 100 });
    this.targetDummies.push(dummy);

    // Handle death - remove from array
    dummy.onDeath((deadDummy) => {
      const index = this.targetDummies.indexOf(deadDummy);
      if (index > -1) {
        this.targetDummies.splice(index, 1);
      }
    });

    // Setup right-click to attack (same as enemies)
    dummy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        this.showClickPulse(dummy.x, dummy.y, PULSE_COLORS.attack);
        const attackCommand = new AttackCommand(dummy, () => {});
        this.selectionManager.issueCommand(attackCommand);
        event.stopPropagation();
      }
    });

    return dummy;
  }
}
