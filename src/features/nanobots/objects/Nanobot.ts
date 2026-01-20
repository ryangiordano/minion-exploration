import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior, AttackCallbackContext } from '../../../core/components/AttackBehavior';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { LAYERS } from '../../../core/config';
import { Robot } from '../../robot';
import { GemOwner } from '../../../core/abilities/types';

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
 * the robot's nanobot gem slots. Implements GemOwner so it can be the
 * executor of gem effects (projectiles spawn from nanobot position).
 */
export class Nanobot extends Phaser.Physics.Arcade.Sprite implements Combatable, GemOwner {
  private readonly radius = NANOBOT_VISUAL_RADIUS;

  // Parent robot reference
  private robot: Robot;

  // Orbit position (for following formation)
  private readonly orbitAngle: number;
  private readonly orbitDistance: number;

  // Movement
  private movement: TargetedMovement;
  private readonly baseMoveSpeed = 140;

  // Behavior state (named to avoid conflict with Phaser's state property)
  private behaviorState: NanobotState = 'following';

  // Health - base stats, modified by gems
  private readonly baseMaxHp = 3;
  private effectiveMaxHp = 3;
  private currentHp = 3;
  private defeated = false;

  // Combat
  private attackBehavior: AttackBehavior;
  private nearbyEnemies: Combatable[] = [];
  private readonly aggroRadius = 80;

  // Death callback
  private onDeathCallback?: () => void;

  // HP bar
  private hpBar: StatBar;

  // Visual
  private isFlashing = false;
  private floatPhaseOffset: number;
  private readonly floatSpeed = 0.003; // Radians per ms
  private readonly floatDistance = 6;
  private isPouncing = false;

  // Freeze state (for portal transitions)
  private frozen = false;

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

    // Set depth above enemies for visibility
    this.setDepth(LAYERS.ENTITIES + 1);

    // Create tiny HP bar
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: 16,
      height: 3,
      offsetY: -20,
    });

    // Setup physics
    this.setCollideWorldBounds(true);

    // Apply stat modifiers from gems
    this.applyGemStatModifiers();

    // Setup movement with effective speed
    this.movement = new TargetedMovement(this, {
      speed: this.getEffectiveMoveSpeed(),
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

  /** Apply stat modifiers from robot's nanobot gems */
  private applyGemStatModifiers(): void {
    // Start with base stats
    this.effectiveMaxHp = this.baseMaxHp;

    // Apply modifiers from robot's nanobot gem slots
    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      const modifiers = gem.getStatModifiers?.() ?? [];
      for (const mod of modifiers) {
        if (mod.stat === 'maxHp') {
          if (mod.type === 'flat') {
            this.effectiveMaxHp += mod.value;
          } else {
            this.effectiveMaxHp *= (1 + mod.value);
          }
        }
      }
    }

    // Ensure at least 1 HP
    this.effectiveMaxHp = Math.max(1, Math.round(this.effectiveMaxHp));

    // Set current HP to effective max (on spawn)
    this.currentHp = this.effectiveMaxHp;
  }

  /** Get effective move speed after applying gem modifiers */
  private getEffectiveMoveSpeed(): number {
    let speed = this.baseMoveSpeed;

    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      const modifiers = gem.getStatModifiers?.() ?? [];
      for (const mod of modifiers) {
        if (mod.stat === 'moveSpeed') {
          if (mod.type === 'flat') {
            speed += mod.value;
          } else {
            speed *= (1 + mod.value);
          }
        }
      }
    }

    // Ensure minimum speed
    return Math.max(20, speed);
  }

  private floatTime = 0;

  update(delta: number): void {
    if (this.defeated) return;

    // Update HP bar position
    this.hpBar.update(this.x, this.y, this.currentHp, this.effectiveMaxHp, delta);

    // Update floating animation (visual only, doesn't affect physics position)
    this.floatTime += delta;
    const floatOffset = Math.sin(this.floatTime * this.floatSpeed + this.floatPhaseOffset) * this.floatDistance;
    this.setOrigin(0.5, 0.5 - floatOffset / this.height);

    // Skip behavior updates when frozen (during portal transitions)
    if (this.frozen) return;

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
    // Pounce animation toward the target
    this.playPounceAnimation(context.target);

    // Get nanobot gems from robot and call their onAttackHit hooks
    // Pass this nanobot as attacker so effects spawn from nanobot position
    // and lifesteal heals the individual nanobot
    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      // For ranged attacks (damageDeferred), each gem gets its own damage callback
      // so multiple projectile gems each deal their own damage on impact
      const dealDamage = context.damageDeferred
        ? this.createDamageCallback(context.target, context.damage)
        : context.dealDamage;

      gem.onAttackHit?.({
        attacker: this, // Nanobot is the attacker for gem effects
        target: context.target,
        damage: context.damage,
        scene: this.scene,
        attackerType: 'nanobot',
        dealDamage,
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

  /** Create a one-time damage callback for a projectile hit */
  private createDamageCallback(target: Combatable, damage: number): () => void {
    let dealt = false;
    return () => {
      if (dealt || target.isDefeated()) return;
      dealt = true;
      target.takeDamage(damage);
    };
  }

  /** Play a quick pounce animation toward the target */
  private playPounceAnimation(target: Combatable): void {
    if (this.isPouncing || this.defeated) return;
    this.isPouncing = true;

    const startX = this.x;
    const startY = this.y;

    // Calculate pounce destination (30% of the way to target)
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const pounceX = this.x + dx * 0.3;
    const pounceY = this.y + dy * 0.3;

    // Pounce forward
    this.scene.tweens.add({
      targets: this,
      x: pounceX,
      y: pounceY,
      duration: 80,
      ease: 'Power2',
      onComplete: () => {
        // Snap back to original position
        this.scene.tweens.add({
          targets: this,
          x: startX,
          y: startY,
          duration: 100,
          ease: 'Power1',
          onComplete: () => {
            this.isPouncing = false;
          },
        });
      },
    });
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

  /** Command to attack a specific target */
  public commandAttack(target: Combatable): void {
    this.startFighting(target);
  }

  /** Set the list of nearby enemies for auto-targeting */
  public setNearbyEnemies(enemies: Combatable[]): void {
    this.nearbyEnemies = enemies;
  }

  /** Get current state */
  public getBehaviorState(): NanobotState {
    return this.behaviorState;
  }

  /** Freeze the nanobot (stops all behavior updates, used during portal transitions) */
  public freeze(): void {
    this.frozen = true;
    this.attackBehavior.disengage();
    this.movement.stop();
  }

  /** Unfreeze the nanobot and return to following */
  public unfreeze(): void {
    this.frozen = false;
    this.behaviorState = 'following';
  }

  // --- Combatable interface ---

  public getCurrentHp(): number {
    return this.currentHp;
  }

  public getMaxHp(): number {
    return this.effectiveMaxHp;
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
    this.hpBar.destroy();

    // Death particle effect - red circle expanding and fading
    this.playDeathParticle();

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

  /** Play multiple red circle particles that expand and fade on death */
  private playDeathParticle(): void {
    const deathX = this.x;
    const deathY = this.y;

    // Spawn 3 scattered particles
    const particleCount = 3;
    for (let i = 0; i < particleCount; i++) {
      // Random offset from death point
      const offsetX = (Math.random() - 0.5) * this.radius * 2;
      const offsetY = (Math.random() - 0.5) * this.radius * 2;
      const particleX = deathX + offsetX;
      const particleY = deathY + offsetY;

      // Stagger the timing slightly
      const delay = i * 30;

      this.scene.time.delayedCall(delay, () => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(LAYERS.EFFECTS);

        // Vary the size slightly
        const sizeScale = 0.6 + Math.random() * 0.4;
        const startRadius = this.radius * sizeScale;
        const endRadius = this.radius * 3 * sizeScale;
        const duration = 300;

        let elapsed = 0;
        const updateEvent = this.scene.time.addEvent({
          delay: 16,
          repeat: Math.floor(duration / 16),
          callback: () => {
            elapsed += 16;
            const progress = Math.min(1, elapsed / duration);

            // Ease out for smooth expansion
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            const currentRadius = startRadius + (endRadius - startRadius) * easedProgress;
            const alpha = 0.6 * (1 - progress);

            graphics.clear();
            graphics.fillStyle(0xff0000, alpha);
            graphics.fillCircle(particleX, particleY, currentRadius);

            if (progress >= 1) {
              graphics.destroy();
              updateEvent.destroy();
            }
          },
        });
      });
    }
  }

  /** Register a callback for when the nanobot dies */
  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  // --- GemOwner interface (nanobots don't have MP, but need these for gem execution) ---

  public getCurrentMp(): number {
    return 0;
  }

  public getMaxMp(): number {
    return 0;
  }

  public spendMp(_amount: number): boolean {
    return false;
  }

  public heal(amount: number): void {
    this.currentHp = Math.min(this.effectiveMaxHp, this.currentHp + amount);
  }

  public getScene(): Phaser.Scene {
    return this.scene;
  }
}
