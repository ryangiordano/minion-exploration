import Phaser from 'phaser';
import { createActor, Actor } from 'xstate';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior, AttackCallbackContext } from '../../../core/components/AttackBehavior';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { LAYERS } from '../../../core/config';
import { Robot } from '../../robot';
import { GemOwner } from '../../../core/abilities/types';
import { getEdgeDistance } from '../../../core/utils/distance';
import {
  nanobotBehaviorMachine,
  isFighting,
  NanobotStateValue,
} from '../machines';

/** Visual radius for collision/display purposes */
export const NANOBOT_VISUAL_RADIUS = 12;

/** Nanobot states (for external API compatibility) */
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

  // XState behavior machine
  private behaviorActor: Actor<typeof nanobotBehaviorMachine>;

  // Health - base stats, modified by gems
  private readonly baseMaxHp = 3;
  private effectiveMaxHp = 3;
  private currentHp = 3;
  private defeated = false;

  // Combat
  private attackBehavior: AttackBehavior;
  private readonly aggroRadius = 80;
  private aggroCooldown = 0; // Prevents immediate re-aggro after defeating a target
  private readonly aggroCooldownMs = 500; // Half second before auto-aggro kicks in again

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
  private rangeIndicator?: Phaser.GameObjects.Graphics;

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
    this.attackBehavior.onTargetDefeated(() => this.handleTargetDefeated());

    // Initialize XState behavior machine
    this.behaviorActor = createActor(nanobotBehaviorMachine);
    this.behaviorActor.start();

    // Create range indicator graphics (debug visual)
    this.rangeIndicator = scene.add.graphics();
    this.rangeIndicator.setDepth(LAYERS.ENTITIES - 1); // Behind entities
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
  private getEffectiveMoveSpeed(inCombat: boolean = false): number {
    let speed = this.baseMoveSpeed;

    const nanobotGems = this.robot.getNanobotGems();
    for (const gem of nanobotGems) {
      const modifiers = gem.getStatModifiers?.() ?? [];
      for (const mod of modifiers) {
        // Apply general moveSpeed modifiers always
        if (mod.stat === 'moveSpeed') {
          if (mod.type === 'flat') {
            speed += mod.value;
          } else {
            speed *= (1 + mod.value);
          }
        }
        // Apply combatMoveSpeed modifiers only when in combat
        if (inCombat && mod.stat === 'combatMoveSpeed') {
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

    // Get current state from machine
    const stateValue = this.behaviorActor.getSnapshot().value as NanobotStateValue;

    // Skip behavior updates when frozen
    if (stateValue === 'frozen') return;

    // Update aggro cooldown
    if (this.aggroCooldown > 0) {
      this.aggroCooldown -= delta;
    }

    // Update movement speed based on combat state
    const inCombat = isFighting(stateValue);
    this.movement.setSpeed(this.getEffectiveMoveSpeed(inCombat));

    // Update range indicator
    this.updateRangeIndicator(inCombat);

    // Execute behavior based on current state
    if (stateValue === 'following') {
      this.updateFollowing();
    } else if (stateValue === 'moving') {
      this.updateMoving();
    } else if (isFighting(stateValue)) {
      this.updateFighting(delta);
    }
  }

  /** Update the range indicator visual */
  private updateRangeIndicator(inCombat: boolean): void {
    if (!this.rangeIndicator) return;

    this.rangeIndicator.clear();

    // Only show range indicator when in combat
    if (!inCombat) return;

    const effectiveAttack = this.getEffectiveAttack();
    const attackRange = effectiveAttack.range ?? 0;

    // Don't show for melee (range 0)
    if (attackRange <= 0) return;

    // Draw range circle centered on nanobot
    // The actual attack range is edge-to-edge, so total radius is nanobot radius + attack range
    const totalRadius = this.radius + attackRange;

    this.rangeIndicator.lineStyle(1, 0xdd66ff, 0.3);
    this.rangeIndicator.strokeCircle(this.x, this.y, totalRadius);

    // Draw a subtle filled circle for visibility
    this.rangeIndicator.fillStyle(0xdd66ff, 0.05);
    this.rangeIndicator.fillCircle(this.x, this.y, totalRadius);
  }

  private updateFollowing(): void {
    // Calculate orbit position around robot
    const targetX = this.robot.x + Math.cos(this.orbitAngle) * this.orbitDistance;
    const targetY = this.robot.y + Math.sin(this.orbitAngle) * this.orbitDistance;

    this.movement.moveTo(targetX, targetY);
    this.movement.update();

    // Check for enemies to auto-aggro (if not on cooldown)
    if (this.aggroCooldown <= 0) {
      const enemy = this.findClosestEnemy();
      if (enemy) {
        this.behaviorActor.send({ type: 'ENEMY_DETECTED', enemy });
        this.attackBehavior.engage(enemy);
      }
    }
  }

  private updateMoving(): void {
    const arrived = this.movement.update();

    if (arrived) {
      this.behaviorActor.send({ type: 'ARRIVED_AT_DESTINATION' });
    } else if (this.aggroCooldown <= 0) {
      // While moving, check for enemies to auto-aggro (if not on cooldown)
      const enemy = this.findClosestEnemy();
      if (enemy) {
        this.behaviorActor.send({ type: 'ENEMY_DETECTED', enemy });
        this.attackBehavior.engage(enemy);
      }
    }
  }

  private updateFighting(delta: number): void {
    const context = this.behaviorActor.getSnapshot().context;
    const target = context.target;

    // Check if target is still valid
    if (!target || target.isDefeated()) {
      this.behaviorActor.send({ type: 'TARGET_DEFEATED' });
      this.attackBehavior.disengage();
      this.movement.stop();
      this.aggroCooldown = this.aggroCooldownMs; // Prevent immediate re-aggro
      return;
    }

    // Both commanded and auto-aggro respect attack range
    const effectiveAttack = this.getEffectiveAttack();
    const movementRange = effectiveAttack.range ?? 0;

    const edgeDistance = getEdgeDistance(
      this.x,
      this.y,
      this.radius,
      target.x,
      target.y,
      target.getRadius()
    );

    if (edgeDistance > movementRange) {
      // Move toward target
      this.movement.moveTo(target.x, target.y);
      this.movement.update();
    } else {
      // In range, stop moving
      this.movement.stop();
    }

    // Update attack behavior
    this.attackBehavior.update(delta, {
      attackerX: this.x,
      attackerY: this.y,
      attackerRadius: this.radius,
      effectiveAttack,
      attacker: this,
    });
  }

  private handleTargetDefeated(): void {
    this.behaviorActor.send({ type: 'TARGET_DEFEATED' });
    this.movement.stop();
    this.aggroCooldown = this.aggroCooldownMs; // Prevent immediate re-aggro
  }

  private findClosestEnemy(): Combatable | null {
    const context = this.behaviorActor.getSnapshot().context;
    let closest: Combatable | null = null;

    // Use the larger of base aggro radius or attack range for detection
    const effectiveAttack = this.getEffectiveAttack();
    const attackRange = effectiveAttack.range ?? 0;
    const detectionRadius = Math.max(this.aggroRadius, attackRange);
    let closestDist = detectionRadius;

    for (const enemy of context.nearbyEnemies) {
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
    this.behaviorActor.send({ type: 'COMMAND_MOVE', x, y });
    this.attackBehavior.disengage();
    this.movement.moveTo(x, y);
  }

  /** Command to return to following the robot */
  public commandRecall(): void {
    this.behaviorActor.send({ type: 'COMMAND_RECALL' });
    this.attackBehavior.disengage();
  }

  /** Command to attack a specific target */
  public commandAttack(target: Combatable): void {
    this.behaviorActor.send({ type: 'COMMAND_ATTACK', target });
    this.attackBehavior.engage(target);
  }

  /** Set the list of nearby enemies for auto-targeting */
  public setNearbyEnemies(enemies: Combatable[]): void {
    this.behaviorActor.send({ type: 'UPDATE_NEARBY_ENEMIES', enemies });
  }

  /** Get current state (for external API compatibility) */
  public getBehaviorState(): NanobotState {
    const stateValue = this.behaviorActor.getSnapshot().value as NanobotStateValue;
    if (stateValue === 'following') return 'following';
    if (stateValue === 'moving') return 'moving';
    if (stateValue === 'frozen') return 'following'; // Treat frozen as following for external API
    if (isFighting(stateValue)) return 'fighting';
    return 'following';
  }

  /** Freeze the nanobot (stops all behavior updates, used during portal transitions) */
  public freeze(): void {
    this.behaviorActor.send({ type: 'FREEZE' });
    this.attackBehavior.disengage();
    this.movement.stop();
  }

  /** Unfreeze the nanobot and return to following */
  public unfreeze(): void {
    this.behaviorActor.send({ type: 'UNFREEZE' });
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
    this.behaviorActor.stop();
    this.hpBar.destroy();
    this.rangeIndicator?.destroy();

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
