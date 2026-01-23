import Phaser from 'phaser';
import { Combatable } from '../../../core/types/interfaces';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { LAYERS } from '../../../core/config';
import { AbilitySystem } from '../../../core/abilities/AbilitySystem';
import { AbilityGem, GemOwner, AttackHitContext } from '../../../core/abilities/types';
import { ShieldGem } from '../../../core/abilities/gems/ShieldGem';
import { RobotVisual } from './RobotVisual';
import { OrbitalGemDisplay } from './OrbitalGemDisplay';
import { DashGhostTrail } from '../../../core/vfx';

/** Visual radius for collision/display purposes */
export const ROBOT_VISUAL_RADIUS = 20;

/** Configuration for the Robot */
export interface RobotConfig {
  maxHp?: number;
  moveSpeed?: number;
  personalSlots?: number;
  nanobotSlots?: number;
}

/**
 * The main player-controlled robot character.
 * A rolling sphere that moves with WASD, can dash-attack with spacebar,
 * and has gem slots for itself and its nanobots.
 */
export class Robot extends Phaser.Physics.Arcade.Image implements Combatable, GemOwner {
  private readonly radius = ROBOT_VISUAL_RADIUS;

  // Visual component
  private visual: RobotVisual;

  // Movement
  private wasd?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private readonly moveSpeed: number;
  private readonly acceleration = 1200;
  private readonly drag = 800;

  // Health and MP
  private currentHp: number;
  private readonly baseMaxHp: number;
  private currentMp: number;
  private readonly maxMp: number;
  private defeated = false;

  // Dash ability
  private readonly dashSpeed = 500;
  private readonly dashDuration = 250; // ms
  private readonly dashCooldown = 1000; // ms
  private readonly dashDamage = 1;
  private isDashing = false;
  private isInvulnerable = false;
  private dashCooldownTimer = 0;
  private dashDirection = new Phaser.Math.Vector2(1, 0);
  private lastFacingDirection = new Phaser.Math.Vector2(1, 0);
  private damagedEnemiesDuringDash = new Set<Combatable>();
  private onDashHitCallback?: (enemy: Combatable) => void;
  private dashGhostTrail: DashGhostTrail;

  // Abilities - split between personal and nanobot slots
  private abilitySystem: AbilitySystem;
  private readonly personalSlotCount: number;
  private readonly nanobotSlotCount: number;

  // HP bar
  private hpBar: StatBar;

  // Death callback
  private onDeathCallback?: () => void;

  // Damage flash
  private isFlashing = false;

  // Movement control (disabled during portal transitions, etc.)
  private movementEnabled = true;

  // Dash control (can be disabled independently from movement, e.g., on launch pad)
  private dashEnabled = true;

  // Face animation state
  private isRolling = false;

  // Orbital gem displays
  private personalGemDisplay: OrbitalGemDisplay;  // Flat orbit, always visible
  private nanobotGemDisplay: OrbitalGemDisplay;   // 3D orbit, front/behind

  // Shield (from ShieldGem if equipped in personal slots)
  private shieldGem: ShieldGem | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: RobotConfig = {}) {
    // Create invisible physics body (we'll use RobotVisual for rendering)
    super(scene, x, y, '__DEFAULT');

    this.baseMaxHp = config.maxHp ?? 20;
    this.currentHp = this.baseMaxHp;
    this.maxMp = 10;
    this.currentMp = this.maxMp;
    this.moveSpeed = config.moveSpeed ?? 160;
    this.personalSlotCount = config.personalSlots ?? 2;
    this.nanobotSlotCount = config.nanobotSlots ?? 2;

    // Add physics body to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Make the physics sprite invisible - visual is handled by RobotVisual
    this.setAlpha(0);

    // Create the rolling sphere visual with sprite face
    this.visual = new RobotVisual(scene, x, y, {
      radius: this.radius,
      faceSprite: 'robot-face',
      faceFrame: 0,
    });
    this.visual.setDepth(LAYERS.ENTITIES + 1);

    // Create face animations
    this.createFaceAnimations();

    // Create HP bar (slightly larger than nanobot bars)
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: 32,
      height: 4,
      offsetY: -28,
    });

    // Setup physics body - circle slightly larger than visual for better collision feel
    const collisionRadius = this.radius * 1.2;
    this.setCircle(collisionRadius, -collisionRadius / 4, -collisionRadius / 4);
    this.setCollideWorldBounds(true);
    this.setDrag(this.drag);
    this.setMaxVelocity(this.moveSpeed);

    // Setup input
    if (scene.input.keyboard) {
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Setup ability system with combined slots
    const totalSlots = this.personalSlotCount + this.nanobotSlotCount;
    this.abilitySystem = new AbilitySystem(this, { maxSlots: totalSlots });

    // Create orbital gem displays
    // Personal gems: flat orbit, always visible, closer to robot
    this.personalGemDisplay = new OrbitalGemDisplay(scene, () => this.getPersonalGems(), {
      mode: 'flat',
      orbitDistance: 28,
    });
    // Nanobot gems: 3D orbit, goes in front and behind robot, farther out
    this.nanobotGemDisplay = new OrbitalGemDisplay(scene, () => this.getNanobotGems(), {
      mode: '3d',
      orbitDistance: 38,
    });

    // Setup dash input (spacebar)
    this.setupDashInput();

    // Initialize dash ghost trail effect
    this.dashGhostTrail = new DashGhostTrail(scene, {
      color: 0x88ccff,
      radius: this.radius,
    });

    // Start idle blink animation
    this.visual.playFaceAnimation('robot-blink');
  }

  /** Setup spacebar to trigger dash */
  private setupDashInput(): void {
    const spaceKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey?.on('down', () => {
      this.tryDash();
    });
  }

  /** Attempt to dash if not on cooldown and movement is enabled */
  private tryDash(): void {
    if (!this.movementEnabled || !this.dashEnabled || this.isDashing || this.dashCooldownTimer > 0 || this.defeated) {
      return;
    }

    // Get direction from WASD input, or use last facing direction if standing still
    const direction = this.getDashDirection();
    if (direction.length() === 0) {
      direction.copy(this.lastFacingDirection);
    }
    direction.normalize();
    this.dashDirection.copy(direction);

    this.executeDash();
  }

  /** Get dash direction from current WASD input */
  private getDashDirection(): Phaser.Math.Vector2 {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (!this.wasd) return dir;

    if (this.wasd.left.isDown) dir.x -= 1;
    if (this.wasd.right.isDown) dir.x += 1;
    if (this.wasd.up.isDown) dir.y -= 1;
    if (this.wasd.down.isDown) dir.y += 1;

    return dir;
  }

  /** Execute the dash ability */
  private executeDash(): void {
    this.isDashing = true;
    this.isInvulnerable = true;
    this.damagedEnemiesDuringDash.clear();

    // Set velocity in dash direction
    this.setMaxVelocity(this.dashSpeed);
    this.setVelocity(
      this.dashDirection.x * this.dashSpeed,
      this.dashDirection.y * this.dashSpeed
    );
    this.setAcceleration(0, 0);

    // Visual feedback - tint during dash and ghost trail
    this.visual.setTint(0x88ccff);
    this.dashGhostTrail.start(this);

    // End dash after duration
    this.scene.time.delayedCall(this.dashDuration, () => {
      this.endDash();
    });
  }

  /** End the dash and start cooldown */
  private endDash(): void {
    this.isDashing = false;
    this.isInvulnerable = false;
    this.dashCooldownTimer = this.dashCooldown;

    // Reset max velocity to normal
    this.setMaxVelocity(this.moveSpeed);

    // Temporarily reduce drag for smoother momentum carry-through
    this.setDrag(200);
    this.scene.time.delayedCall(200, () => {
      this.setDrag(this.drag);
    });

    // Clear tint and stop ghost trail
    this.visual.clearTint();
    this.dashGhostTrail.stop();
  }

  /** Check if an enemy should take dash damage */
  public checkDashCollision(enemy: Combatable): void {
    if (!this.isDashing) return;
    if (this.damagedEnemiesDuringDash.has(enemy)) return;

    // Mark as damaged so we only hit once per dash
    this.damagedEnemiesDuringDash.add(enemy);

    // Deal damage
    enemy.takeDamage(this.dashDamage);

    // Trigger personal gem effects only (lifesteal, etc.)
    this.triggerPersonalGemAttackHit(enemy, this.dashDamage);

    // Knockback enemy in dash direction (bowling effect)
    this.applyKnockback(enemy);

    // Notify callback for visual effects
    this.onDashHitCallback?.(enemy);
  }

  /** Apply knockback to an enemy in the dash direction */
  private applyKnockback(enemy: Combatable): void {
    // Check if enemy has a physics body we can manipulate
    if (!('body' in enemy)) return;

    const targetBody = (enemy as unknown as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
    if (!targetBody) return;

    // Static bodies can't be knocked back
    if (!('setVelocity' in targetBody)) return;

    const knockbackSpeed = 300;
    const knockbackDuration = 150;

    // Push in dash direction
    targetBody.setVelocity(
      this.dashDirection.x * knockbackSpeed,
      this.dashDirection.y * knockbackSpeed
    );

    // Let the knockback decay naturally via drag, or reset after duration
    this.scene.time.delayedCall(knockbackDuration, () => {
      if (!enemy.isDefeated()) {
        targetBody.setVelocity(0, 0);
      }
    });
  }

  /** Register callback for when dash hits an enemy */
  public onDashHit(callback: (enemy: Combatable) => void): void {
    this.onDashHitCallback = callback;
  }

  /** Check if robot is currently dashing */
  public getIsDashing(): boolean {
    return this.isDashing;
  }

  /** Create face animations for blink and mouth */
  private createFaceAnimations(): void {
    // Only create animations once (they're global to the scene)
    if (this.scene.anims.exists('robot-blink')) return;

    // Blink animation: frames 0-2 (top row), loop with pause on frame 0
    this.scene.anims.create({
      key: 'robot-blink',
      frames: [
        { key: 'robot-face', frame: 0, duration: 2500 }, // Eyes open (hold longer)
        { key: 'robot-face', frame: 1, duration: 80 },   // Half-closed
        { key: 'robot-face', frame: 2, duration: 100 },  // Closed
        { key: 'robot-face', frame: 1, duration: 80 },   // Half-closed
      ],
      repeat: -1,
    });

    // Mouth open animation: frames 3-4 (bottom row)
    this.scene.anims.create({
      key: 'robot-mouth-open',
      frames: [
        { key: 'robot-face', frame: 3, duration: 50 },  // Closed mouth
        { key: 'robot-face', frame: 4, duration: 100 }, // Open mouth
      ],
      repeat: 0,
    });

    // Mouth close animation: reverse of open
    this.scene.anims.create({
      key: 'robot-mouth-close',
      frames: [
        { key: 'robot-face', frame: 4, duration: 50 },  // Open mouth
        { key: 'robot-face', frame: 3, duration: 100 }, // Closed mouth
      ],
      repeat: 0,
    });
  }

  update(delta: number): void {
    if (this.defeated) return;

    // Sync visual position with physics body
    this.visual.syncPosition(this.x, this.y);

    // Update rolling effect based on velocity
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.visual.updateRoll(body.velocity.x, body.velocity.y, delta);

    // Update face animation based on movement
    this.updateFaceAnimation(body.velocity);

    // Update HP bar position
    this.hpBar.update(this.x, this.y, this.currentHp, this.getMaxHp(), delta);

    // Track facing direction when moving (not dashing)
    if (!this.isDashing && body.velocity.length() > 20) {
      this.lastFacingDirection.set(body.velocity.x, body.velocity.y).normalize();
    }

    // Update dash cooldown
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= delta;
    }

    // Only handle normal movement when not dashing
    if (!this.isDashing) {
      this.handleMovement();
    }

    // Update orbital gem displays
    this.personalGemDisplay.update(this.x, this.y, delta);
    this.nanobotGemDisplay.update(this.x, this.y, delta);

    // Update shield position if active
    this.shieldGem?.updateShieldFor(this);

    // Note: Robot doesn't call abilitySystem.update() because:
    // - Personal gems are passive or triggered on dash hit
    // - Nanobot gems are handled by nanobots themselves
  }

  /** Update face animation based on rolling state */
  private updateFaceAnimation(velocity: Phaser.Math.Vector2): void {
    const speed = velocity.length();
    const movingThreshold = 20; // Minimum speed to be considered "rolling"

    const wasRolling = this.isRolling;
    this.isRolling = speed > movingThreshold;

    // State changed - trigger animation
    if (this.isRolling && !wasRolling) {
      // Started rolling - open mouth
      this.visual.playFaceAnimation('robot-mouth-open', false);
    } else if (!this.isRolling && wasRolling) {
      // Stopped rolling - close mouth, center face, then return to blink
      this.visual.playFaceAnimation('robot-mouth-close', false);
      this.visual.centerFace(300);
      // After mouth close animation completes, return to blink
      this.scene.time.delayedCall(150, () => {
        if (!this.isRolling && !this.defeated) {
          this.visual.playFaceAnimation('robot-blink');
        }
      });
    }
  }

  private handleMovement(): void {
    if (!this.wasd || !this.movementEnabled) {
      this.setAcceleration(0, 0);
      return;
    }

    let accelerationX = 0;
    let accelerationY = 0;

    const left = this.wasd.left.isDown;
    const right = this.wasd.right.isDown;
    const up = this.wasd.up.isDown;
    const down = this.wasd.down.isDown;

    if (left) accelerationX = -this.acceleration;
    if (right) accelerationX = this.acceleration;
    if (up) accelerationY = -this.acceleration;
    if (down) accelerationY = this.acceleration;

    this.setAcceleration(accelerationX, accelerationY);
  }



  // --- Gem Management ---

  /** Get gems in personal slots (affect robot) */
  public getPersonalGems(): AbilityGem[] {
    const gems: AbilityGem[] = [];
    for (let i = 0; i < this.personalSlotCount; i++) {
      const gem = this.abilitySystem.getGemInSlot(i);
      if (gem) gems.push(gem);
    }
    return gems;
  }

  /** Get gems in nanobot slots (affect nanobots) */
  public getNanobotGems(): AbilityGem[] {
    const gems: AbilityGem[] = [];
    for (let i = this.personalSlotCount; i < this.personalSlotCount + this.nanobotSlotCount; i++) {
      const gem = this.abilitySystem.getGemInSlot(i);
      if (gem) gems.push(gem);
    }
    return gems;
  }

  /** Equip a gem to a specific slot */
  public equipGem(gem: AbilityGem, slot: number): boolean {
    const result = this.abilitySystem.equipGem(gem, slot);

    // If equipping a ShieldGem to a personal slot, create shield for robot
    if (result && slot < this.personalSlotCount && gem instanceof ShieldGem) {
      this.shieldGem = gem;
      gem.createShieldFor(this);
    }

    return result;
  }

  /** Get the ability system for external access */
  public getAbilitySystem(): AbilitySystem {
    return this.abilitySystem;
  }

  /** Get the number of personal slots */
  public getPersonalSlotCount(): number {
    return this.personalSlotCount;
  }

  /** Get the number of nanobot slots */
  public getNanobotSlotCount(): number {
    return this.nanobotSlotCount;
  }

  /** Trigger onAttackHit for personal gems only */
  private triggerPersonalGemAttackHit(target: Combatable, damage: number): void {
    const context: AttackHitContext = {
      attacker: this,
      target,
      damage,
      scene: this.scene,
      attackerType: 'robot',
      damageDeferred: false,
    };

    for (const gem of this.getPersonalGems()) {
      gem.onAttackHit?.(context);
    }
  }

  // --- Combatable interface ---

  public getCurrentHp(): number {
    return this.currentHp;
  }

  public getMaxHp(): number {
    // Apply stat modifiers from personal gems only (not nanobot gems)
    let flatBonus = 0;
    let percentBonus = 0;

    for (const gem of this.getPersonalGems()) {
      const modifiers = gem.getStatModifiers?.() ?? [];
      for (const mod of modifiers) {
        if (mod.stat === 'maxHp') {
          if (mod.type === 'flat') {
            flatBonus += mod.value;
          } else if (mod.type === 'percent') {
            percentBonus += mod.value;
          }
        }
      }
    }

    // Apply flat first, then percent
    const afterFlat = this.baseMaxHp + flatBonus;
    return Math.floor(afterFlat * (1 + percentBonus));
  }

  public takeDamage(amount: number): void {
    if (this.defeated || this.isInvulnerable) return;

    // Check if any personal gem shield absorbs the damage
    for (const gem of this.getPersonalGems()) {
      if (gem instanceof ShieldGem && gem.tryAbsorbDamage(this, amount)) {
        return; // Damage fully absorbed by shield
      }
    }

    this.currentHp = Math.max(0, this.currentHp - amount);

    // Visual feedback
    this.flashDamage();

    if (this.currentHp <= 0) {
      this.die();
    }
  }

  public heal(amount: number): void {
    this.currentHp = Math.min(this.getMaxHp(), this.currentHp + amount);
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  public getRadius(): number {
    return this.radius;
  }

  // --- GemOwner interface ---

  public getCurrentMp(): number {
    return this.currentMp;
  }

  public getMaxMp(): number {
    return this.maxMp;
  }

  public spendMp(amount: number): boolean {
    if (this.currentMp >= amount) {
      this.currentMp -= amount;
      return true;
    }
    return false;
  }

  public getScene(): Phaser.Scene {
    return this.scene;
  }

  // Callback to get all allied nanobots (set by LevelScene)
  private getAlliesCallback?: () => GemOwner[];

  /** Set the callback for getting all allied nanobots */
  public setGetAlliesCallback(callback: () => GemOwner[]): void {
    this.getAlliesCallback = callback;
  }

  /** Get all nearby allies (nanobots) - used by heal pulse */
  public getNearbyAllies(_radius: number): GemOwner[] {
    // Ignore radius - heal all allies
    return this.getAlliesCallback?.() ?? [];
  }

  private flashDamage(): void {
    if (this.isFlashing) return;
    this.isFlashing = true;

    this.visual.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.visual.clearTint();
      this.isFlashing = false;
    });
  }

  private die(): void {
    this.defeated = true;
    this.hpBar.destroy();
    this.shieldGem?.removeShieldFor(this);

    // Death animation on visual
    this.scene.tweens.add({
      targets: this.visual,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 500,
      onComplete: () => {
        this.onDeathCallback?.();
        this.visual.destroy();
        this.destroy();
      },
    });
  }

  /** Register a callback for when the robot dies */
  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  /** Disable player movement input */
  public disableMovement(): void {
    this.movementEnabled = false;
    this.setVelocity(0, 0);
    this.setAcceleration(0, 0);
  }

  /** Enable player movement input */
  public enableMovement(): void {
    this.movementEnabled = true;
  }

  /** Disable dashing (e.g., when on launch pad) */
  public disableDash(): void {
    this.dashEnabled = false;
  }

  /** Enable dashing */
  public enableDash(): void {
    this.dashEnabled = true;
  }

  /** Animate the robot's face to center (for portal transitions) */
  public centerFace(duration = 400): void {
    this.visual.centerFace(duration);
  }

  /** Set the visual scale (for portal animations) */
  public setVisualScale(scale: number): void {
    this.visual.setScale(scale);
  }

  /** Get the current visual scale */
  public getVisualScale(): number {
    return this.visual.scaleX;
  }

  /** Set the visual alpha (for portal animations) */
  public setVisualAlpha(alpha: number): void {
    this.visual.setAlpha(alpha);
  }

  /** Get the visual for direct tween access (portal animations) */
  public getVisual(): Phaser.GameObjects.Container {
    return this.visual;
  }

  /** Set visibility of orbital gem displays (for portal animations) */
  public setGemDisplaysVisible(visible: boolean): void {
    this.personalGemDisplay?.setVisible(visible);
    this.nanobotGemDisplay?.setVisible(visible);
  }

  /** Clear any visual tint (for portal animations) */
  public clearVisualTint(): void {
    this.visual.clearTint();
  }

  destroy(fromScene?: boolean): void {
    this.visual?.destroy();
    this.personalGemDisplay?.destroy();
    this.nanobotGemDisplay?.destroy();
    this.dashGhostTrail?.destroy();
    super.destroy(fromScene);
  }
}
