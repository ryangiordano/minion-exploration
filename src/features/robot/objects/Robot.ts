import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { AttackBehavior, AttackCallbackContext } from '../../../core/components/AttackBehavior';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { LAYERS } from '../../../core/config';
import { AbilitySystem } from '../../../core/abilities/AbilitySystem';
import { AbilityGem, GemOwner } from '../../../core/abilities/types';
import { RobotVisual } from './RobotVisual';

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
 * A rolling sphere that moves with WASD, auto-attacks nearby enemies,
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

  // HP bar
  private hpBar: StatBar;

  // Death callback
  private onDeathCallback?: () => void;

  // Damage flash
  private isFlashing = false;

  // Movement control (disabled during portal transitions, etc.)
  private movementEnabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, config: RobotConfig = {}) {
    // Create invisible physics body (we'll use RobotVisual for rendering)
    super(scene, x, y, '__DEFAULT');

    this.maxHp = config.maxHp ?? 20;
    this.currentHp = this.maxHp;
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

    // Create the rolling sphere visual
    this.visual = new RobotVisual(scene, x, y, {
      radius: this.radius,
    });
    this.visual.setDepth(LAYERS.ENTITIES + 1);

    // Create HP bar (slightly larger than nanobot bars)
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: 32,
      height: 4,
      offsetY: -28,
    });

    // Setup physics body
    this.setCircle(this.radius);
    this.setOffset(-this.radius, -this.radius);
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

    // Sync visual position with physics body
    this.visual.syncPosition(this.x, this.y);

    // Update rolling effect based on velocity
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.visual.updateRoll(body.velocity.x, body.velocity.y, delta);

    // Update HP bar position
    this.hpBar.update(this.x, this.y, this.currentHp, this.maxHp, delta);

    this.handleMovement();
    this.handleCombat(delta);
    this.abilitySystem.update(delta);
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
    // Only dispatch to personal gems (nanobot gems are triggered by nanobots)
    const personalGems = this.getPersonalGems();
    for (const gem of personalGems) {
      gem.onAttackHit?.({
        attacker: this,
        target: context.target,
        damage: context.damage,
        scene: this.scene,
        dealDamage: context.dealDamage,
        damageDeferred: context.damageDeferred,
      });
    }

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

    this.visual.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.visual.clearTint();
      this.isFlashing = false;
    });
  }

  private die(): void {
    this.defeated = true;
    this.attackBehavior.disengage();
    this.hpBar.destroy();

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

  /** Animate the robot's face to center (for portal transitions) */
  public centerFace(duration = 400): void {
    this.visual.centerFace(duration);
  }

  destroy(fromScene?: boolean): void {
    this.visual?.destroy();
    super.destroy(fromScene);
  }
}
