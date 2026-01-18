import Phaser from 'phaser';
import { Minion, MINION_VISUAL_RADIUS } from '../../minions';
import { Treasure, EssenceDropper } from '../../treasure';
import { Enemy, EnemyTypeConfig } from '../../enemies';
import { CombatManager, CombatXpTracker, GameEventManager, EdgeScrollCamera, EdgeScrollIndicator, SelectionManager } from '../../../core/components';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import { FloorDisplay } from '../ui/FloorDisplay';
import { PartyDisplay } from '../ui/PartyDisplay';
import { GemRegistry } from '../../upgrade';
import { WorldGem, GemDropper, InventoryState, getGemVisual, InventoryModal, GemEquipmentSystem } from '../../inventory';
import { GameState, PartyManager } from '../../../core/game-state';
import { LevelGenerator, LevelData } from '../../../core/level-generation';
import { FloorTransition, DefeatTransition } from '../../../core/floor-transition';
import { Vfx, TargetingIndicator } from '../../../core/vfx';
import { CollectionSystem, CommandSystem } from '../systems';
import { gameStore } from '../../../ui/store/gameStore';
import { minionsToState, inventoryToGemState } from '../../../ui/store/stateHelpers';

export class LevelScene extends Phaser.Scene {
  private minions: Minion[] = [];
  private enemies: Enemy[] = [];
  private combatManager = new CombatManager();
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private eventManager?: GameEventManager;

  // Camera control
  private edgeScrollCamera!: EdgeScrollCamera;
  private edgeScrollIndicator!: EdgeScrollIndicator;

  // Selection and commands
  private selectionManager = new SelectionManager();
  private commandSystem!: CommandSystem;

  // Currency
  private currencyDisplay!: CurrencyDisplay;
  private floorDisplay!: FloorDisplay;
  private partyDisplay!: PartyDisplay;
  private readonly MINION_COST = 50;
  private readonly REPAIR_COST = 10;
  private readonly TREASURE_VALUE = 5;

  // Loot
  private essenceDropper!: EssenceDropper;
  private gemDropper!: GemDropper;

  // Collection systems
  private treasureCollection = new CollectionSystem<Treasure>();
  private gemCollection = new CollectionSystem<WorldGem>();

  // Inventory
  private inventory = new InventoryState();
  private inventoryModal?: InventoryModal;
  private gemEquipment!: GemEquipmentSystem;

  // Upgrade menu is now managed via React UI store (gameStore)

  // Visual effects
  private vfx!: Vfx;
  private targetingIndicator!: TargetingIndicator;

  // Roguelike state
  private gameState = new GameState();
  private partyManager = new PartyManager(3);
  private levelGenerator = new LevelGenerator();
  private isTransitioning = false;

  // World dimensions (stored for respawning)
  private worldWidth = 1600;
  private worldHeight = 1200;

  constructor() {
    super({ key: 'LevelScene' });
  }

  preload(): void {
    // Load minion spritesheet (3x2 grid, 32x32 frames, 5 used)
    this.load.spritesheet('minion', '/assets/minions/minion.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Add background color
    this.cameras.main.setBackgroundColor('#2d4a3e');

    // Set camera bounds to match world
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Center camera initially
    this.cameras.main.scrollX = (this.worldWidth - this.cameras.main.width) / 2;
    this.cameras.main.scrollY = (this.worldHeight - this.cameras.main.height) / 2;

    // Setup edge-scroll camera (RTS-style)
    this.edgeScrollCamera = new EdgeScrollCamera(this, {
      edgeSize: 50,
      scrollSpeed: 400,
    });

    // Setup edge-scroll indicator (visual feedback for camera panning)
    this.edgeScrollIndicator = new EdgeScrollIndicator(this, {
      edgeSize: this.edgeScrollCamera.getEdgeSize(),
    });

    // Add visual reference grid
    this.createReferenceGrid(this.worldWidth, this.worldHeight);

    // Event manager for floating text and other UI feedback
    this.eventManager = new GameEventManager(this);

    // Visual effects manager
    this.vfx = new Vfx(this);

    // Command system for unit commands
    this.commandSystem = new CommandSystem({
      vfx: this.vfx,
      getSelectedUnits: () => this.getSelectedMinions(),
      scatterRadius: MINION_VISUAL_RADIUS * 2,
      gridSpacing: MINION_VISUAL_RADIUS * 2 + 10,
    });

    // Spawn treasures around the world
    this.spawnTreasures(this.worldWidth, this.worldHeight);

    // Spawn enemies from level generator
    this.spawnEnemiesFromLevelData();

    // Spawn starting minions
    this.spawnStartingMinions();

    // Setup selection controls (A = select all, 1/2/3 = select individual)
    this.setupSelectionControls();

    // Setup click controls
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'A: Select All | 1/2/3: Select Minion | Right-Click: Move | G: Grid | I: Inventory | E: Spawn',
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

    // Party display
    this.partyDisplay = new PartyDisplay(this, this.partyManager, 10, 75);

    // Essence dropper for enemy loot
    this.essenceDropper = new EssenceDropper(this);

    // Gem dropper for ability gem drops
    this.gemDropper = new GemDropper(this);

    // Setup collection system callbacks
    this.setupCollectionSystems();

    // Setup spawn minion key
    this.setupSpawnControls();

    // Setup grid lineup key
    this.setupGridLineupControls();

    // Setup upgrade controls
    this.setupUpgradeControls();

    // Setup inventory controls
    this.setupInventoryControls();

    // Setup move command mode (A key)
    this.setupMoveCommandControls();

    // Initial sync of game state to React UI store
    this.syncGameStoreState();
  }

  update(_time: number, delta: number): void {
    // Update edge-scroll camera
    this.edgeScrollCamera.update(delta);

    // Update edge-scroll indicator with current scroll state
    const scrollState = this.edgeScrollCamera.getScrollState();
    this.edgeScrollIndicator.update(
      delta,
      scrollState.isScrollingLeft,
      scrollState.isScrollingRight,
      scrollState.isScrollingUp,
      scrollState.isScrollingDown
    );


    // React upgrade menu is static (centered), no position update needed

    // Update party display
    this.partyDisplay.update();


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

    // Check for collections
    this.treasureCollection.update(activeMinions);
    this.gemCollection.update(activeMinions);

    // Check win/lose conditions (only if not already transitioning)
    if (!this.isTransitioning) {
      this.checkWinLoseConditions(activeMinions, activeEnemies);
    }
  }

  private checkWinLoseConditions(activeMinions: Minion[], activeEnemies: Enemy[]): void {
    // Lose condition: all minions dead
    if (activeMinions.length === 0 && this.minions.length === 0) {
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
    this.isTransitioning = true;

    // Heal all minions
    this.minions.forEach(minion => {
      minion.heal(minion.getMaxHp());
    });

    // Advance to next floor
    const nextFloor = this.gameState.advanceFloor();

    // Play transition sequence
    const transition = new FloorTransition(this, {
      transitionText: `Descending to floor ${nextFloor}...`,
    });

    transition.play(() => {
      // Update floor display
      this.floorDisplay.setFloor(nextFloor);

      // Spawn new enemies after transition completes
      this.spawnEnemiesFromLevelData();
      this.isTransitioning = false;
    });
  }

  private setupCollectionSystems(): void {
    // Treasure collection - plays arc effect and adds currency
    this.treasureCollection.onCollect(({ item, x, y }) => {
      item.collect();
      this.showCollectEffect(x, y);
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

  private showGemPickupEffect(x: number, y: number, gemId: string): void {
    const visual = getGemVisual(gemId);
    this.vfx.burst.play(x, y, visual.color);
    this.vfx.text.show(x, y, `+${visual.name}`, {
      color: `#${visual.color.toString(16).padStart(6, '0')}`,
      bold: true,
    });
  }

  /** Animated essence orb that arcs from world position to UI */
  private showCollectEffect(worldX: number, worldY: number): void {
    // Burst at pickup location
    this.vfx.burst.play(worldX, worldY, 0xffd700, { count: 6, distance: 25, size: 3, duration: 200 });

    // Arc projectile to currency display
    const target = this.currencyDisplay.getTargetPosition();
    this.vfx.arc.launch(worldX, worldY, target.x, target.y, () => {
      this.onEssenceArrived();
    });
  }

  /** Called when essence orb arrives at the UI */
  private onEssenceArrived(): void {
    this.currencyDisplay.add(this.TREASURE_VALUE);
    this.currencyDisplay.pop();

    const target = this.currencyDisplay.getTargetPosition();
    this.vfx.burst.playUI(target.x, target.y, 0xffd700, { count: 10, randomizeDistance: true });
    this.vfx.text.show(target.x, target.y, `+${this.TREASURE_VALUE}`, {
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
      const pointer = this.input.activePointer;

      // Check party limit first
      if (!this.partyManager.canAddMinion()) {
        this.vfx.text.show(pointer.worldX, pointer.worldY, 'Party Full!', {
          color: '#ff6666',
          bold: true,
        });
        return;
      }

      if (this.currencyDisplay.spend(this.MINION_COST)) {
        this.spawnMinion(pointer.worldX, pointer.worldY);
        this.syncGameStoreState();
      }
    });
  }

  private setupGridLineupControls(): void {
    const gKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.G);

    gKey?.on('down', () => {
      this.commandGridLineup();
    });
  }

  private setupUpgradeControls(): void {
    // Register command handlers with the React UI store
    gameStore.getState().registerCommandHandlers({
      onEquipGem: (minionId: string, gemId: string) => {
        const minion = this.getMinionById(minionId);
        if (!minion) return;

        // Find the inventory gem and create the ability gem
        const inventoryGem = this.inventory.getGems().find(g => g.gemId === gemId);
        if (!inventoryGem) return;

        const entry = GemRegistry.get(gemId);
        if (!entry) return;

        // Check cost
        const cost = entry.essenceCost;
        if (!this.currencyDisplay.canAfford(cost)) {
          this.vfx.text.show(minion.x, minion.y - 40, `Need ${cost} essence!`, {
            color: '#ff6666',
            bold: true,
          });
          return;
        }

        // Spend essence and equip
        this.currencyDisplay.spend(cost);
        const gem = entry.createGem();
        minion.equipGem(gem);

        // Remove from inventory
        this.inventory.removeGem(inventoryGem.instanceId);

        // Show effect and sync state
        this.showGemEquipEffect(minion);
        this.syncGameStoreState();
      },

      onRemoveGem: (minionId: string, slot: number) => {
        const minion = this.getMinionById(minionId);
        if (!minion) return;

        const gems = minion.getAbilitySystem().getEquippedGems();
        const gem = gems[slot];
        const gemId = gem?.id;

        minion.removeGem(slot);

        if (gemId) {
          const entry = GemRegistry.get(gemId);
          this.vfx.text.show(minion.x, minion.y - 40, `${entry?.name ?? 'Gem'} destroyed`, {
            color: '#ff6666',
            bold: true,
          });
        }

        this.syncGameStoreState();
      },

      onRepairMinion: (minionId: string) => {
        const minion = this.getMinionById(minionId);
        if (!minion) return;

        this.repairMinion(minion);
        this.syncGameStoreState();
      },
    });

    // U key to open upgrade menu
    const uKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.U);
    uKey?.on('down', () => {
      this.tryOpenUpgradeMenu();
    });
  }

  /** Find a minion by its store ID (e.g., "minion-0") */
  private getMinionById(id: string): Minion | undefined {
    const index = parseInt(id.replace('minion-', ''), 10);
    return this.minions[index];
  }

  /** Sync current game state to the React UI store */
  private syncGameStoreState(): void {
    const store = gameStore.getState();
    store.setMinions(minionsToState(this.minions));
    store.setInventoryGems(inventoryToGemState(this.inventory));
    store.setPlayerEssence(this.currencyDisplay.getAmount());
  }

  private setupInventoryControls(): void {
    // Initialize gem equipment system
    this.gemEquipment = new GemEquipmentSystem({
      inventory: this.inventory,
      onEquip: (target, _gem) => {
        // Show equip effect (target is a Minion)
        this.showGemEquipEffect(target as Minion);
        this.inventoryModal?.close();
      },
      canAffordEquip: (gemId) => {
        const cost = this.getGemEquipCost(gemId);
        return this.currencyDisplay.canAfford(cost);
      },
      spendEquipCost: (gemId) => {
        const cost = this.getGemEquipCost(gemId);
        this.currencyDisplay.spend(cost);
      },
      onCannotAfford: (gemId) => {
        const cost = this.getGemEquipCost(gemId);
        const pointer = this.input.activePointer;
        this.vfx.text.show(pointer.worldX, pointer.worldY, `Need ${cost} essence!`, {
          color: '#ff6666',
          bold: true,
        });
      },
    });

    // Initialize inventory modal
    this.inventoryModal = new InventoryModal({
      scene: this,
      inventory: this.inventory,
      onGemSelected: (gem) => {
        this.gemEquipment.selectGem(gem);
      },
      onClose: () => {
        // Cancel pending equip if closed without equipping
        if (this.gemEquipment.isAwaitingTarget()) {
          this.gemEquipment.cancel();
        }
      },
    });

    // I key to toggle inventory
    const iKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    iKey?.on('down', () => {
      if (this.inventoryModal?.isOpen()) {
        this.inventoryModal.close();
      } else {
        this.inventoryModal?.open();
      }
    });
  }

  private setupMoveCommandControls(): void {
    // Initialize targeting indicator (for visual feedback during move commands)
    this.targetingIndicator = new TargetingIndicator(this);
    this.targetingIndicator.setUnitSource(() => this.getSelectedMinions());
  }

  private tryOpenUpgradeMenu(): void {
    const store = gameStore.getState();

    // Don't reopen if already open
    if (store.activeMenu === 'upgrade') {
      return;
    }

    // Only open if exactly 1 minion selected
    const selected = this.getSelectedMinions();
    if (selected.length !== 1) {
      return;
    }

    // Sync state and open menu
    this.syncGameStoreState();

    // Find the minion's store ID
    const minionIndex = this.minions.indexOf(selected[0]);
    if (minionIndex >= 0) {
      store.openUpgradeMenu(`minion-${minionIndex}`);
    }
  }

  private showGemEquipEffect(minion: Minion): void {
    // Quick pulse effect on the minion
    this.tweens.add({
      targets: minion,
      scaleX: 2.3,
      scaleY: 2.3,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });

    // Sparkle particles around minion
    this.vfx.burst.play(minion.x, minion.y, 0xffcc00, {
      startRadius: 10,
      distance: 30,
      duration: 300,
    });
  }

  /** Arrange selected minions in a grid formation centered on the mouse position */
  private commandGridLineup(): void {
    const pointer = this.input.activePointer;
    this.commandSystem.gridLineup(pointer.worldX, pointer.worldY);
  }

  private setupSelectionControls(): void {
    // A key = select all minions
    const aKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    aKey?.on('down', () => {
      this.selectionManager.clearSelection();
      this.selectionManager.addMultipleToSelection(this.minions);
    });

    // 1/2/3 keys = select individual minion by index
    const oneKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    const twoKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    const threeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

    oneKey?.on('down', () => this.selectMinionByIndex(0));
    twoKey?.on('down', () => this.selectMinionByIndex(1));
    threeKey?.on('down', () => this.selectMinionByIndex(2));
  }

  private selectMinionByIndex(index: number): void {
    if (index < 0 || index >= this.minions.length) return;
    this.selectionManager.clearSelection();
    this.selectionManager.select(this.minions[index]);
  }

  private setupClickControls(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left-click = deselect all
      if (pointer.leftButtonDown()) {
        this.selectionManager.clearSelection();
      }

      // Right-click on background = move command for selected minions
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        this.commandSystem.moveToWithScatter(pointer.worldX, pointer.worldY);
      }
    });
  }

  private getSelectedMinions(): Minion[] {
    return this.minions.filter(m => m.isSelected());
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
    this.partyManager.addMinion();

    // Make minion clickable for selection and gem equipping
    minion.setInteractive({ useHandCursor: true });
    minion.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.leftButtonDown()) {
        // Gem equipping takes priority if awaiting target
        if (this.gemEquipment.isAwaitingTarget()) {
          this.gemEquipment.tryEquipOn(minion);
        } else {
          // StarCraft-style: click to select only this minion
          this.selectionManager.select(minion);
        }
        event.stopPropagation(); // Prevent background deselect
      }
    });

    // Handle death
    minion.onDeath((droppedGemIds) => {
      const index = this.minions.indexOf(minion);
      if (index > -1) {
        this.minions.splice(index, 1);
      }
      this.partyManager.removeMinion();
      this.selectionManager.removeFromSelection(minion);

      // Drop equipped gems at minion's death location
      this.dropGemsAtLocation(minion.x, minion.y, droppedGemIds);

      // Close upgrade menu if this minion dies while menu is open for them
      const store = gameStore.getState();
      const minionIndex = this.minions.indexOf(minion);
      if (store.activeMenu === 'upgrade' && store.selectedMinionId === `minion-${minionIndex}`) {
        store.closeMenu();
      }
    });

    return minion;
  }

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(100, worldWidth - 100);
      const y = Phaser.Math.Between(100, worldHeight - 100);

      const treasure = new Treasure(this, x, y);
      this.treasureCollection.add(treasure);

      // Right-click on treasure = move selected minions to collect
      treasure.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
          this.commandSystem.collect(treasure.x, treasure.y);
          event.stopPropagation();
        }
      });
    }
  }

  /** Spawn enemies based on LevelGenerator output */
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

  /** Spawn minions at run start based on GameState config */
  private spawnStartingMinions(): void {
    const count = this.gameState.getStartingMinions();
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;
    const spacing = MINION_VISUAL_RADIUS * 3;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * spacing;
      const y = centerY + Math.sin(angle) * spacing;
      this.spawnMinion(x, y);
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

    // Right-click on enemy = attack command for selected minions
    enemy.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
        this.commandSystem.attack(enemy);
        event.stopPropagation();
      }
    });

    return enemy;
  }

  public getEventManager(): GameEventManager | undefined {
    return this.eventManager;
  }

  /** Get the essence cost to equip a gem */
  private getGemEquipCost(gemId: string): number {
    return GemRegistry.get(gemId)?.essenceCost ?? 0;
  }

  /** Repair a minion to full HP */
  private repairMinion(minion: Minion): boolean {
    if (!this.currencyDisplay.canAfford(this.REPAIR_COST)) {
      return false;
    }

    if (minion.getCurrentHp() >= minion.getMaxHp()) {
      return false;
    }

    this.currencyDisplay.spend(this.REPAIR_COST);
    minion.heal(minion.getMaxHp());

    this.vfx.text.show(minion.x, minion.y - 40, 'Repaired!', {
      color: '#44ff44',
      bold: true,
    });

    return true;
  }

  /** Drop gems at a location (used when minion dies) */
  private dropGemsAtLocation(x: number, y: number, gemIds: string[]): void {
    for (const gemId of gemIds) {
      this.gemDropper.drop(x, y, gemId, (worldGem) => {
        this.gemCollection.add(worldGem);
      });
    }

    // Show feedback if gems were dropped
    if (gemIds.length > 0) {
      this.vfx.text.show(x, y - 30, 'Gems dropped!', {
        color: '#ffcc00',
        bold: true,
      });
    }
  }
}
