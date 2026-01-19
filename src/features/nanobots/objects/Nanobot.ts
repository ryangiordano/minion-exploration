import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior, AttackCallbackContext } from '../../../core/components/AttackBehavior';
import { Robot } from '../../robot';

/** Visual radius for collision/display purposes */
export const NANOBOT_VISUAL_RADIUS = 12;

/** Nanobot states */
export type NanobotState = 'following' | 'moving' | 'fighting';

/** Configuration for spawning a nanobot */
export interface NanobotConfig {
  robot: Robot;
  /** Fixed angle offset from robot center (radians) */
  orbitAngle: number;
  /** Base orbit distance from robot */
  orbitDistance?: number;
}

/**
 * A small nanobot that follows the robot and inherits abilities from
 * the robot's nanobot gem slots.
 */
export class Nanobot extends Phaser.Physics.Arcade.Sprite implements Combatable {
  private readonly radius = NANOBOT_VISUAL_RADIUS;

  // Parent robot reference
  private robot: Robot;

  // Orbit position (for following formation)
  private readonly orbitAngle: number;
  private readonly orbitDistance: number;

  // Movement
  private movement: TargetedMovement;
  private readonly moveSpeed = 140;

  // Behavior state (named to avoid conflict with Phaser's state property)
  private behaviorState: NanobotState = 'following';

  // Health
  private currentHp = 3;
  private readonly maxHp = 3;
  private defeated = false;

  // Combat
  private attackBehavior: AttackBehavior;
  private nearbyEnemies: Combatable[] = [];
  private readonly aggroRadius = 80;

  // Death callback
  private onDeathCallback?: () => void;

  // Visual
  private isFlashing = false;
  private floatPhaseOffset: number;
  private readonly floatSpeed = 0.003; // Radians per ms
  private readonly floatDistance = 6;

  constructor(scene: Phaser.Scene, x: number, y: number, config: NanobotConfig) {
    super(scene, x, y, 'nanobot');

    this.robot = config.robot;
    this.orbitAngle = config.orbitAngle;
    this.orbitDistance = config.orbitDistance ?? 50;

    // Random phase offset so nanobots don't float in sync
    this.floatPhaseOffset = Math.random() * Math.PI * 2;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale down - the sprite is 128x128, we want it smaller (about 40px visual)
    this.setScale(0.3);

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup movement
    this.movement = new TargetedMovement(this, {
      speed: this.moveSpeed,
      arrivalDistance: 8,
      slowdownDistance: 40,
      minSpeedScale: 0.4,
    });

    // Setup attack behavior with base stats
    this.attackBehavior = new AttackBehavior({
      defaultAttack: {
        damage: 1,
        cooldownMs: 1000,
        effectType: 'melee',
        range: 0,
      },
    });

    this.attackBehavior.onAttack((context) => this.handleAttack(context));
    this.attackBehavior.onTargetDefeated(() => this.onTargetDefeated());
  }

  private floatTime = 0;

  update(delta: number): void {
    if (this.defeated) return;

    // Update floating animation (visual only, doesn't affect physics position)
    this.floatTime += delta;
    const floatOffset = Math.sin(this.floatTime * this.floatSpeed + this.floatPhaseOffset) * this.floatDistance;
    this.setOrigin(0.5, 0.5 - floatOffset / this.height);

    switch (this.behaviorState) {
      case 'following':
        this.updateFollowing();
        break;
      case 'moving':
        this.updateMoving();
        break;
      case 'fighting':
        this.updateFighting(delta);
        break;
    }
  }

  private updateFollowing(): void {
    // Calculate orbit position around robot
    const targetX = this.robot.x + Math.cos(this.orbitAngle) * this.orbitDistance;
    const targetY = this.robot.y + Math.sin(this.orbitAngle) * this.orbitDistance;

    this.movement.moveTo(targetX, targetY);
    this.movement.update();
  }

  private updateMoving(): void {
    const arrived = this.movement.update();

    if (arrived) {
      // Check for enemies at destination
      const enemy = this.findClosestEnemy();
      if (enemy) {
        this.startFighting(enemy);
      } else {
        // No enemies, switch back to following
        this.behaviorState = 'following';
      }
    } else {
      // While moving, check for enemies to auto-aggro
      const enemy = this.findClosestEnemy();
      if (enemy) {
        this.startFighting(enemy);
      }
    }
  }

  private updateFighting(delta: number): void {
    // Check if target is still valid
    if (!this.attackBehavior.isEngaged()) {
      // Find new target or return to following
      const enemy = this.findClosestEnemy();
      if (enemy) {
        this.startFighting(enemy);
      } else {
        this.behaviorState = 'following';
        return;
      }
    }

    // Move toward target if not in range
    const target = this.attackBehavior.getTarget();
    if (target) {
      const effectiveAttack = this.getEffectiveAttack();
      const attackRange = effectiveAttack.range ?? 0;
      const touchDistance = this.radius + target.getRadius();
      const maxAttackDistance = touchDistance + attackRange;

      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

      if (dist > maxAttackDistance) {
        // Move toward target
        this.movement.moveTo(target.x, target.y);
        this.movement.update();
      } else {
        // In range, stop moving
        this.movement.stop();
      }
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

  private startFighting(enemy: Combatable): void {
    this.behaviorState = 'fighting';
    this.attackBehavior.engage(enemy);
  }

  private onTargetDefeated(): void {
    // Find new target or return to following
    const enemy = this.findClosestEnemy();
    if (enemy) {
      this.startFighting(enemy);
    } else {
      this.behaviorState = 'following';
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

  /** Get the effective attack config, applying robot's nanobot gems */
  private getEffectiveAttack(): AttackConfig {
    const baseAttack: AttackConfig = {
      damage: 1,
      cooldownMs: 1000,
      effectType: 'melee',
      range: 0,
    };

    // Apply modifiers from robot's nanobot gem slots
    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      const modifiers = gem.getAttackModifiers?.() ?? {};
      Object.assign(baseAttack, modifiers);
    }

    return baseAttack;
  }

  private handleAttack(context: AttackCallbackContext): void {
    // Get nanobot gems from robot and call their onAttackHit hooks
    // We pass the robot as the attacker since the robot owns the gems
    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      gem.onAttackHit?.({
        attacker: this.robot, // Use robot as attacker (it implements GemOwner)
        target: context.target,
        damage: context.damage,
        scene: this.scene,
        dealDamage: context.dealDamage,
        damageDeferred: context.damageDeferred,
      });
    }

    // Visual feedback
    if ('setTint' in context.target) {
      const sprite = context.target as unknown as Phaser.GameObjects.Sprite;
      sprite.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => sprite.clearTint());
    }
  }

  // --- Commands from SwarmManager ---

  /** Command to move to a location and attack anything found */
  public commandMoveTo(x: number, y: number): void {
    this.behaviorState = 'moving';
    this.attackBehavior.disengage();
    this.movement.moveTo(x, y);
  }

  /** Command to return to following the robot */
  public commandRecall(): void {
    this.behaviorState = 'following';
    this.attackBehavior.disengage();
  }

  /** Set the list of nearby enemies for auto-targeting */
  public setNearbyEnemies(enemies: Combatable[]): void {
    this.nearbyEnemies = enemies;
  }

  /** Get current state */
  public getBehaviorState(): NanobotState {
    return this.behaviorState;
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
    this.flashDamage();

    if (this.currentHp <= 0) {
      this.die();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  public getRadius(): number {
    return this.radius;
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
    this.movement.stop();

    // Death animation - shrink and fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      onComplete: () => {
        this.onDeathCallback?.();
        this.destroy();
      },
    });
  }

  /** Register a callback for when the nanobot dies */
  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }
}
