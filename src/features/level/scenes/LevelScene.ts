import Phaser from 'phaser';
import { Minion } from '../../minions';
import { Treasure } from '../../treasure';
import { Enemy, TargetDummy } from '../../enemies';
import { CombatManager, CombatXpTracker, GameEventManager, EdgeScrollCamera, WhistleSelection, SelectionManager } from '../../../core/components';
import { KnockbackGem, HealPulseGem, VitalityGem, RangedAttackGem } from '../../../core/abilities';
import { Combatable } from '../../../core/types/interfaces';

// Visual feedback colors
const CLICK_COLORS = {
  move: 0xffff00,     // Yellow - move to location
  attack: 0xff4444,   // Red - attack enemy
  collect: 0x50c878,  // Green - collect treasure
} as const;

export class LevelScene extends Phaser.Scene {
  private minions: Minion[] = [];
  private treasures: Treasure[] = [];
  private enemies: Enemy[] = [];
  private targetDummies: TargetDummy[] = [];
  private combatManager = new CombatManager();
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private eventManager?: GameEventManager;

  // Camera control
  private edgeScrollCamera!: EdgeScrollCamera;

  // Selection
  private selectionManager = new SelectionManager();
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

    // Center camera initially
    this.cameras.main.scrollX = (worldWidth - this.cameras.main.width) / 2;
    this.cameras.main.scrollY = (worldHeight - this.cameras.main.height) / 2;

    // Setup edge-scroll camera (RTS-style)
    this.edgeScrollCamera = new EdgeScrollCamera(this, {
      edgeSize: 50,
      scrollSpeed: 400,
    });

    // Add visual reference grid
    this.createReferenceGrid(worldWidth, worldHeight);

    // Event manager for floating text and other UI feedback
    this.eventManager = new GameEventManager(this);

    // Spawn treasures around the world
    this.spawnTreasures(worldWidth, worldHeight);

    // Spawn enemies around the world
    this.spawnEnemies(worldWidth, worldHeight);

    // Spawn a target dummy near center for ability testing
    this.spawnTargetDummy(worldWidth / 2 + 200, worldHeight / 2);

    // Spawn minions near center with different gems
    const minionPositions = [
      { x: worldWidth / 2 + 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2 - 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2, y: worldHeight / 2 + 100 },
      { x: worldWidth / 2, y: worldHeight / 2 - 100 }
    ];

    const testGems = [
      new KnockbackGem(),
      new HealPulseGem(),
      new VitalityGem(),
      new RangedAttackGem(),
    ];

    minionPositions.forEach((pos, index) => {
      const minion = this.spawnMinion(pos.x, pos.y);
      if (testGems[index]) {
        minion.equipGem(testGems[index]);
      }
    });

    // Setup whistle selection (hold Space to grow selection circle)
    this.setupWhistleSelection();

    // Setup click controls
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'Hold Space: Select | Left-click: Deselect | Right-click: Move/Attack | Mouse edges: Pan',
      {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      }
    );
    instructions.setScrollFactor(0);
  }

  update(_time: number, delta: number): void {
    // Update edge-scroll camera
    this.edgeScrollCamera.update(delta);

    // Update whistle selection animation
    this.whistleSelection?.update(delta);

    // Get active entities
    const activeMinions = this.minions.filter(m => !m.isDefeated());
    const activeEnemies = this.enemies.filter(e => !e.isDefeated());

    // Update all minions
    this.minions.forEach(minion => {
      minion.setNearbyEnemies(activeEnemies);
      minion.setNearbyAllies(activeMinions);
      minion.update(delta);
    });

    // Update all enemies
    this.enemies.forEach(enemy => {
      enemy.setNearbyTargets(activeMinions);
      enemy.update(delta);
    });

    // Check for treasure collection
    this.checkTreasureCollection(activeMinions);
  }

  private checkTreasureCollection(minions: Minion[]): void {
    const collectDistance = 25; // Distance at which treasure is collected

    for (let i = this.treasures.length - 1; i >= 0; i--) {
      const treasure = this.treasures[i];
      if (treasure.isCollected()) continue;

      for (const minion of minions) {
        const dist = Phaser.Math.Distance.Between(minion.x, minion.y, treasure.x, treasure.y);
        if (dist < collectDistance) {
          treasure.collect();
          this.treasures.splice(i, 1);
          this.showClickEffect(treasure.x, treasure.y, CLICK_COLORS.collect);
          break;
        }
      }
    }
  }

  private setupWhistleSelection(): void {
    this.whistleSelection = new WhistleSelection(this, {
      maxRadius: 150,
      growRate: 200,
    })
      .bindKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .setSelectableSource(() => this.minions)
      .onSelect((units) => {
        // Clear previous selection and select new units
        this.selectionManager.clearSelection();
        this.selectionManager.addMultipleToSelection(units as Minion[]);
      });
  }

  private setupClickControls(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left-click = deselect all
      if (pointer.leftButtonDown()) {
        this.selectionManager.clearSelection();
      }

      // Right-click on background = move command for selected minions
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        this.getSelectedMinions().forEach(minion => {
          // Scatter minions around the target point
          const offset = this.getScatterOffset();
          minion.send({ type: 'MOVE_TO', x: pointer.worldX + offset.x, y: pointer.worldY + offset.y });
        });
        this.showClickEffect(pointer.worldX, pointer.worldY, CLICK_COLORS.move);
      }
    });
  }

  /** Get a random offset for scattering minions around a target point */
  private getScatterOffset(radius: number = 30): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  }

  private getSelectedMinions(): Minion[] {
    return this.minions.filter(m => m.isSelected());
  }

  private commandAttack(target: Combatable): void {
    if (!this.selectionManager.hasSelection()) return;

    this.getSelectedMinions().forEach(minion => {
      minion.send({ type: 'ATTACK', target });
    });
    this.showClickEffect(target.x, target.y, CLICK_COLORS.attack);
  }

  private showClickEffect(x: number, y: number, color: number): void {
    const circle = this.add.circle(x, y, 30, color, 0);
    circle.setStrokeStyle(3, color, 0.8);

    this.tweens.add({
      targets: circle,
      radius: 8,
      alpha: 0,
      duration: 250,
      ease: 'Power2',
      onUpdate: () => {
        circle.setRadius(circle.radius);
      },
      onComplete: () => {
        circle.destroy();
      }
    });
  }

  private createReferenceGrid(worldWidth: number, worldHeight: number): void {
    const graphics = this.add.graphics();
    const gridSize = 100;

    graphics.lineStyle(1, 0x1a2f24, 0.5);

    for (let x = 0; x <= worldWidth; x += gridSize) {
      graphics.lineBetween(x, 0, x, worldHeight);
    }

    for (let y = 0; y <= worldHeight; y += gridSize) {
      graphics.lineBetween(0, y, worldWidth, y);
    }

    // Scattered reference objects
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(50, worldWidth - 50);
      const y = Phaser.Math.Between(50, worldHeight - 50);
      const size = Phaser.Math.Between(8, 20);
      const color = Phaser.Math.Between(0, 1) === 0 ? 0x3d5a46 : 0x556b58;

      const circle = this.add.circle(x, y, size, color);
      circle.setAlpha(0.6);
    }
  }

  private spawnMinion(x: number, y: number): Minion {
    const minion = new Minion(this, x, y, {
      combatManager: this.combatManager,
      xpTracker: this.xpTracker,
    });
    this.minions.push(minion);

    // Handle death
    minion.onDeath(() => {
      const index = this.minions.indexOf(minion);
      if (index > -1) {
        this.minions.splice(index, 1);
      }
      this.selectionManager.removeFromSelection(minion);
    });

    return minion;
  }

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(100, worldWidth - 100);
      const y = Phaser.Math.Between(100, worldHeight - 100);

      const treasure = new Treasure(this, x, y);
      this.treasures.push(treasure);

      // Right-click on treasure = move selected minions to collect
      treasure.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
          this.getSelectedMinions().forEach(minion => {
            const offset = this.getScatterOffset();
            minion.send({ type: 'MOVE_TO', x: treasure.x + offset.x, y: treasure.y + offset.y });
          });
          this.showClickEffect(treasure.x, treasure.y, CLICK_COLORS.collect);
          event.stopPropagation();
        }
      });
    }
  }

  private spawnEnemies(worldWidth: number, worldHeight: number): void {
    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;
    const safeRadius = 400;

    // Cluster 1: 4 level 1 enemies
    this.spawnEnemyCluster(centerX, centerY, safeRadius, worldWidth, worldHeight, 4, 1);

    // Cluster 2: 3 level 1 enemies
    this.spawnEnemyCluster(centerX, centerY, safeRadius, worldWidth, worldHeight, 3, 1);

    // Cluster 3: 3 level 2 enemies
    this.spawnEnemyCluster(centerX, centerY, safeRadius + 100, worldWidth, worldHeight, 3, 2);
  }

  private spawnEnemyCluster(
    avoidX: number, avoidY: number, minDistance: number,
    worldWidth: number, worldHeight: number,
    count: number, level: number
  ): void {
    const center = this.getSpawnPositionAwayFrom(avoidX, avoidY, minDistance, worldWidth, worldHeight);
    const clusterRadius = 50;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = Phaser.Math.Between(10, clusterRadius);
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      this.spawnEnemy(x, y, level);
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

    enemy.onDeath((deadEnemy) => {
      this.xpTracker.distributeXp(deadEnemy);
      const index = this.enemies.indexOf(deadEnemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    });

    // Right-click on enemy = attack command for selected minions
    enemy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.rightButtonDown()) {
        this.commandAttack(enemy);
        event.stopPropagation();
      }
    });

    return enemy;
  }

  private spawnTargetDummy(x: number, y: number): TargetDummy {
    const dummy = new TargetDummy(this, x, y, { maxHp: 100 });
    this.targetDummies.push(dummy);

    dummy.onDeath((deadDummy) => {
      const index = this.targetDummies.indexOf(deadDummy);
      if (index > -1) {
        this.targetDummies.splice(index, 1);
      }
    });

    // Right-click on dummy = attack command for selected minions
    dummy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.rightButtonDown()) {
        this.commandAttack(dummy);
        event.stopPropagation();
      }
    });

    return dummy;
  }

  public getEventManager(): GameEventManager | undefined {
    return this.eventManager;
  }
}
