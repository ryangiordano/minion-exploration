import Phaser from 'phaser';
import { Treasure, EssenceDropper } from '../../treasure';
import { Enemy, EnemyTypeConfig } from '../../enemies';
import { CombatXpTracker, GameEventManager, CollectionPulse } from '../../../core/components';
import { TickSystem } from '../../../core/systems';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import { FloorDisplay } from '../ui/FloorDisplay';
import { WorldGem, GemDropper, InventoryState, getGemVisual } from '../../inventory';
import { GameState } from '../../../core/game-state';
import { LevelGenerator, LevelData } from '../../../core/level-generation';
import { FloorTransition, DefeatTransition } from '../../../core/floor-transition';
import { Vfx } from '../../../core/vfx';
import { CollectionSystem } from '../systems';
import { Portal } from '../objects/Portal';
import { Robot } from '../../robot';
import { SwarmManager } from '../../nanobots';
import { Combatable } from '../../../core/types/interfaces';
import { gameStore } from '../../../ui/store/gameStore';

export class LevelScene extends Phaser.Scene {
  // Main character
  private robot!: Robot;
  private swarmManager!: SwarmManager;

  private enemies: Enemy[] = [];
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private tickSystem = new TickSystem();
  private eventManager?: GameEventManager;

  // Currency
  private currencyDisplay!: CurrencyDisplay;
  private floorDisplay!: FloorDisplay;
  private readonly NANOBOT_COST = 5;

  // Loot
  private essenceDropper!: EssenceDropper;
  private gemDropper!: GemDropper;

  // Collection systems
  private treasureCollection = new CollectionSystem<Treasure>();
  private gemCollection = new CollectionSystem<WorldGem>();
  private collectionPulse!: CollectionPulse;

  // Inventory
  private inventory = new InventoryState();

  // Visual effects
  private vfx!: Vfx;

  // Roguelike state
  private gameState = new GameState();
  private levelGenerator = new LevelGenerator();
  private isTransitioning = false;
  private portal?: Portal;

  // World dimensions (stored for respawning)
  private worldWidth = 1600;
  private worldHeight = 1200;

  constructor() {
    super({ key: 'LevelScene' });
  }

  preload(): void {
    // Load robot spritesheet (2x2 grid, 128x128 frames, 4 expressions)
    this.load.spritesheet('robot', '/assets/robot/robot.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    // Load nanobot sprite (single image)
    this.load.image('nanobot', '/assets/nanobots/nanobot.png');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Add background color
    this.cameras.main.setBackgroundColor('#2d4a3e');

    // Set camera bounds to match world
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Add visual reference grid
    this.createReferenceGrid(this.worldWidth, this.worldHeight);

    // Event manager for floating text and other UI feedback
    this.eventManager = new GameEventManager(this);

    // Visual effects manager
    this.vfx = new Vfx(this);

    // Spawn treasures around the world
    this.spawnTreasures(this.worldWidth, this.worldHeight);

    // Spawn enemies from level generator
    this.spawnEnemiesFromLevelData();

    // Spawn robot and nanobots
    this.spawnRobotAndSwarm();

    // Setup controls
    this.setupNanobotCommandControls();
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD: Move | Q: Recall Nanobots | Left-Click: Send Nanobots | E: Spawn Nanobot | Space: Collect',
      {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      }
    );
    instructions.setScrollFactor(0);

    // Currency display
    this.currencyDisplay = new CurrencyDisplay(this);

    // Floor display
    this.floorDisplay = new FloorDisplay(this, 10, 50);
    this.floorDisplay.setFloor(this.gameState.getFloor());

    // Nanobot count display
    this.createNanobotDisplay();

    // Essence dropper for enemy loot
    this.essenceDropper = new EssenceDropper(this);

    // Gem dropper for ability gem drops
    this.gemDropper = new GemDropper(this);

    // Setup collection system callbacks
    this.setupCollectionSystems();

    // Setup collection pulse (spacebar)
    this.setupCollectionPulse();

    // Setup spawn nanobot key
    this.setupSpawnControls();
  }

  private nanobotCountText?: Phaser.GameObjects.Text;

  private createNanobotDisplay(): void {
    this.nanobotCountText = this.add.text(10, 75, '', {
      fontSize: '14px',
      color: '#88ccff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    });
    this.nanobotCountText.setScrollFactor(0);
    this.updateNanobotDisplay();
  }

  private updateNanobotDisplay(): void {
    if (this.nanobotCountText && this.swarmManager) {
      const count = this.swarmManager.getNanobotCount();
      const max = this.swarmManager.getMaxNanobots();
      this.nanobotCountText.setText(`Nanobots: ${count}/${max}`);
    }
  }

  update(_time: number, delta: number): void {
    // Update tick system (global heartbeat for DOTs, buffs, etc.)
    this.tickSystem.update(delta);

    // Get active enemies
    const activeEnemies = this.enemies.filter(e => !e.isDefeated());

    // Update robot
    if (!this.robot.isDefeated()) {
      this.robot.setNearbyEnemies(activeEnemies);
      this.robot.update(delta);
    }

    // Update swarm
    this.swarmManager.update(delta, activeEnemies);

    // Update all enemies - they target the robot and nanobots
    this.enemies.forEach(enemy => {
      const targets: Combatable[] = [];
      if (!this.robot.isDefeated()) {
        targets.push(this.robot);
      }
      targets.push(...this.swarmManager.getNanobots().filter(n => !n.isDefeated()));
      enemy.setNearbyTargets(targets);
      enemy.update(delta);
    });

    // Check for collections - robot collects items
    if (!this.robot.isDefeated()) {
      this.treasureCollection.update([this.robot]);
      this.gemCollection.update([this.robot]);
    }

    // Update collection pulse
    this.collectionPulse.update(delta);

    // Update nanobot count display
    this.updateNanobotDisplay();

    // Check portal collision (robot entering portal triggers floor transition)
    this.checkPortalCollision();

    // Check win/lose conditions (only if not already transitioning)
    if (!this.isTransitioning) {
      this.checkWinLoseConditions(activeEnemies);
    }
  }

  private checkPortalCollision(): void {
    if (!this.portal || this.portal.isActivated() || this.robot.isDefeated()) return;

    if (this.portal.containsPoint(this.robot.x, this.robot.y)) {
      this.portal.enter();
    }
  }

  private checkWinLoseConditions(activeEnemies: Enemy[]): void {
    // Lose condition: robot dead
    if (this.robot.isDefeated()) {
      this.onDefeat();
      return;
    }

    // Win condition: all enemies dead
    if (activeEnemies.length === 0 && this.enemies.length === 0) {
      this.onFloorCleared();
    }
  }

  private onDefeat(): void {
    this.isTransitioning = true;

    const transition = new DefeatTransition(this);
    transition.play(() => {
      this.gameState.reset();
      this.scene.restart();
    });
  }

  private onFloorCleared(): void {
    // Prevent multiple portals from spawning
    this.isTransitioning = true;

    // Spawn portal at center - player can enter when ready
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;

    this.portal = new Portal(this, centerX, centerY, {
      onEnter: () => this.enterPortal(),
    });
  }

  private enterPortal(): void {
    this.isTransitioning = true;
    this.portal = undefined;

    // Heal robot
    this.robot.heal(this.robot.getMaxHp());

    // Advance to next floor
    const nextFloor = this.gameState.advanceFloor();

    // Play transition sequence
    const transition = new FloorTransition(this, {
      transitionText: `Descending to floor ${nextFloor}...`,
      onScreenBlack: () => {
        // Do all repositioning while screen is black
        this.clearFloorLoot();
        this.robot.setPosition(this.worldWidth / 2, this.worldHeight / 2);
        this.swarmManager.commandRecall();
        this.floorDisplay.setFloor(nextFloor);
        this.spawnEnemiesFromLevelData();
        this.spawnTreasures(this.worldWidth, this.worldHeight);
      },
    });

    transition.play(() => {
      this.isTransitioning = false;
    });
  }

  private clearFloorLoot(): void {
    // Clear treasures
    for (const treasure of this.treasureCollection.getItems()) {
      treasure.destroy();
    }
    this.treasureCollection.clear();

    // Clear gems
    for (const gem of this.gemCollection.getItems()) {
      gem.destroy();
    }
    this.gemCollection.clear();
  }

  private setupCollectionSystems(): void {
    // Treasure collection - plays arc effect and adds currency
    this.treasureCollection.onCollect(({ item, x, y }) => {
      const value = item.getValue();
      item.collect();
      this.showCollectEffect(x, y, value);
    });

    // Gem collection - adds to inventory
    this.gemCollection.onCollect(({ item, x, y }) => {
      const gemId = item.collect();
      if (gemId) {
        this.inventory.addGem(gemId);
        this.showGemPickupEffect(x, y, gemId);
      }
    });
  }

  private setupCollectionPulse(): void {
    this.collectionPulse = new CollectionPulse(this, {
      maxRadius: 225,
      growRate: 400,
      color: 0x88ccff,
    });

    this.collectionPulse
      .bindKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .setEmitterSource(() => this.robot.isDefeated() ? [] : [this.robot])
      .setCollectibleSource(() => [
        ...this.treasureCollection.getItems(),
        ...this.gemCollection.getItems(),
      ])
      .onCollect((item) => {
        const x = item.x;
        const y = item.y;

        // Handle treasure
        if (item instanceof Treasure) {
          const value = item.getValue();
          item.collect();
          this.treasureCollection.remove(item as Treasure);
          this.showCollectEffect(x, y, value);
        }
        // Handle gems
        else if (item instanceof WorldGem) {
          const gemId = (item as WorldGem).collect();
          if (gemId) {
            this.gemCollection.remove(item as WorldGem);
            this.inventory.addGem(gemId);
            this.showGemPickupEffect(x, y, gemId);
          }
        }
      });
  }

  private showGemPickupEffect(x: number, y: number, gemId: string): void {
    const visual = getGemVisual(gemId);
    this.vfx.burst.play(x, y, visual.color);
    this.vfx.text.show(x, y, `+${visual.name}`, {
      color: `#${visual.color.toString(16).padStart(6, '0')}`,
      bold: true,
    });
  }

  private showCollectEffect(worldX: number, worldY: number, value: number): void {
    // Burst at pickup location
    this.vfx.burst.play(worldX, worldY, 0xffd700, { count: 6, distance: 25, size: 3, duration: 200 });

    // Arc projectile to currency display
    const target = this.currencyDisplay.getTargetPosition();
    this.vfx.arc.launch(worldX, worldY, target.x, target.y, () => {
      this.onEssenceArrived(value);
    });
  }

  private onEssenceArrived(value: number): void {
    this.currencyDisplay.add(value);

    // Sync to React store so the EssenceDisplay updates
    gameStore.getState().setPlayerEssence(this.currencyDisplay.getAmount());

    const target = this.currencyDisplay.getTargetPosition();
    this.vfx.burst.playUI(target.x, target.y, 0xffd700, { count: 10, randomizeDistance: true });
    this.vfx.text.show(target.x, target.y, `+${value}`, {
      fontSize: '16px',
      color: '#ffd700',
      bold: true,
      strokeThickness: 0,
      isUI: true,
      depth: 1000,
    });
  }

  private setupSpawnControls(): void {
    const eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    eKey?.on('down', () => {
      // Check capacity
      if (this.swarmManager.isAtCapacity()) {
        this.vfx.text.show(this.robot.x, this.robot.y - 40, 'Swarm Full!', {
          color: '#ff6666',
          bold: true,
        });
        return;
      }

      const cost = this.swarmManager.getSpawnCost();
      if (this.currencyDisplay.spend(cost)) {
        const nanobot = this.swarmManager.spawnNanobot();
        if (nanobot) {
          // Spawn effect
          this.vfx.burst.play(nanobot.x, nanobot.y, 0x88ccff, {
            count: 8,
            distance: 20,
            duration: 200,
          });
          this.vfx.text.show(nanobot.x, nanobot.y - 20, '+Nanobot', {
            color: '#88ccff',
            bold: true,
          });
        }
      } else {
        this.vfx.text.show(this.robot.x, this.robot.y - 40, `Need ${cost} essence!`, {
          color: '#ff6666',
          bold: true,
        });
      }
    });
  }

  private setupNanobotCommandControls(): void {
    // Q = recall nanobots
    const qKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    qKey?.on('down', () => {
      this.swarmManager.commandRecall();
      this.vfx.text.show(this.robot.x, this.robot.y - 40, 'Recall!', {
        color: '#88ccff',
        bold: true,
      });
    });
  }

  private setupClickControls(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left-click = send nanobots to location
      if (pointer.leftButtonDown()) {
        // Get nanobot positions before sending command
        const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());

        // Send command
        this.swarmManager.commandMoveTo(pointer.worldX, pointer.worldY);

        // Show command lines from each nanobot to destination
        this.vfx.command.show(nanobots, pointer.worldX, pointer.worldY);

        // Also show click indicator at destination
        this.vfx.click.show(pointer.worldX, pointer.worldY, 0xffff00);
      }
    });
  }

  private spawnRobotAndSwarm(): void {
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;

    // Spawn robot
    this.robot = new Robot(this, centerX, centerY, {
      maxHp: 20,
      moveSpeed: 160,
      personalSlots: 2,
      nanobotSlots: 2,
    });

    // Camera follows robot
    this.cameras.main.startFollow(this.robot, true, 0.1, 0.1);

    // Handle robot death
    this.robot.onDeath(() => {
      // Game over is handled in checkWinLoseConditions
    });

    // Create swarm manager
    this.swarmManager = new SwarmManager({
      robot: this.robot,
      scene: this,
      maxNanobots: 10,
      spawnCost: this.NANOBOT_COST,
      baseOrbitDistance: 50,
    });

    // Spawn starting nanobots
    const startingNanobots = 3;
    for (let i = 0; i < startingNanobots; i++) {
      this.swarmManager.spawnNanobot();
    }
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

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    type EssenceDenomination = 1 | 5 | 10;
    const clusters: { denominations: EssenceDenomination[] }[] = [
      { denominations: [1, 1, 1, 1, 1, 5] },
      { denominations: [1, 1, 1, 5, 5] },
      { denominations: [1, 1, 10] },
    ];

    const clusterSpread = 15;

    for (const cluster of clusters) {
      const centerX = Phaser.Math.Between(150, worldWidth - 150);
      const centerY = Phaser.Math.Between(150, worldHeight - 150);

      for (const denomination of cluster.denominations) {
        const offsetX = Phaser.Math.Between(-clusterSpread, clusterSpread);
        const offsetY = Phaser.Math.Between(-clusterSpread, clusterSpread);

        const treasure = new Treasure(this, centerX + offsetX, centerY + offsetY, denomination);
        this.treasureCollection.add(treasure);
      }
    }
  }

  private spawnEnemiesFromLevelData(): void {
    const levelData: LevelData = this.levelGenerator.generate(this.gameState.getFloor());
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;
    const safeRadius = 400;
    const packSpreadRadius = 80;

    for (const pack of levelData.packs) {
      const packCenter = this.getSpawnPositionAwayFrom(
        centerX, centerY, safeRadius,
        this.worldWidth, this.worldHeight
      );

      for (const enemySpawn of pack.enemies) {
        const x = packCenter.x + enemySpawn.offsetX * packSpreadRadius;
        const y = packCenter.y + enemySpawn.offsetY * packSpreadRadius;
        this.spawnEnemy(x, y, enemySpawn.level, enemySpawn.type);
      }
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

  private spawnEnemy(x: number, y: number, level: number, type: EnemyTypeConfig): Enemy {
    const enemy = new Enemy(this, x, y, { level, type });
    this.enemies.push(enemy);

    enemy.onDeath((deadEnemy) => {
      this.xpTracker.distributeXp(deadEnemy);
      const index = this.enemies.indexOf(deadEnemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }

      // Drop essence loot
      const dropAmount = deadEnemy.getEssenceDropAmount();
      this.essenceDropper.drop(deadEnemy.x, deadEnemy.y, dropAmount, (treasure) => {
        this.treasureCollection.add(treasure);
      });

      // Drop a random gem (100% chance for now)
      this.gemDropper.dropRandom(deadEnemy.x, deadEnemy.y, (worldGem) => {
        this.gemCollection.add(worldGem);
      });
    });

    return enemy;
  }

  public getEventManager(): GameEventManager | undefined {
    return this.eventManager;
  }

  public getTickSystem(): TickSystem {
    return this.tickSystem;
  }

  /** Get the robot for external access (e.g., UI) */
  public getRobot(): Robot {
    return this.robot;
  }

  /** Get the swarm manager for external access */
  public getSwarmManager(): SwarmManager {
    return this.swarmManager;
  }

  /** Get the inventory for external access */
  public getInventory(): InventoryState {
    return this.inventory;
  }

  /** Get the currency display for external access */
  public getCurrencyDisplay(): CurrencyDisplay {
    return this.currencyDisplay;
  }
}
