import Phaser from 'phaser';
import { createActor, Actor } from 'xstate';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior, AttackUpdateContext } from '../../../core/components/AttackBehavior';
import { CombatManager } from '../../../core/components/CombatManager';
import { LevelingSystem, UnitStatBars, defaultXpCurve, CombatXpTracker, LevelUpEffect, FloatingText } from '../../../core/components';
import { Combatable, Attacker, AttackConfig, Selectable } from '../../../core/types/interfaces';
import { AbilitySystem, GemOwner, AbilityGem } from '../../../core/abilities';
import { minionMachine, MinionContext, MinionEvent, MinionState } from '../machines/minionMachine';

const MINION_RADIUS = 14;
export const MINION_VISUAL_RADIUS = 28;  // Scaled 2x for display
const STAT_BAR_WIDTH = 70;
const STAT_BAR_OFFSET_Y = -42;
const DEFAULT_AGGRO_RADIUS = 100;
const ARRIVAL_DISTANCE = 15;
const PRECISE_ARRIVAL_DISTANCE = 2;

// Default minion base stats at level 1
const DEFAULT_BASE_STATS = {
  maxHp: 5,
  maxMp: 5,
  strength: 1,
  dexterity: 1,
  magic: 1,
  resilience: 1,
};

// Stat growth per level
const DEFAULT_STAT_GROWTH = {
  maxHp: 1,
  maxMp: 1,
  strength: 0.5,
};

const DEFAULT_ATTACK_COOLDOWN = 500;

export interface MinionConfig {
  combatManager?: CombatManager;
  xpTracker?: CombatXpTracker;
  aggroRadius?: number;
}

export class Minion extends Phaser.Physics.Arcade.Sprite implements Attacker, Combatable, GemOwner, Selectable {
  // State machine
  private actor: Actor<typeof minionMachine>;

  // Visual components
  private selectionCircle?: Phaser.GameObjects.Graphics;
  private statBars!: UnitStatBars;
  private levelUpEffect!: LevelUpEffect;
  private floatingText!: FloatingText;

  // Movement and combat components
  private movement!: TargetedMovement;
  private attackBehavior!: AttackBehavior;
  private combatAngleOffset = 0;

  // Animation
  private hopTween?: Phaser.Tweens.Tween;
  private isHopping = false;

  // Stats and leveling
  private leveling: LevelingSystem;
  private hp: number;
  private mp: number;
  private defeated = false;

  // Combat support
  private combatManager?: CombatManager;
  private xpTracker?: CombatXpTracker;
  private nearbyEnemies: Combatable[] = [];
  private aggroRadius: number;

  // Callbacks
  private onDeathCallback?: () => void;

  // Ability system
  private abilitySystem: AbilitySystem;
  private nearbyAllies: Minion[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, config: MinionConfig = {}) {
    super(scene, x, y, '');

    // Initialize core systems
    this.actor = createActor(minionMachine);
    this.actor.start();

    this.leveling = new LevelingSystem({
      baseStats: DEFAULT_BASE_STATS,
      growthPerLevel: DEFAULT_STAT_GROWTH,
      xpCurve: defaultXpCurve,
    });

    this.abilitySystem = new AbilitySystem(this, { maxSlots: 1 });

    const stats = this.getEffectiveStats();
    this.hp = stats.maxHp;
    this.mp = stats.maxMp;

    // Store config
    this.combatManager = config.combatManager;
    this.xpTracker = config.xpTracker;
    this.aggroRadius = config.aggroRadius ?? DEFAULT_AGGRO_RADIUS;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    // Setup components
    this.setupVisuals(scene);
    this.setupAnimations(scene);
    this.setupMovementAndCombat(scene);
    this.setupUI(scene);
  }

  // ============ Constructor Helpers ============

  private setupVisuals(scene: Phaser.Scene): void {
    this.setTexture('minion');
    this.setTint(0x87ceeb);
    scene.textures.get('minion').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.setScale(2);
  }

  private setupAnimations(scene: Phaser.Scene): void {
    // Idle blink animation
    if (!scene.anims.exists('minion-idle')) {
      scene.anims.create({
        key: 'minion-idle',
        frames: [
          { key: 'minion', frame: 0, duration: 2000 },
          { key: 'minion', frame: 1, duration: 150 },
          { key: 'minion', frame: 2, duration: 150 },
          { key: 'minion', frame: 1, duration: 150 },
        ],
        repeat: -1,
      });
    }
    this.play('minion-idle');

    // Gooey undulating scale
    const baseScale = 2;
    const scaleVariation = 0.15;
    scene.tweens.add({
      targets: this,
      scaleX: baseScale + scaleVariation,
      scaleY: baseScale - scaleVariation,
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setupMovementAndCombat(scene: Phaser.Scene): void {
    this.movement = new TargetedMovement(this, {
      speed: 120,
      arrivalDistance: 10,
      slowdownDistance: 80,
      minSpeedScale: 0.3
    });

    this.attackBehavior = new AttackBehavior({
      defaultAttack: this.getPrimaryAttack()
    });

    this.attackBehavior.onAttack((ctx) => {
      this.showAttackEffect(ctx.target);
      this.abilitySystem.onAttackHit(
        ctx.target,
        ctx.damage,
        scene,
        ctx.dealDamage,
        ctx.damageDeferred
      );
      this.xpTracker?.recordParticipation(this, ctx.target);
    });

    this.attackBehavior.onTargetDefeated(() => {
      this.actor.send({ type: 'ENEMY_DEFEATED' });
      this.attackBehavior.disengage();
      this.combatManager?.endCombat(this);
    });
  }

  private setupUI(scene: Phaser.Scene): void {
    // Level up effects
    this.levelUpEffect = new LevelUpEffect(scene);
    this.floatingText = new FloatingText(scene);

    this.leveling.onLevelUp(() => {
      const oldStats = this.getEffectiveStats();
      const newStats = this.getEffectiveStats();
      this.hp = Math.min(this.hp + (newStats.maxHp - oldStats.maxHp), newStats.maxHp);
      this.mp = Math.min(this.mp + (newStats.maxMp - oldStats.maxMp), newStats.maxMp);
      this.levelUpEffect.play(this.x, this.y);
      this.floatingText.showLevelUp(this.x, this.y);
    });

    // Selection indicator
    this.selectionCircle = scene.add.graphics();
    this.selectionCircle.lineStyle(2, 0xffff00, 1);
    this.selectionCircle.strokeCircle(0, 0, MINION_VISUAL_RADIUS);
    this.selectionCircle.setVisible(false);

    // Stat bars
    this.statBars = new UnitStatBars(scene, {
      width: STAT_BAR_WIDTH,
      offsetY: STAT_BAR_OFFSET_Y,
      barHeight: 4,
    });
  }

  // ============ Hop Animation ============

  private startHopping(): void {
    if (this.isHopping) return;
    this.isHopping = true;

    // Squash and stretch animation to simulate hopping
    this.hopTween = this.scene.tweens.add({
      targets: this,
      scaleY: { from: 2, to: 2.3 },
      scaleX: { from: 2, to: 1.7 },
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeOut',
    });
  }

  private stopHopping(): void {
    if (!this.isHopping) return;
    this.isHopping = false;

    this.hopTween?.stop();
    this.hopTween = undefined;

    // Reset to base scale
    this.setScale(2);
  }

  // ============ State Machine Interface ============

  /**
   * Get the current state from the state machine
   */
  getState(): MinionState {
    return this.actor.getSnapshot().value as MinionState;
  }

  /**
   * Get the state machine context
   */
  private getContext(): MinionContext {
    return this.actor.getSnapshot().context;
  }

  /**
   * Send an event to the state machine
   */
  send(event: MinionEvent): void {
    const prevState = this.getState();
    this.actor.send(event);

    const newState = this.getState();
    const context = this.getContext();

    // Handle state transition side effects
    if (newState === 'fighting' && context.combatTarget && prevState !== 'fighting') {
      // Entering combat
      this.combatAngleOffset = Math.random() * Math.PI * 2;
      this.attackBehavior.engage(context.combatTarget);
      this.combatManager?.startCombat(this, context.combatTarget);
    }

    if (newState === 'idle' && prevState !== 'idle') {
      // Entering idle
      this.movement.stop();
    }
  }

  // ============ Stat Helpers ============

  private getEffectiveStats() {
    return this.leveling.getEffectiveStats(this.abilitySystem.getStatModifiers());
  }

  public getPrimaryAttack(): AttackConfig {
    const stats = this.getEffectiveStats();
    return {
      damage: Math.max(1, Math.floor(stats.strength)),
      cooldownMs: DEFAULT_ATTACK_COOLDOWN,
      effectType: 'melee'
    };
  }

  public getEffectiveAttack(): AttackConfig {
    const base = this.getPrimaryAttack();
    const modifiers = this.abilitySystem.getAttackModifiers();
    return { ...base, ...modifiers };
  }

  // ============ Selection (for visual feedback only) ============

  public select(): void {
    this.selectionCircle?.setVisible(true);
  }

  public deselect(): void {
    this.selectionCircle?.setVisible(false);
  }

  public isSelected(): boolean {
    return this.selectionCircle?.visible ?? false;
  }

  // ============ Followable/Combatable Interface ============

  public getRadius(): number {
    return MINION_RADIUS;
  }

  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.getEffectiveStats().maxHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateStatBars();

    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  // ============ GemOwner Interface ============

  public getCurrentMp(): number {
    return this.mp;
  }

  public getMaxMp(): number {
    return this.getEffectiveStats().maxMp;
  }

  public spendMp(amount: number): boolean {
    if (this.mp < amount) return false;
    this.mp -= amount;
    this.updateStatBars();
    return true;
  }

  public heal(amount: number): void {
    if (this.defeated) return;
    const maxHp = this.getMaxHp();
    const oldHp = this.hp;
    this.hp = Math.min(maxHp, this.hp + amount);

    if (this.hp > oldHp) {
      this.updateStatBars();
      this.scene.tweens.add({
        targets: this,
        alpha: 0.7,
        duration: 100,
        yoyo: true,
      });
    }
  }

  public getScene(): Phaser.Scene {
    return this.scene;
  }

  public getStat(stat: 'strength' | 'magic' | 'dexterity'): number {
    return this.getEffectiveStats()[stat];
  }

  public getNearbyAllies(radius: number): GemOwner[] {
    return this.nearbyAllies.filter(ally => {
      if (ally === this || ally.isDefeated()) return false;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, ally.x, ally.y);
      return distance <= radius;
    });
  }

  public setNearbyAllies(allies: Minion[]): void {
    this.nearbyAllies = allies;
  }

  public setNearbyEnemies(enemies: Combatable[]): void {
    this.nearbyEnemies = enemies;
  }

  public equipGem(gem: AbilityGem, slot?: number): boolean {
    const success = this.abilitySystem.equipGem(gem, slot);
    if (success) {
      const stats = this.getEffectiveStats();
      this.hp = Math.min(this.hp, stats.maxHp);
      this.mp = Math.min(this.mp, stats.maxMp);
      this.updateStatBars();
    }
    return success;
  }

  public getAbilitySystem(): AbilitySystem {
    return this.abilitySystem;
  }

  public addXp(amount: number): void {
    this.leveling.addXp(amount);
  }

  public getLevel(): number {
    return this.leveling.getLevel();
  }

  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  // ============ Update Loop ============

  update(delta: number = 0): void {
    if (this.defeated) return;

    // Update selection circle position
    if (this.selectionCircle) {
      this.selectionCircle.setPosition(this.x, this.y);
    }

    this.updateStatBars();
    this.abilitySystem.update(delta);

    const state = this.getState();
    const context = this.getContext();

    switch (state) {
      case 'idle':
        this.updateIdle();
        break;

      case 'moving':
        this.updateMoving(context);
        break;

      case 'retreating':
        this.updateRetreating(context);
        break;

      case 'fighting':
        this.updateFighting(context, delta);
        break;
    }
  }

  private updateIdle(): void {
    this.stopHopping();

    // Check for nearby enemies to auto-attack
    const nearestEnemy = this.findNearestEnemy();
    if (nearestEnemy) {
      this.send({ type: 'ENEMY_NEARBY', enemy: nearestEnemy });
    }
  }

  private updateMoving(context: MinionContext): void {
    // Check for nearby enemies to auto-attack
    const nearestEnemy = this.findNearestEnemy();
    if (nearestEnemy) {
      this.send({ type: 'ENEMY_NEARBY', enemy: nearestEnemy });
      return;
    }

    this.moveToDestination(context);
  }

  /** Move to destination without checking for enemies (used when retreating) */
  private updateRetreating(context: MinionContext): void {
    this.moveToDestination(context);
  }

  private moveToDestination(context: MinionContext): void {
    if (!context.destination) {
      this.send({ type: 'ARRIVED' });
      this.stopHopping();
      return;
    }

    const dest = context.destination;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, dest.x, dest.y);
    const arrivalDist = context.preciseArrival ? PRECISE_ARRIVAL_DISTANCE : ARRIVAL_DISTANCE;

    if (dist <= arrivalDist) {
      this.send({ type: 'ARRIVED' });
      this.movement.stop();
      this.stopHopping();
      return;
    }

    this.startHopping();
    this.movement.moveTo(dest.x, dest.y);
    this.movement.update();
  }

  private updateFighting(context: MinionContext, delta: number): void {
    const target = context.combatTarget;
    if (!target || target.isDefeated()) {
      this.send({ type: 'ENEMY_DEFEATED' });
      this.stopHopping();
      return;
    }

    // Position at attack range
    const effectiveAttack = this.getEffectiveAttack();
    const attackRange = effectiveAttack.range ?? 0;
    const combatDistance = target.getRadius() + MINION_RADIUS + attackRange;
    const targetX = target.x + Math.cos(this.combatAngleOffset) * combatDistance;
    const targetY = target.y + Math.sin(this.combatAngleOffset) * combatDistance;

    // Check if we're close enough to attack (stop hopping) or need to move (keep hopping)
    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (distToTarget > 5) {
      this.startHopping();
    } else {
      this.stopHopping();
    }

    this.movement.moveTo(targetX, targetY);

    // Update attack behavior
    const attackContext: AttackUpdateContext = {
      attackerX: this.x,
      attackerY: this.y,
      attackerRadius: MINION_RADIUS,
      effectiveAttack,
    };
    this.attackBehavior.update(delta, attackContext);
    this.movement.update();
  }

  private findNearestEnemy(): Combatable | null {
    let nearest: Combatable | null = null;
    let nearestDist = this.aggroRadius;

    for (const enemy of this.nearbyEnemies) {
      if (enemy.isDefeated()) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  // ============ Private Helpers ============

  private die(): void {
    if (this.defeated) return;

    this.defeated = true;
    this.actor.stop();
    this.deselect();

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      onComplete: () => {
        if (this.onDeathCallback) {
          this.onDeathCallback();
        }
        this.destroy();
      }
    });
  }

  private updateStatBars(): void {
    const stats = this.getEffectiveStats();
    this.statBars.update(
      this.x,
      this.y,
      this.hp,
      stats.maxHp,
      this.mp,
      stats.maxMp,
      this.leveling.getXp(),
      this.leveling.getXpToNextLevel()
    );
  }

  private showAttackEffect(target: Combatable): void {
    const startX = this.x;
    const startY = this.y;

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const jabDistance = 8;
    const jabX = this.x + Math.cos(angle) * jabDistance;
    const jabY = this.y + Math.sin(angle) * jabDistance;

    this.scene.tweens.add({
      targets: this,
      x: jabX,
      y: jabY,
      duration: 50,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        this.x = startX;
        this.y = startY;
      }
    });
  }

  destroy(fromScene?: boolean): void {
    this.actor.stop();
    this.hopTween?.stop();
    this.selectionCircle?.destroy();
    this.statBars.destroy();
    this.levelUpEffect.destroy();
    super.destroy(fromScene);
  }
}
