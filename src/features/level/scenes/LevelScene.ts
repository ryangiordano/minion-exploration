import Phaser from 'phaser';
import { Minion } from '../../minions';
import { Treasure, EssenceDropper } from '../../treasure';
import { Enemy, TargetDummy, LACKEY_CONFIG, BRUTE_CONFIG, EnemyTypeConfig } from '../../enemies';
import { CombatManager, CombatXpTracker, GameEventManager, EdgeScrollCamera, WhistleSelection, SelectionManager } from '../../../core/components';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
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

  // Currency
  private currencyDisplay!: CurrencyDisplay;
  private readonly MINION_COST = 10;
  private readonly TREASURE_VALUE = 5;

  // Loot
  private essenceDropper!: EssenceDropper;

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

    // Spawn minions near center
    const minionPositions = [
      { x: worldWidth / 2 + 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2 - 100, y: worldHeight / 2 + 50 },
      { x: worldWidth / 2, y: worldHeight / 2 + 100 },
      { x: worldWidth / 2, y: worldHeight / 2 - 100 }
    ];

    minionPositions.forEach((pos) => {
      this.spawnMinion(pos.x, pos.y);
    });

    // Setup whistle selection (hold Space to grow selection circle)
    this.setupWhistleSelection();

    // Setup click controls
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'Hold Space: Select | Left-click: Deselect | Right-click: Move/Attack | G: Grid lineup | E: Spawn | Edges: Pan',
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

    // Essence dropper for enemy loot
    this.essenceDropper = new EssenceDropper(this);

    // Setup spawn minion key
    this.setupSpawnControls();

    // Setup grid lineup key
    this.setupGridLineupControls();
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
      if (treasure.isCollected() || !treasure.isCollectible()) continue;

      for (const minion of minions) {
        const dist = Phaser.Math.Distance.Between(minion.x, minion.y, treasure.x, treasure.y);
        if (dist < collectDistance) {
          const x = treasure.x;
          const y = treasure.y;
          treasure.collect();
          this.treasures.splice(i, 1);

          // Show collection effects - currency updates when orb arrives
          this.showCollectEffect(x, y);
          break;
        }
      }
    }
  }

  /** Animated essence orb that arcs from world position to UI */
  private showCollectEffect(worldX: number, worldY: number): void {
    // Initial burst at pickup location
    this.showPickupBurst(worldX, worldY);

    // Convert world position to screen position for the arc animation
    const startScreenX = worldX - this.cameras.main.scrollX;
    const startScreenY = worldY - this.cameras.main.scrollY;

    // Target position (currency display)
    const target = this.currencyDisplay.getTargetPosition();

    // Create essence orb (gold)
    const orb = this.add.circle(startScreenX, startScreenY, 8, 0xffd700);
    orb.setStrokeStyle(3, 0xb8860b, 0.8);
    orb.setScrollFactor(0);
    orb.setDepth(1000);

    // Animation duration
    const duration = 400;

    // Calculate arc control point (rises up before curving down)
    const midX = (startScreenX + target.x) / 2;
    const arcHeight = Math.min(150, Math.abs(target.y - startScreenY) + 80);
    const controlY = Math.min(startScreenY, target.y) - arcHeight;

    // Trail spawn timing
    let lastTrailTime = 0;
    const trailInterval = 40; // ms between trail particles

    // Animate along quadratic bezier curve
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Power2.in',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;

        // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
        const oneMinusT = 1 - t;
        const newX =
          oneMinusT * oneMinusT * startScreenX +
          2 * oneMinusT * t * midX +
          t * t * target.x;
        const newY =
          oneMinusT * oneMinusT * startScreenY +
          2 * oneMinusT * t * controlY +
          t * t * target.y;

        orb.setPosition(newX, newY);

        // Pulse scale during flight
        const pulse = 1 + Math.sin(t * Math.PI * 3) * 0.2;
        orb.setScale(pulse);

        // Spawn trail particles at intervals
        const currentTime = t * duration;
        if (currentTime - lastTrailTime >= trailInterval) {
          lastTrailTime = currentTime;
          this.spawnTrailParticle(newX, newY);
        }
      },
      onComplete: () => {
        orb.destroy();
        this.onEssenceArrived();
      },
    });
  }

  /** Spawns a fading trail particle at the given screen position */
  private spawnTrailParticle(x: number, y: number): void {
    const trail = this.add.circle(x, y, 5, 0xffd700, 1);
    trail.setScrollFactor(0);
    trail.setDepth(999);

    this.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 0.3,
      duration: 500,
      ease: 'Power1',
      onComplete: () => trail.destroy(),
    });
  }

  /** Small burst effect at pickup location */
  private showPickupBurst(x: number, y: number): void {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = this.add.circle(x, y, 3, 0xffd700);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 25,
        y: y + Math.sin(angle) * 25,
        alpha: 0,
        scale: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Called when essence orb arrives at the UI */
  private onEssenceArrived(): void {
    // Update currency
    this.currencyDisplay.add(this.TREASURE_VALUE);

    // Pop the display
    this.currencyDisplay.pop();

    // Particle burst at UI
    this.showArrivalBurst();

    // Floating +value text
    this.showValueText();
  }

  /** Particle burst when essence arrives at UI */
  private showArrivalBurst(): void {
    const target = this.currencyDisplay.getTargetPosition();
    const particleCount = 10;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = this.add.circle(target.x, target.y, 4, 0xffd700);
      particle.setScrollFactor(0);
      particle.setDepth(999);

      const distance = 30 + Math.random() * 20;
      this.tweens.add({
        targets: particle,
        x: target.x + Math.cos(angle) * distance,
        y: target.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Floating +value text near the UI */
  private showValueText(): void {
    const target = this.currencyDisplay.getTargetPosition();

    const floatingText = this.add.text(target.x, target.y - 20, `+${this.TREASURE_VALUE}`, {
      fontSize: '16px',
      color: '#ffd700',
      fontStyle: 'bold',
    });
    floatingText.setScrollFactor(0);
    floatingText.setOrigin(0.5, 1);
    floatingText.setDepth(1000);

    this.tweens.add({
      targets: floatingText,
      y: target.y - 50,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => floatingText.destroy(),
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

  /** Arrange selected minions in a grid formation centered on the mouse position */
  private commandGridLineup(): void {
    const selectedMinions = this.getSelectedMinions();
    if (selectedMinions.length === 0) return;

    const pointer = this.input.activePointer;
    const centerX = pointer.worldX;
    const centerY = pointer.worldY;

    const spacing = 45;
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

      minion.send({ type: 'MOVE_TO', x, y });
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

    // Mixed packs: brutes with lackey escorts
    this.spawnMixedPack(centerX, centerY, safeRadius, worldWidth, worldHeight, 1, 3);
    this.spawnMixedPack(centerX, centerY, safeRadius, worldWidth, worldHeight, 1, 4);
    this.spawnMixedPack(centerX, centerY, safeRadius + 100, worldWidth, worldHeight, 2, 5);
  }

  /** Spawn a mixed pack with brutes in the center and lackeys around them */
  private spawnMixedPack(
    avoidX: number, avoidY: number, minDistance: number,
    worldWidth: number, worldHeight: number,
    bruteCount: number, lackeyCount: number
  ): void {
    const center = this.getSpawnPositionAwayFrom(avoidX, avoidY, minDistance, worldWidth, worldHeight);

    // Spawn brutes near center
    for (let i = 0; i < bruteCount; i++) {
      const angle = (i / bruteCount) * Math.PI * 2;
      const distance = Phaser.Math.Between(0, 30);
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      this.spawnEnemy(x, y, 1, BRUTE_CONFIG);
    }

    // Spawn lackeys around the brutes
    const lackeyRadius = 60 + BRUTE_CONFIG.radius;
    for (let i = 0; i < lackeyCount; i++) {
      const angle = (i / lackeyCount) * Math.PI * 2;
      const distance = Phaser.Math.Between(40, lackeyRadius);
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      this.spawnEnemy(x, y, 1, LACKEY_CONFIG);
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
