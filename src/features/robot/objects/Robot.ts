import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { AttackBehavior, AttackCallbackContext } from '../../../core/components/AttackBehavior';
import { AbilitySystem } from '../../../core/abilities/AbilitySystem';
import { AbilityGem, GemOwner } from '../../../core/abilities/types';

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
 * Moves with WASD, auto-attacks nearby enemies, and has gem slots for itself and its nanobots.
 */
export class Robot extends Phaser.Physics.Arcade.Sprite implements Combatable, GemOwner {
  private readonly radius = ROBOT_VISUAL_RADIUS;

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
  private readonly maxHp: number;
  private currentMp: number;
  private readonly maxMp: number;
  private defeated = false;

  // Combat
  private attackBehavior: AttackBehavior;
  private nearbyEnemies: Combatable[] = [];
  private readonly aggroRadius = 120;

  // Abilities - split between personal and nanobot slots
  private abilitySystem: AbilitySystem;
  private readonly personalSlotCount: number;
  private readonly nanobotSlotCount: number;

  // Death callback
  private onDeathCallback?: () => void;

  // Damage flash
  private isFlashing = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: RobotConfig = {}) {
    // Use the robot spritesheet
    super(scene, x, y, 'robot');

    this.maxHp = config.maxHp ?? 20;
    this.currentHp = this.maxHp;
    this.maxMp = 10;
    this.currentMp = this.maxMp;
    this.moveSpeed = config.moveSpeed ?? 160;
    this.personalSlotCount = config.personalSlots ?? 2;
    this.nanobotSlotCount = config.nanobotSlots ?? 2;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set initial frame (first expression) and scale down (sprite is 128x128)
    this.setFrame(0);
    this.setScale(0.35);

    // Setup physics
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

    // Setup attack behavior
    this.attackBehavior = new AttackBehavior({
      defaultAttack: {
        damage: 2,
        cooldownMs: 800,
        effectType: 'melee',
        range: 0,
      },
    });

    this.attackBehavior.onAttack((context) => this.handleAttack(context));
    this.attackBehavior.onTargetDefeated(() => this.findNewTarget());
  }

  update(delta: number): void {
    if (this.defeated) return;

    this.handleMovement();
    this.handleCombat(delta);
    this.abilitySystem.update(delta);
  }

  private handleMovement(): void {
    if (!this.wasd) return;

    let accelerationX = 0;
    let accelerationY = 0;

    // Note: A and D are used for commands, so only W/S for vertical
    // Actually, let's use WASD for movement and different keys for commands
    // We'll use WASD for movement as planned
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

  private handleCombat(delta: number): void {
    // Find target if not engaged
    if (!this.attackBehavior.isEngaged()) {
      this.findNewTarget();
    }

    // Update attack behavior
    const effectiveAttack = this.getEffectiveAttack();
    this.attackBehavior.update(delta, {
      attackerX: this.x,
      attackerY: this.y,
      attackerRadius: this.radius,
      effectiveAttack,
    });
  }

  private findNewTarget(): void {
    const closest = this.findClosestEnemy();
    if (closest) {
      this.attackBehavior.engage(closest);
    }
  }

  private findClosestEnemy(): Combatable | null {
    let closest: Combatable | null = null;
    let closestDist = this.aggroRadius;

    for (const enemy of this.nearbyEnemies) {
      if (enemy.isDefeated()) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  private getEffectiveAttack(): AttackConfig {
    const baseAttack: AttackConfig = {
      damage: 2,
      cooldownMs: 800,
      effectType: 'melee',
      range: 0,
    };

    // Apply modifiers from personal gems only (slots 0 to personalSlotCount-1)
    const personalGems = this.getPersonalGems();
    for (const gem of personalGems) {
      const modifiers = gem.getAttackModifiers?.() ?? {};
      Object.assign(baseAttack, modifiers);
    }

    return baseAttack;
  }

  private handleAttack(context: AttackCallbackContext): void {
    // Dispatch to ability system for gem hooks (personal gems only)
    this.abilitySystem.onAttackHit(
      context.target,
      context.damage,
      this.scene,
      context.dealDamage,
      context.damageDeferred
    );

    // Visual feedback - flash the target
    if ('setTint' in context.target) {
      const sprite = context.target as unknown as Phaser.GameObjects.Sprite;
      sprite.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => sprite.clearTint());
    }
  }

  /** Set the list of nearby enemies for auto-targeting */
  public setNearbyEnemies(enemies: Combatable[]): void {
    this.nearbyEnemies = enemies;
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
    return this.abilitySystem.equipGem(gem, slot);
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

  // --- Combatable interface ---

  public getCurrentHp(): number {
    return this.currentHp;
  }

  public getMaxHp(): number {
    return this.maxHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.currentHp = Math.max(0, this.currentHp - amount);

    // Visual feedback
    this.flashDamage();

    if (this.currentHp <= 0) {
      this.die();
    }
  }

  public heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
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

  private flashDamage(): void {
    if (this.isFlashing) return;
    this.isFlashing = true;

    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
      this.isFlashing = false;
    });
  }

  private die(): void {
    this.defeated = true;
    this.attackBehavior.disengage();

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 500,
      onComplete: () => {
        this.onDeathCallback?.();
        this.destroy();
      },
    });
  }

  /** Register a callback for when the robot dies */
  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }
}
