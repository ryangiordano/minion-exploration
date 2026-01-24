import Phaser from 'phaser';
import { Treasure, EssenceDropper } from '../../treasure';
import { Enemy, EnemyTypeConfig, Spitter, EnemyProjectile } from '../../enemies';
import { Rock, BOULDER_CONFIG, SMALL_ROCK_CONFIG } from '../../rocks';
import { CombatXpTracker, GameEventManager, CollectionPulse } from '../../../core/components';
import { TickSystem } from '../../../core/systems';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import { FloorDisplay } from '../ui/FloorDisplay';
import { WorldGem, GemDropper, InventoryState, getGemVisual } from '../../inventory';
import { GameState } from '../../../core/game-state';
import { LevelGenerator, LevelData } from '../../../core/level-generation';
import { FloorTransition, DefeatTransition } from '../../../core/floor-transition';
import { Vfx, ArrivalSequence, LaunchSequence, NanobotDockSequence } from '../../../core/vfx';
import { CollectionSystem } from '../systems';
import { LaunchPad } from '../objects/LaunchPad';
import { Robot } from '../../robot';
import { SwarmManager, Nanobot } from '../../nanobots';
import { SplatterSystem, SPLATTER_COLORS } from '../../splatters';
import { Combatable } from '../../../core/types/interfaces';
import { getEdgeDistance } from '../../../core/utils/distance';
import { gameStore, GemSlotType } from '../../../ui/store/gameStore';
import { GemRegistry } from '../../upgrade';
import { ShieldGem } from '../../../core/abilities/gems/ShieldGem';
import { LifestealGem } from '../../../core/abilities/gems/LifestealGem';
import { HealPulseGem } from '../../../core/abilities/gems/HealPulseGem';
import { RangedAttackGem } from '../../../core/abilities/gems/RangedAttackGem';
import type { RobotState, NanobotState, InventoryGemState, EquippedGemState } from '../../../shared/types';

export class LevelScene extends Phaser.Scene {
  // Main character
  private robot!: Robot;
  private swarmManager!: SwarmManager;

  private enemies: Enemy[] = [];
  private spitters: Spitter[] = [];
  private projectiles: EnemyProjectile[] = [];
  private rocks: Rock[] = [];

  // Physics group for enemy collision bodies (inner circles that prevent stacking)
  private enemyCollisionGroup!: Phaser.Physics.Arcade.Group;
  // Static physics group for rocks that block movement (boulders)
  private rockCollisionGroup!: Phaser.Physics.Arcade.StaticGroup;
  private xpTracker = new CombatXpTracker({ baseXpPerKill: 10 });
  private tickSystem = new TickSystem();
  private eventManager?: GameEventManager;

  // Currency
  private currencyDisplay!: CurrencyDisplay;
  private floorDisplay!: FloorDisplay;
  private readonly NANOBOT_COST = 20;

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
  private splatterSystem!: SplatterSystem;

  // Roguelike state
  private gameState = new GameState();
  private levelGenerator = new LevelGenerator();
  private isTransitioning = false;
  private launchPad?: LaunchPad;

  // Arrival/Launch sequences
  private arrivalSequence!: ArrivalSequence;
  private launchSequence!: LaunchSequence;
  private nanobotDockSequence!: NanobotDockSequence;
  private isOnLaunchPad = false;
  private spaceKey?: Phaser.Input.Keyboard.Key;

  // World dimensions (stored for respawning)
  private worldWidth = 1600;
  private worldHeight = 1200;

  constructor() {
    super({ key: 'LevelScene' });
  }

  preload(): void {
    // Load robot face spritesheet (3x2 grid, 1984x1984 frames)
    // Top row: blink animation (eyes open -> half -> closed)
    // Bottom row: mouth animation (closed -> open)
    this.load.spritesheet('robot-face', 'assets/robot/robot-face.png', {
      frameWidth: 1984,
      frameHeight: 1984,
    });

    // Load nanobot sprite (single image)
    this.load.image('nanobot', 'assets/nanobots/nanobot.png');
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

    // Splatter system for enemy death effects
    this.splatterSystem = new SplatterSystem(this, this.worldWidth, this.worldHeight, 5);

    // Arrival/Launch sequences
    this.arrivalSequence = new ArrivalSequence(this);
    this.launchSequence = new LaunchSequence(this);
    this.nanobotDockSequence = new NanobotDockSequence(this);

    // Create physics group for enemy collision bodies
    this.enemyCollisionGroup = this.physics.add.group();

    // Create static physics group for blocking rocks (boulders) - truly immovable
    this.rockCollisionGroup = this.physics.add.staticGroup();

    // Spawn treasures around the world
    this.spawnTreasures(this.worldWidth, this.worldHeight);

    // Spawn rocks
    this.spawnRocks();

    // Spawn robot and nanobots BEFORE enemies so colliders can be set up
    this.spawnRobotAndSwarm();

    // Spawn enemies from level generator
    this.spawnEnemiesFromLevelData();

    // Set up collisions between enemy collision bodies and robot/nanobots
    this.setupEnemyToUnitCollisions();

    // Setup controls
    this.setupNanobotCommandControls();
    this.setupClickControls();

    // Add instructions
    const instructions = this.add.text(10, 10,
      'WASD: Move | Space: Dash | Shift: Collect | Q: Recall | Click: Send | E: Spawn | C: Menu',
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

    // Setup menu controls and store sync
    this.setupMenuControls();
    this.registerStoreCommandHandlers();
    this.syncStateToStore();
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

    // Get active enemies (includes both regular enemies and spitters)
    const activeEnemies = this.enemies.filter(e => !e.isDefeated());
    const activeSpitters = this.spitters.filter(s => !s.isDefeated());

    // Get active rocks (they're also valid targets for nanobots)
    const activeRocks = this.rocks.filter(r => !r.isDefeated());

    // Combine enemies, spitters, and rocks for nanobot targeting
    const nanobotTargets: Combatable[] = [...activeEnemies, ...activeSpitters, ...activeRocks];

    // Update robot
    if (!this.robot.isDefeated()) {
      this.robot.update(delta);
    }

    // Update swarm
    this.swarmManager.update(delta, nanobotTargets);

    // Update all enemies - they target the robot and nanobots
    const combatTargets: Combatable[] = [];
    if (!this.robot.isDefeated()) {
      combatTargets.push(this.robot);
    }
    combatTargets.push(...this.swarmManager.getNanobots().filter(n => !n.isDefeated()));

    this.enemies.forEach(enemy => {
      enemy.setNearbyTargets(combatTargets);
      enemy.update(delta);
    });

    // Update spitters - they also target robot and nanobots
    const activeSpittersForUpdate = this.spitters.filter(s => !s.isDefeated());
    for (const spitter of activeSpittersForUpdate) {
      spitter.setNearbyTargets(combatTargets);
      spitter.update(delta);
    }

    // Update projectiles and check collisions with robot
    this.updateProjectiles();

    // Check dash collisions with enemies, spitters, and rocks
    if (this.robot.getIsDashing()) {
      this.checkDashCollisions(activeEnemies);
      this.checkDashCollisionsWithSpitters(activeSpitters);
      this.checkDashCollisionsWithRocks();
    }

    // Update rocks
    this.rocks.forEach(rock => rock.update());

    // Check for collections - robot collects items
    if (!this.robot.isDefeated()) {
      this.treasureCollection.update([this.robot]);
      this.gemCollection.update([this.robot]);
    }

    // Update collection pulse
    this.collectionPulse.update(delta);

    // Update nanobot count display
    this.updateNanobotDisplay();

    // Update launch pad charging
    this.updateLaunchPad(delta);

    // Check win/lose conditions (only if not already transitioning)
    if (!this.isTransitioning) {
      this.checkWinLoseConditions(activeEnemies);
    }
  }

  /** Check if dashing robot collides with any enemies */
  private checkDashCollisions(enemies: Enemy[]): void {
    const robotRadius = this.robot.getRadius();

    for (const enemy of enemies) {
      if (enemy.isDefeated()) continue;

      const dist = Phaser.Math.Distance.Between(
        this.robot.x, this.robot.y,
        enemy.x, enemy.y
      );

      // Check if robot is touching enemy (using both radii)
      const touchDistance = robotRadius + enemy.getRadius();
      if (dist <= touchDistance) {
        this.robot.checkDashCollision(enemy);
      }
    }
  }

  /** Check if dashing robot collides with any spitters */
  private checkDashCollisionsWithSpitters(spitters: Spitter[]): void {
    const robotRadius = this.robot.getRadius();

    for (const spitter of spitters) {
      if (spitter.isDefeated()) continue;

      const dist = Phaser.Math.Distance.Between(
        this.robot.x, this.robot.y,
        spitter.x, spitter.y
      );

      const touchDistance = robotRadius + spitter.getRadius();
      if (dist <= touchDistance) {
        this.robot.checkDashCollision(spitter);
      }
    }
  }

  /** Check if dashing robot collides with any rocks */
  private checkDashCollisionsWithRocks(): void {
    const robotRadius = this.robot.getRadius();

    for (const rock of this.rocks) {
      if (rock.isDefeated()) continue;

      // Use edge-to-edge distance with tolerance to account for
      // rectangular collision bodies (physics stops robot at edge)
      const edgeDist = getEdgeDistance(
        this.robot.x,
        this.robot.y,
        robotRadius,
        rock.x,
        rock.y,
        rock.getRadius()
      );

      // Touching if edge distance is within tolerance (5px buffer)
      if (edgeDist <= 5) {
        this.robot.checkDashCollision(rock);
      }
    }
  }

  /** Update projectiles and check for collisions with robot and nanobots */
  private updateProjectiles(): void {
    const robotRadius = this.robot.getRadius();
    const projectileRadius = 8; // Default projectile radius

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Update projectile (checks for max distance despawn)
      projectile.update();

      // Check if projectile was destroyed
      if (!projectile.active) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let hitTarget = false;

      // Check collision with robot (if not defeated and not dashing)
      if (!this.robot.isDefeated() && !this.robot.getIsDashing()) {
        const dist = Phaser.Math.Distance.Between(
          projectile.x, projectile.y,
          this.robot.x, this.robot.y
        );

        const hitDistance = robotRadius + projectileRadius;
        if (dist <= hitDistance) {
          const damage = projectile.getDamage();
          this.robot.takeDamage(damage);
          hitTarget = true;
        }
      }

      // Check collision with nanobots
      if (!hitTarget) {
        for (const nanobot of this.swarmManager.getNanobots()) {
          if (nanobot.isDefeated()) continue;

          const dist = Phaser.Math.Distance.Between(
            projectile.x, projectile.y,
            nanobot.x, nanobot.y
          );

          const hitDistance = nanobot.getRadius() + projectileRadius;
          if (dist <= hitDistance) {
            const damage = projectile.getDamage();
            nanobot.takeDamage(damage);
            hitTarget = true;
            break;
          }
        }
      }

      // Destroy projectile if it hit something
      if (hitTarget) {
        projectile.onHit();
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** Update launch pad state and handle charging */
  private updateLaunchPad(delta: number): void {
    if (!this.launchPad || this.robot.isDefeated()) return;

    // Check if robot is on the launch pad
    const wasOnPad = this.isOnLaunchPad;
    this.isOnLaunchPad = this.launchPad.containsPoint(this.robot.x, this.robot.y);

    // Disable dash when on an active launch pad (spacebar is used for charging)
    if (this.isOnLaunchPad && this.launchPad.isActivated() && !this.launchPad.isLaunched()) {
      this.robot.disableDash();

      // Check for spacebar hold
      if (this.spaceKey?.isDown) {
        this.launchPad.startCharge();

        // Update nanobot docking based on charge progress
        const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
        this.nanobotDockSequence.updateDocking(
          nanobots,
          this.robot.x,
          this.robot.y,
          this.launchPad.getChargeProgress()
        );
      } else {
        this.launchPad.stopCharge();
      }
    } else {
      // Not on pad or pad not active - enable dashing
      this.robot.enableDash();

      if (wasOnPad && !this.isOnLaunchPad) {
        // Left the pad - stop charging
        this.launchPad.stopCharge();
      }
    }

    // Update charge decay
    this.launchPad.updateCharge(delta);
  }

  /** Trigger the full launch sequence */
  private triggerLaunchSequence(): void {
    this.isTransitioning = true;
    this.robot.disableMovement();

    // Hide gem displays
    this.robot.setGemDisplaysVisible(false);
    this.robot.clearVisualTint();

    // Snap nanobots to final docked positions
    const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
    this.nanobotDockSequence.snapToDocked(nanobots, this.robot.x, this.robot.y);

    // Hide nanobots (they're "attached" to robot during launch)
    for (const nanobot of nanobots) {
      this.tweens.add({
        targets: nanobot,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 200,
      });
    }

    // Play launch animation
    this.time.delayedCall(200, () => {
      this.launchSequence.play(this.robot.getVisual(), () => {
        // Launch complete - fade to black and transition
        this.performFloorTransition();
      });
    });
  }

  /** Perform the floor transition after launch */
  private performFloorTransition(): void {
    // Heal robot
    this.robot.heal(this.robot.getMaxHp());

    // Advance to next floor
    const nextFloor = this.gameState.advanceFloor();

    // Capture nanobots for clearing dock state
    const launchingNanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());

    // Play transition (fade to black, show text, fade in)
    const transition = new FloorTransition(this, {
      transitionText: `Ascending to floor ${nextFloor}...`,
      skipConfetti: true,
      onScreenBlack: () => {
        // Reset robot visual
        this.robot.getVisual().setScale(1);
        this.robot.getVisual().setAlpha(1);

        // Destroy old launch pad
        this.launchPad?.destroy();
        this.launchPad = undefined;

        // Clear docking state
        this.nanobotDockSequence.clearDockingState(launchingNanobots);

        // Position robot at center for new floor
        const centerX = this.worldWidth / 2;
        const centerY = this.worldHeight / 2;
        this.robot.setPosition(centerX, centerY);
        this.robot.getVisual().setPosition(centerX, centerY);

        // Reset nanobots
        const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
        for (const nanobot of nanobots) {
          nanobot.setPosition(centerX, centerY);
          nanobot.setAlpha(0);
          nanobot.setScale(0);
          nanobot.setShieldVisible(false); // Hide shields during arrival
        }

        // Clear floor and spawn new content
        this.clearFloorLoot();
        this.floorDisplay.setFloor(nextFloor);
        this.spawnEnemiesFromLevelData();
        this.spawnTreasures(this.worldWidth, this.worldHeight);
        this.spawnRocks();
        this.spawnLaunchPad();
      },
    });

    transition.play(() => {
      // After fade in, play arrival animation
      this.swarmManager.freezeAll();
      this.robot.setGemDisplaysVisible(false);

      this.arrivalSequence.play(this.robot.getVisual(), this.robot.x, this.robot.y, () => {
        // Robot has landed - animate nanobots appearing
        const currentNanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
        this.animateNanobotsAppear(currentNanobots, () => {
          this.robot.enableMovement();
          this.robot.setGemDisplaysVisible(true);
          this.swarmManager.unfreezeAll();
          this.isTransitioning = false;
        });
      });
    });
  }

  private checkWinLoseConditions(activeEnemies: Enemy[]): void {
    // Lose condition: robot dead
    if (this.robot.isDefeated()) {
      this.onDefeat();
      return;
    }

    // Win condition: all enemies and spitters dead
    const allEnemiesDefeated = activeEnemies.length === 0 && this.enemies.length === 0;
    const allSpittersDefeated = this.spitters.filter(s => !s.isDefeated()).length === 0;

    if (allEnemiesDefeated && allSpittersDefeated) {
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
    // Prevent multiple activations
    if (this.launchPad?.isActivated()) return;

    // Activate the launch pad - it turns green and player can now charge to launch
    this.launchPad?.activate();

    // Show feedback
    this.vfx.text.show(
      this.launchPad?.x ?? this.worldWidth / 2,
      (this.launchPad?.y ?? this.worldHeight / 2) - 60,
      'Launch Pad Ready!',
      { color: '#44cc44', bold: true }
    );
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

    // Clear rocks
    for (const rock of this.rocks) {
      rock.destroy();
    }
    this.rocks = [];

    // Clear spitters
    for (const spitter of this.spitters) {
      spitter.destroy();
    }
    this.spitters = [];

    // Clear projectiles
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles = [];

    // Clear splatters from previous floor
    this.splatterSystem.clear();
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
      .bindKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
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
        // Sync to React store so the EssenceDisplay updates
        gameStore.getState().setPlayerEssence(this.currencyDisplay.getAmount());

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
      maxHp: 5,
      moveSpeed: 160,
      personalSlots: 3,
      nanobotSlots: 3,
    });

    // Disable movement during arrival
    this.robot.disableMovement();

    // Camera follows robot
    this.cameras.main.startFollow(this.robot, true, 0.1, 0.1);

    // Store space key reference for launch pad charging
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Handle robot death
    this.robot.onDeath(() => {
      // Game over is handled in checkWinLoseConditions
    });

    // Handle dash hit effects
    this.robot.onDashHit((enemy) => {
      // Visual feedback - burst and flash
      this.vfx.burst.play(enemy.x, enemy.y, 0x88ccff, { count: 6, distance: 20 });
      if ('setTint' in enemy) {
        const sprite = enemy as unknown as Phaser.GameObjects.Sprite;
        sprite.setTint(0x88ccff);
        this.time.delayedCall(100, () => sprite.clearTint());
      }

      // Signal nanobots to attack the target
      if (!enemy.isDefeated()) {
        this.swarmManager.commandAttack(enemy);
      }
    });

    // Create swarm manager
    this.swarmManager = new SwarmManager({
      robot: this.robot,
      scene: this,
      maxNanobots: 10,
      spawnCost: this.NANOBOT_COST,
      baseOrbitDistance: 50,
    });

    // DEBUG: Equip gems for demo
    // Robot personal slots (0, 1, 2): Lifesteal, HealPulse, Ranged
    this.robot.equipGem(new LifestealGem(), 0);
    this.robot.equipGem(new HealPulseGem(), 1);
    this.robot.equipGem(new RangedAttackGem(), 2);
    // Nanobot slots (3, 4, 5): Shield, Ranged, HealPulse
    this.robot.equipGem(new ShieldGem(), 3);
    this.robot.equipGem(new RangedAttackGem(), 4);
    this.robot.equipGem(new HealPulseGem(), 5);

    // Spawn starting nanobots
    const startingNanobots = 3;
    for (let i = 0; i < startingNanobots; i++) {
      this.swarmManager.spawnNanobot();
    }

    // Set up callback for robot to get all allied nanobots (for heal pulse)
    this.robot.setGetAlliesCallback(() => {
      return this.swarmManager.getNanobots().filter(n => !n.isDefeated());
    });

    // Play arrival animation
    this.playArrivalSequence();

    // Spawn the launch pad for this level
    this.spawnLaunchPad();
  }

  /** Play the robot arrival animation (falling from sky) */
  private playArrivalSequence(): void {
    // Freeze nanobots during arrival
    this.swarmManager.freezeAll();

    // Completely hide nanobots initially (invisible and no size)
    const nanobots = this.swarmManager.getNanobots();
    for (const nanobot of nanobots) {
      nanobot.setAlpha(0);
      nanobot.setScale(0);
      nanobot.setShieldVisible(false); // Hide shields during arrival
      // Position at robot center (they'll animate outward after landing)
      nanobot.setPosition(this.robot.x, this.robot.y);
    }

    // Hide gem displays during arrival
    this.robot.setGemDisplaysVisible(false);

    // Play arrival animation on robot visual
    this.arrivalSequence.play(this.robot.getVisual(), this.robot.x, this.robot.y, () => {
      // Robot has landed - sync visual position to physics body position
      this.robot.getVisual().setPosition(this.robot.x, this.robot.y);

      // Now animate nanobots appearing from robot position
      this.animateNanobotsAppear(nanobots, () => {
        // All animations complete - enable movement
        this.robot.enableMovement();
        this.robot.setGemDisplaysVisible(true);
        this.swarmManager.unfreezeAll();
      });
    });
  }

  /** Animate nanobots appearing after robot lands */
  private animateNanobotsAppear(nanobots: Nanobot[], onComplete: () => void): void {
    if (nanobots.length === 0) {
      onComplete();
      return;
    }

    let completed = 0;
    const staggerDelay = 80;

    for (let i = 0; i < nanobots.length; i++) {
      const nanobot = nanobots[i];
      const angle = (i / nanobots.length) * Math.PI * 2;
      const targetX = this.robot.x + Math.cos(angle) * 50;
      const targetY = this.robot.y + Math.sin(angle) * 50;

      this.time.delayedCall(i * staggerDelay, () => {
        nanobot.setScale(0);
        nanobot.setAlpha(1);

        // Pop in animation
        this.tweens.add({
          targets: nanobot,
          x: targetX,
          y: targetY,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 250,
          ease: 'Back.easeOut',
          onComplete: () => {
            // Show shield after nanobot appears
            nanobot.setShieldVisible(true);
            completed++;
            if (completed === nanobots.length) {
              onComplete();
            }
          },
        });
      });
    }
  }

  /** Spawn the launch pad at a random location */
  private spawnLaunchPad(): void {
    const levelData = this.levelGenerator.generate(this.gameState.getFloor());
    const padX = levelData.launchPadPosition.x * this.worldWidth;
    const padY = levelData.launchPadPosition.y * this.worldHeight;

    this.launchPad = new LaunchPad(this, padX, padY);

    // Set up launch callbacks
    this.launchPad
      .onChargeStart(() => {
        // Start nanobot docking animation
        const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
        this.swarmManager.freezeAll();
        this.nanobotDockSequence.startDocking(nanobots, this.robot.x, this.robot.y, 0);
      })
      .onChargeRelease(() => {
        // Cancel docking - nanobots return to normal
        const nanobots = this.swarmManager.getNanobots().filter(n => !n.isDefeated());
        this.nanobotDockSequence.releaseDocking(nanobots);
        this.nanobotDockSequence.clearDockingState(nanobots);

        // Unfreeze after release animation
        this.time.delayedCall(300, () => {
          if (!this.launchPad?.isLaunched()) {
            this.swarmManager.unfreezeAll();
          }
        });
      })
      .onLaunch(() => {
        this.triggerLaunchSequence();
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

  private spawnTreasures(worldWidth: number, worldHeight: number): void {
    type EssenceDenomination = 1 | 5 | 10;
    const clusters: { denominations: EssenceDenomination[] }[] = [
      { denominations: [1, 1, 1, 1, 1, 5] },
      { denominations: [1, 1, 1, 5, 5] },
      { denominations: [1, 1, 10] },
    ];

    const clusterSpread = 15;
    const minClusterDistance = 250;
    const clusterCenters: { x: number; y: number }[] = [];

    for (const cluster of clusters) {
      const center = this.findSpacedPosition(
        clusterCenters,
        minClusterDistance,
        150, worldWidth - 150,
        150, worldHeight - 150
      );
      clusterCenters.push(center);

      for (const denomination of cluster.denominations) {
        const offsetX = Phaser.Math.Between(-clusterSpread, clusterSpread);
        const offsetY = Phaser.Math.Between(-clusterSpread, clusterSpread);

        const treasure = new Treasure(this, center.x + offsetX, center.y + offsetY, denomination);
        this.treasureCollection.add(treasure);
      }
    }
  }

  /** Spawn rocks scattered around the level */
  private spawnRocks(): void {
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;
    const safeRadius = 200; // Keep rocks away from spawn point

    // Spawn boulders (spread out)
    const numBoulders = 4;
    for (let i = 0; i < numBoulders; i++) {
      const pos = this.getSpawnPositionAwayFrom(
        centerX, centerY, safeRadius,
        this.worldWidth, this.worldHeight
      );
      this.spawnRock(pos.x, pos.y, BOULDER_CONFIG);
    }

    // Spawn small rocks in clusters (more fun to dash through)
    const numClusters = 3;
    const rocksPerCluster = 4;
    const clusterSpread = 40;

    for (let c = 0; c < numClusters; c++) {
      const clusterCenter = this.getSpawnPositionAwayFrom(
        centerX, centerY, safeRadius * 0.5,
        this.worldWidth, this.worldHeight
      );

      for (let r = 0; r < rocksPerCluster; r++) {
        const offsetX = Phaser.Math.Between(-clusterSpread, clusterSpread);
        const offsetY = Phaser.Math.Between(-clusterSpread, clusterSpread);
        this.spawnRock(clusterCenter.x + offsetX, clusterCenter.y + offsetY, SMALL_ROCK_CONFIG);
      }
    }
  }

  /** Spawn a single rock and set up its callbacks */
  private spawnRock(x: number, y: number, config: typeof BOULDER_CONFIG): Rock {
    const rock = new Rock(this, x, y, config);
    this.rocks.push(rock);

    // Add blocking rocks to collision group
    if (rock.blocksMovement()) {
      this.rockCollisionGroup.add(rock);
    }

    // Handle rock destruction
    rock.onDeath((deadRock) => {
      const index = this.rocks.indexOf(deadRock);
      if (index > -1) {
        this.rocks.splice(index, 1);
      }

      // Dust/debris splatter effect
      this.splatterSystem.addBurst(deadRock.x, deadRock.y, 35, SPLATTER_COLORS.grey);

      // Drop essence
      const dropAmount = deadRock.getEssenceDropAmount();
      this.essenceDropper.drop(deadRock.x, deadRock.y, dropAmount, (treasure) => {
        this.treasureCollection.add(treasure);
      });
    });

    // Click to command nanobots to attack
    rock.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !rock.isDefeated()) {
        this.swarmManager.commandAttack(rock);
        this.vfx.click.show(rock.x, rock.y, 0xff4444); // Red for attack
      }
    });

    return rock;
  }

  /** Find a position that maintains minimum distance from existing positions */
  private findSpacedPosition(
    existingPositions: { x: number; y: number }[],
    minDistance: number,
    minX: number, maxX: number,
    minY: number, maxY: number,
    maxAttempts = 50
  ): { x: number; y: number } {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Phaser.Math.Between(minX, maxX);
      const y = Phaser.Math.Between(minY, maxY);

      const isFarEnough = existingPositions.every(pos =>
        Phaser.Math.Distance.Between(x, y, pos.x, pos.y) >= minDistance
      );

      if (isFarEnough) {
        return { x, y };
      }
    }

    // Fallback: return random position if we can't find a spaced one
    return {
      x: Phaser.Math.Between(minX, maxX),
      y: Phaser.Math.Between(minY, maxY),
    };
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

        if (enemySpawn.enemyType === 'spitter') {
          this.spawnSpitter(x, y, enemySpawn.level, enemySpawn.type);
        } else {
          this.spawnEnemy(x, y, enemySpawn.level, enemySpawn.type);
        }
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

    // Set up collision between enemy's inner collision body and robot/nanobots
    this.setupEnemyColliders(enemy);

    enemy.onDeath((deadEnemy) => {
      this.xpTracker.distributeXp(deadEnemy);
      const index = this.enemies.indexOf(deadEnemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }

      // Death splatter effect
      this.splatterSystem.addBurst(deadEnemy.x, deadEnemy.y, 50, SPLATTER_COLORS.brown);

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

  private spawnSpitter(x: number, y: number, level: number, type: EnemyTypeConfig): Spitter {
    const spitter = new Spitter(this, x, y, type, { level });
    this.spitters.push(spitter);

    // Set up collision body
    const collisionBody = spitter.getCollisionBody();
    this.enemyCollisionGroup.add(collisionBody);

    // Handle projectile spawning
    spitter.onProjectileSpawn((projectile) => {
      this.projectiles.push(projectile);
    });

    spitter.onDeath((deadSpitter) => {
      const index = this.spitters.indexOf(deadSpitter);
      if (index > -1) {
        this.spitters.splice(index, 1);
      }

      // Death splatter effect (green for spitters)
      this.splatterSystem.addBurst(deadSpitter.x, deadSpitter.y, 45, SPLATTER_COLORS.green);

      // Drop essence loot
      const dropAmount = deadSpitter.getEssenceDropAmount();
      this.essenceDropper.drop(deadSpitter.x, deadSpitter.y, dropAmount, (treasure) => {
        this.treasureCollection.add(treasure);
      });

      // Drop a random gem
      this.gemDropper.dropRandom(deadSpitter.x, deadSpitter.y, (worldGem) => {
        this.gemCollection.add(worldGem);
      });
    });

    return spitter;
  }

  /** Add an enemy's collision body to the physics group */
  private setupEnemyColliders(enemy: Enemy): void {
    const collisionBody = enemy.getCollisionBody();
    this.enemyCollisionGroup.add(collisionBody);
  }

  /** Set up collisions between enemy collision bodies and nanobots (robot passes through) */
  private setupEnemyToUnitCollisions(): void {
    // Robot does NOT collide with enemies - it passes through them freely
    // Dash damage is handled separately via checkDashCollisions()

    // Collide enemy collision bodies with each nanobot
    // Note: We add colliders for existing nanobots and hook into swarm spawn for future ones
    for (const nanobot of this.swarmManager.getNanobots()) {
      this.physics.add.collider(this.enemyCollisionGroup, nanobot);
    }

    // Hook into swarm manager to add colliders for newly spawned nanobots
    this.swarmManager.onNanobotSpawn((nanobot) => {
      this.physics.add.collider(this.enemyCollisionGroup, nanobot);
    });

    // Boulders block robot movement
    this.physics.add.collider(this.rockCollisionGroup, this.robot);

    // Nanobots use overlap instead of collider with rocks
    // This allows them to get close enough for melee attacks
    // (colliders would stop them at the edge, preventing attack range from being reached)
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

  // ===========================================
  // Store Sync & Menu Controls
  // ===========================================

  /** Setup C key to open the party menu */
  private setupMenuControls(): void {
    const cKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    cKey?.on('down', () => {
      const store = gameStore.getState();
      if (store.activeMenu === 'none') {
        this.syncStateToStore();
        store.openPartyMenu();
      } else {
        store.closeMenu();
      }
    });
  }

  /** Register command handlers so React UI can trigger Phaser actions */
  private registerStoreCommandHandlers(): void {
    gameStore.getState().registerCommandHandlers({
      // Legacy handlers (not used but required by interface)
      onEquipGem: () => {},
      onRemoveGem: () => {},
      onRepairMinion: () => {},

      // Robot gem handlers
      onEquipRobotGem: (slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => {
        this.handleEquipRobotGem(slotType, slotIndex, gemInstanceId);
      },
      onRemoveRobotGem: (slotType: GemSlotType, slotIndex: number) => {
        this.handleRemoveRobotGem(slotType, slotIndex);
      },
      onSellGem: (gemInstanceId: string) => {
        this.handleSellGem(gemInstanceId);
      },
    });
  }

  /** Handle equipping a gem to a robot slot */
  private handleEquipRobotGem(slotType: GemSlotType, slotIndex: number, gemInstanceId: string): void {
    // Find the gem in inventory
    const inventoryGem = this.inventory.getGems().find(g => g.instanceId === gemInstanceId);
    if (!inventoryGem) return;

    // Create the ability gem instance
    const abilityGem = this.inventory.createGemInstance(inventoryGem);
    if (!abilityGem) return;

    // Calculate the actual slot index (personal slots are 0-2, nanobot slots are 3-5)
    const actualSlot = slotType === 'personal' ? slotIndex : this.robot.getPersonalSlotCount() + slotIndex;

    // Equip the gem
    const success = this.robot.equipGem(abilityGem, actualSlot);
    if (success) {
      // Remove from inventory
      this.inventory.removeGem(gemInstanceId);
      // Sync state back to store
      this.syncStateToStore();
    }
  }

  /** Handle removing a gem from a robot slot */
  private handleRemoveRobotGem(slotType: GemSlotType, slotIndex: number): void {
    // Calculate the actual slot index
    const actualSlot = slotType === 'personal' ? slotIndex : this.robot.getPersonalSlotCount() + slotIndex;

    // Unequip the gem (returns the gem or null)
    const gem = this.robot.getAbilitySystem().unequipGem(actualSlot);
    if (!gem) return;

    // Add back to inventory
    this.inventory.addGem(gem.id);

    // Sync state back to store
    this.syncStateToStore();
  }

  /** Handle selling a gem from inventory for essence */
  private handleSellGem(gemInstanceId: string): void {
    // Find the gem in inventory
    const inventoryGem = this.inventory.getGems().find(g => g.instanceId === gemInstanceId);
    if (!inventoryGem) return;

    // Get the gem's sell value (25% of essence cost)
    const entry = GemRegistry.get(inventoryGem.gemId);
    const sellValue = Math.floor((entry?.essenceCost ?? 0) * 0.25);

    // Remove from inventory
    this.inventory.removeGem(gemInstanceId);

    // Add essence
    this.currencyDisplay.add(sellValue);

    // Sync state back to store
    this.syncStateToStore();
  }

  /** Sync all game state to the React store */
  private syncStateToStore(): void {
    const store = gameStore.getState();

    // Sync robot state
    store.setRobot(this.buildRobotState());

    // Sync nanobot state
    store.setNanobots(this.buildNanobotStates());

    // Sync inventory gems
    store.setInventoryGems(this.buildInventoryGemStates());

    // Sync essence
    store.setPlayerEssence(this.currencyDisplay.getAmount());
  }

  /** Build robot state for the store */
  private buildRobotState(): RobotState {
    const personalSlotCount = this.robot.getPersonalSlotCount();
    const nanobotSlotCount = this.robot.getNanobotSlotCount();

    const personalGemSlots: (EquippedGemState | null)[] = [];
    const nanobotGemSlots: (EquippedGemState | null)[] = [];

    // Build personal gem slots
    for (let i = 0; i < personalSlotCount; i++) {
      const gem = this.robot.getAbilitySystem().getGemInSlot(i);
      personalGemSlots.push(gem ? this.buildEquippedGemState(gem.id, i) : null);
    }

    // Build nanobot gem slots
    for (let i = 0; i < nanobotSlotCount; i++) {
      const actualSlot = personalSlotCount + i;
      const gem = this.robot.getAbilitySystem().getGemInSlot(actualSlot);
      nanobotGemSlots.push(gem ? this.buildEquippedGemState(gem.id, i) : null);
    }

    return {
      hp: this.robot.getCurrentHp(),
      maxHp: this.robot.getMaxHp(),
      mp: this.robot.getCurrentMp(),
      maxMp: this.robot.getMaxMp(),
      personalGemSlots,
      nanobotGemSlots,
    };
  }

  /** Build equipped gem state for a gem */
  private buildEquippedGemState(gemId: string, slot: number): EquippedGemState {
    const entry = GemRegistry.get(gemId);
    const visual = getGemVisual(gemId);
    const essenceCost = entry?.essenceCost ?? 0;

    return {
      id: gemId,
      slot,
      name: entry?.name ?? gemId,
      description: entry?.description ?? '',
      color: visual.color,
      removalCost: Math.floor(essenceCost * 0.25),
    };
  }

  /** Build nanobot states for the store */
  private buildNanobotStates(): NanobotState[] {
    return this.swarmManager.getNanobots().map((nanobot, index) => ({
      id: `nanobot_${index}`,
      hp: nanobot.getCurrentHp(),
      maxHp: nanobot.getMaxHp(),
    }));
  }

  /** Build inventory gem states for the store */
  private buildInventoryGemStates(): InventoryGemState[] {
    return this.inventory.getGems().map(gem => {
      const entry = GemRegistry.get(gem.gemId);
      const visual = getGemVisual(gem.gemId);
      const essenceCost = entry?.essenceCost ?? 0;

      return {
        instanceId: gem.instanceId,
        gemId: gem.gemId,
        name: entry?.name ?? gem.gemId,
        description: entry?.description ?? '',
        essenceCost,
        sellValue: Math.floor(essenceCost * 0.25),
        color: visual.color,
      };
    });
  }
}
