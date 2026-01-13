import Phaser from 'phaser';
import { Minion } from '../../minions';
import { Treasure } from '../../treasure';
import { Enemy, TargetDummy } from '../../enemies';
import { CombatManager, CombatXpTracker, GameEventManager, EdgeScrollCamera, CursorTarget } from '../../../core/components';
import { KnockbackGem, HealPulseGem, VitalityGem, RangedAttackGem } from '../../../core/abilities';

export class LevelScene extends Phaser.Scene {
  private minions: Minion[] = [];
  private treasures: Treasure[] = [];
  private enemies: Enemy[] = [];
  private targetDummies: TargetDummy[] = [];
  private combatManager = new CombatManager();
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private eventManager?: GameEventManager;

  // New control scheme
  private edgeScrollCamera!: EdgeScrollCamera;
  private cursorTarget!: CursorTarget;

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

    // Setup cursor target for minions to follow
    this.cursorTarget = new CursorTarget(this);

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

    // Setup spacebar whistle
    this.setupWhistle();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'Space: Whistle minions to cursor | Mouse edges: Pan camera',
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

    // Update cursor target position
    this.cursorTarget.update();

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
  }

  private setupWhistle(): void {
    if (!this.input.keyboard) return;

    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => {
      // Send WHISTLE event to all minions with cursor as target
      this.minions.forEach(minion => {
        minion.send({ type: 'WHISTLE', cursorTarget: this.cursorTarget });
      });

      // Visual feedback - expanding ring at cursor
      this.showWhistleEffect(this.cursorTarget.x, this.cursorTarget.y);
    });
  }

  private showWhistleEffect(x: number, y: number): void {
    const circle = this.add.circle(x, y, 20, 0xffff00, 0);
    circle.setStrokeStyle(4, 0xffff00, 0.9);

    this.tweens.add({
      targets: circle,
      radius: 150,
      alpha: 0,
      duration: 400,
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
    });

    return minion;
  }

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(100, worldWidth - 100);
      const y = Phaser.Math.Between(100, worldHeight - 100);

      const treasure = new Treasure(this, x, y);
      this.treasures.push(treasure);
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

    return dummy;
  }

  public getEventManager(): GameEventManager | undefined {
    return this.eventManager;
  }
}
