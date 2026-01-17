import Phaser from 'phaser';
import { Minion, MINION_VISUAL_RADIUS } from '../../minions';
import { Treasure, EssenceDropper } from '../../treasure';
import { Enemy, EnemyTypeConfig } from '../../enemies';
import { CombatManager, CombatXpTracker, GameEventManager, EdgeScrollCamera, WhistleSelection, SelectionManager } from '../../../core/components';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import { FloorDisplay } from '../ui/FloorDisplay';
import { Combatable } from '../../../core/types/interfaces';
import { UpgradeMenu } from '../../upgrade';
import { AbilityGem } from '../../../core/abilities/types';
import { WorldGem, GemDropper, InventoryState, getGemVisual, InventoryModal, InventoryGem } from '../../inventory';
import { GameState } from '../../../core/game-state';
import { LevelGenerator, LevelData } from '../../../core/level-generation';
import { FloorTransition } from '../../../core/floor-transition';
import { Vfx } from '../../../core/vfx';
import { CollectionSystem } from '../systems';

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
  private combatManager = new CombatManager();
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private eventManager?: GameEventManager;

  // Camera control
  private edgeScrollCamera!: EdgeScrollCamera;

  // Selection
  private selectionManager = new SelectionManager();
  private whistleSelection?: WhistleSelection;

  // Currency
  private currencyDisplay!: CurrencyDisplay;
  private floorDisplay!: FloorDisplay;
  private readonly MINION_COST = 10;
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
  private pendingGemEquip: InventoryGem | null = null;

  // Upgrade menu
  private upgradeMenu?: UpgradeMenu;

  // Visual effects
  private vfx!: Vfx;

  // Roguelike state
  private gameState = new GameState();
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

    // Spawn starting minions
    this.spawnStartingMinions();

    // Setup whistle selection (hold Space to grow selection circle)
    this.setupWhistleSelection();

    // Setup click controls
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'Hold Space: Select | Left-click: Deselect | Right-click: Move/Attack | G: Grid | I: Inventory | E: Spawn | Edges: Pan',
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
  }

  update(_time: number, delta: number): void {
    // Update edge-scroll camera
    this.edgeScrollCamera.update(delta);

    // Update whistle selection animation
    this.whistleSelection?.update(delta);

    // Update upgrade menu (follows minion position)
    this.upgradeMenu?.update();

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

    // Play defeat transition (fade to white with text)
    this.playDefeatTransition(() => {
      // Reset game state and restart scene
      this.gameState.reset();
      this.scene.restart();
    });
  }

  private playDefeatTransition(onComplete: () => void): void {
    const { width, height } = this.cameras.main;

    // Create white overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0);
    overlay.setScrollFactor(0);
    overlay.setDepth(2001);

    // Fade to white
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        // Show text
        const text = this.add.text(width / 2, height / 2, 'You return to the surface...', {
          fontSize: '28px',
          color: '#000000',
          fontStyle: 'italic',
        });
        text.setOrigin(0.5, 0.5);
        text.setScrollFactor(0);
        text.setDepth(2002);
        text.setAlpha(0);

        // Fade in text
        this.tweens.add({
          targets: text,
          alpha: 1,
          duration: 300,
          ease: 'Power2',
        });

        // Wait then complete
        this.time.delayedCall(1500, () => {
          onComplete();
        });
      },
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

      if (this.currencyDisplay.spend(this.MINION_COST)) {
        this.spawnMinion(pointer.worldX, pointer.worldY);
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
    // Initialize upgrade menu with inventory integration
    this.upgradeMenu = new UpgradeMenu({
      scene: this,
      currencyDisplay: this.currencyDisplay,
      inventory: this.inventory,
      onGemSelected: (gem) => this.handleGemSelectionFromInventory(gem),
      onInventoryGemEquipped: (inventoryGem) => {
        // Remove the gem from inventory when equipped
        this.inventory.removeGem(inventoryGem.instanceId);
      },
      onCancel: () => this.upgradeMenu?.close(),
    });

    // U key to open upgrade menu
    const uKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.U);
    uKey?.on('down', () => {
      this.tryOpenUpgradeMenu();
    });
  }

  private setupInventoryControls(): void {
    // Initialize inventory modal
    this.inventoryModal = new InventoryModal({
      scene: this,
      inventory: this.inventory,
      onGemSelected: (gem) => {
        this.pendingGemEquip = gem;
      },
      onClose: () => {
        // Clear pending if closed without equipping
        if (this.pendingGemEquip) {
          this.pendingGemEquip = null;
        }
      },
    });

    // I key to toggle inventory
    const iKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    if (!iKey) {
      console.error('Failed to add I key');
    }
    iKey?.on('down', () => {
      console.log('I key pressed, modal open:', this.inventoryModal?.isOpen());
      if (this.inventoryModal?.isOpen()) {
        this.inventoryModal.close();
      } else {
        this.inventoryModal?.open();
      }
    });
  }

  private tryOpenUpgradeMenu(): void {
    // Don't reopen if already open
    if (this.upgradeMenu?.isOpen()) {
      return;
    }

    // Only open if exactly 1 minion selected
    const selected = this.getSelectedMinions();
    if (selected.length !== 1) {
      return;
    }

    this.upgradeMenu?.open(selected[0]);
  }

  /** Handle equipping a gem from inventory (no cost) */
  private handleGemSelectionFromInventory(gem: AbilityGem): void {
    const targetMinion = this.upgradeMenu?.getTargetMinion();
    if (!targetMinion) return;

    // Equip the gem (replaces existing if any)
    targetMinion.equipGem(gem);

    // Close menu
    this.upgradeMenu?.close();

    // Show equip feedback
    this.showGemEquipEffect(targetMinion);
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
    const selectedMinions = this.getSelectedMinions();
    if (selectedMinions.length === 0) return;

    const pointer = this.input.activePointer;
    const centerX = pointer.worldX;
    const centerY = pointer.worldY;

    // Space minions so they don't overlap (diameter + small gap)
    const spacing = MINION_VISUAL_RADIUS * 2 + 10;
    const gridSize = Math.ceil(Math.sqrt(selectedMinions.length));

    // Calculate grid offset so formation is centered
    const gridWidth = (gridSize - 1) * spacing;
    const gridHeight = (gridSize - 1) * spacing;
    const startX = centerX - gridWidth / 2;
    const startY = centerY - gridHeight / 2;

    selectedMinions.forEach((minion, index) => {
      const col = index % gridSize;
      const row = Math.floor(index / gridSize);
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      minion.send({ type: 'MOVE_TO_EXACT', x, y });
    });

    this.showClickEffect(centerX, centerY, CLICK_COLORS.move);
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
  private getScatterOffset(radius: number = MINION_VISUAL_RADIUS * 2): { x: number; y: number } {
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
    this.vfx.click.show(x, y, color);
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

    // Make minion clickable for gem equipping
    minion.setInteractive({ useHandCursor: true });
    minion.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.pendingGemEquip) {
        this.equipGemOnMinion(minion, this.pendingGemEquip);
      }
    });

    // Handle death
    minion.onDeath(() => {
      const index = this.minions.indexOf(minion);
      if (index > -1) {
        this.minions.splice(index, 1);
      }
      this.selectionManager.removeFromSelection(minion);

      // Close upgrade menu if this minion dies while menu is open for them
      if (this.upgradeMenu?.isOpen() && this.upgradeMenu.getTargetMinion() === minion) {
        this.upgradeMenu.close();
      }
    });

    return minion;
  }

  private equipGemOnMinion(minion: Minion, inventoryGem: InventoryGem): void {
    // Create the actual ability gem from inventory
    const abilityGem = this.inventory.createGemInstance(inventoryGem);
    if (!abilityGem) return;

    // Remove from inventory
    this.inventory.removeGem(inventoryGem.instanceId);

    // Equip on minion
    minion.equipGem(abilityGem);

    // Clear pending and close inventory
    this.pendingGemEquip = null;
    this.inventoryModal?.close();

    // Show equip effect
    this.showGemEquipEffect(minion);
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
        this.treasures.push(treasure);
      });

      // Drop a random gem (100% chance for now)
      const gem = this.gemDropper.dropRandom(deadEnemy.x, deadEnemy.y, (worldGem) => {
        this.worldGems.push(worldGem);
      });
      if (!gem) {
        console.warn('No gems registered - cannot drop');
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

  public getEventManager(): GameEventManager | undefined {
    return this.eventManager;
  }
}
