import Phaser from 'phaser';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior } from '../../../core/components/AttackBehavior';
import { CombatManager } from '../../../core/components/CombatManager';
import { ThreatTracker } from '../../../core/components/ThreatTracker';
import { LevelingSystem, UnitStatBars, defaultXpCurve, CombatXpTracker } from '../../../core/components';
import { Unit, Followable, Combatable, Attacker, AttackConfig, AggroCapable } from '../../../core/types/interfaces';

const MINION_RADIUS = 10;

// Default minion base stats at level 1
const DEFAULT_BASE_STATS = {
  maxHp: 3,
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

const DEFAULT_AGGRO_RADIUS = 100;

export interface MinionConfig {
  combatManager?: CombatManager;
  xpTracker?: CombatXpTracker;
  aggroRadius?: number;
  enableAutoAggro?: boolean;
}

export class Minion extends Phaser.Physics.Arcade.Sprite implements Unit, Attacker, Combatable, AggroCapable {
  private selected = false;
  private selectionCircle?: Phaser.GameObjects.Graphics;
  private movement!: TargetedMovement;
  private attackBehavior!: AttackBehavior;
  private arrivalCallback?: () => void;
  private followingTarget?: Followable;
  private followAngleOffset = 0;
  private persistentFollow = false;

  // Stats and leveling
  private leveling: LevelingSystem;
  private hp: number;
  private mp: number;
  private defeated = false;
  private statBars: UnitStatBars;

  // Combat state
  private combatTarget?: Combatable;
  private onCombatTargetDefeated?: () => void;
  private combatManager?: CombatManager;
  private xpTracker?: CombatXpTracker;

  // Aggro state
  private threatTracker?: ThreatTracker;
  private nearbyEnemies: Combatable[] = [];
  private autoAggroEnabled: boolean;
  private hasActiveCommand = false; // True when executing a player command

  // Death callback
  private onDeathCallback?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MinionConfig = {}) {
    super(scene, x, y, '');

    // Initialize leveling system
    this.leveling = new LevelingSystem({
      baseStats: DEFAULT_BASE_STATS,
      growthPerLevel: DEFAULT_STAT_GROWTH,
      xpCurve: defaultXpCurve,
    });

    // Initialize HP and MP from base stats
    const stats = this.leveling.getStats();
    this.hp = stats.maxHp;
    this.mp = stats.maxMp;

    // Handle level ups - increase max HP/MP and heal the difference
    this.leveling.onLevelUp((_newLevel, newStats) => {
      const oldMaxHp = stats.maxHp;
      const oldMaxMp = stats.maxMp;
      // Heal the amount gained
      this.hp = Math.min(this.hp + (newStats.maxHp - oldMaxHp), newStats.maxHp);
      this.mp = Math.min(this.mp + (newStats.maxMp - oldMaxMp), newStats.maxMp);
    });

    // Store combat manager and XP tracker references
    this.combatManager = config.combatManager;
    this.xpTracker = config.xpTracker;

    // Setup auto-aggro
    this.autoAggroEnabled = config.enableAutoAggro !== false;
    if (this.autoAggroEnabled) {
      this.threatTracker = new ThreatTracker({
        aggroRadius: config.aggroRadius ?? DEFAULT_AGGRO_RADIUS,
        baseThreat: 10,
        damageMultiplier: 5,
        decayRate: 2
      });
    }

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (small green circle for MVP)
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x50c878, 1); // Emerald green
    graphics.fillCircle(10, 10, 10);
    graphics.generateTexture('minion', 20, 20);
    graphics.destroy();

    this.setTexture('minion');

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup movement component
    this.movement = new TargetedMovement(this, {
      speed: 120,
      arrivalDistance: 10,
      slowdownDistance: 80,
      minSpeedScale: 0.3
    });

    // Setup attack behavior component
    this.attackBehavior = new AttackBehavior({
      defaultAttack: this.getPrimaryAttack()
    });

    // Visual feedback when attacking and record participation for XP
    this.attackBehavior.onAttack((target) => {
      this.showAttackEffect(target);
      // Record combat participation for XP distribution
      this.xpTracker?.recordParticipation(this, target);
    });

    // Handle target defeated
    this.attackBehavior.onTargetDefeated(() => {
      this.exitCombat();
    });

    // Make interactive
    this.setInteractive({ useHandCursor: true });

    // Create selection indicator (invisible by default)
    this.selectionCircle = scene.add.graphics();
    this.selectionCircle.lineStyle(2, 0xffff00, 1);
    this.selectionCircle.strokeCircle(0, 0, 14);
    this.selectionCircle.setVisible(false);

    // Create stat bars (HP, MP, XP)
    this.statBars = new UnitStatBars(scene, {
      width: MINION_RADIUS * 2,
      offsetY: -MINION_RADIUS - 12,
      barHeight: 3,
    });
  }

  public getPrimaryAttack(): AttackConfig {
    const stats = this.leveling.getStats();
    return {
      damage: Math.floor(stats.strength),
      cooldownMs: DEFAULT_ATTACK_COOLDOWN,
      effectType: 'melee'
    };
  }

  public select(): void {
    this.selected = true;
    this.selectionCircle?.setVisible(true);
  }

  public deselect(): void {
    this.selected = false;
    this.selectionCircle?.setVisible(false);
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public moveTo(x: number, y: number, onArrival?: () => void): void {
    this.exitCombat(); // Cancel combat if moving
    this.followingTarget = undefined;
    this.persistentFollow = false;
    this.hasActiveCommand = true; // Player command overrides auto-aggro
    this.arrivalCallback = onArrival;
    this.movement.moveTo(x, y);
  }

  public followTarget(target: Followable, onArrival?: () => void, persistent = false): void {
    this.exitCombat(); // Cancel combat if following new target
    this.followingTarget = target;
    this.arrivalCallback = onArrival;
    this.persistentFollow = persistent;
    this.hasActiveCommand = true; // Player command overrides auto-aggro
    this.followAngleOffset = Math.random() * Math.PI * 2;
    this.movement.moveTo(target.x, target.y);
  }

  public stopMoving(): void {
    this.followingTarget = undefined;
    this.persistentFollow = false;
    this.movement.stop();
  }

  public getRadius(): number {
    return MINION_RADIUS;
  }

  public getAggroRadius(): number {
    return this.threatTracker?.getAggroRadius() ?? 0;
  }

  /**
   * Set the list of potential targets for auto-aggro
   */
  public setNearbyEnemies(enemies: Combatable[]): void {
    this.nearbyEnemies = enemies;
  }

  // Combatable interface
  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.leveling.getStats().maxHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateStatBars();

    // Visual feedback: flash red
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

  /**
   * Add XP to this minion
   */
  public addXp(amount: number): void {
    this.leveling.addXp(amount);
  }

  /**
   * Get the current level
   */
  public getLevel(): number {
    return this.leveling.getLevel();
  }

  /**
   * Set callback for when this minion dies
   */
  public onDeath(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  private die(): void {
    if (this.defeated) return;

    this.defeated = true;
    this.exitCombat();
    this.deselect();

    // Death animation
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
    const stats = this.leveling.getStats();
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

  /**
   * Enter combat mode with a target
   */
  public enterCombat(target: Combatable, onDefeated: () => void): void {
    this.combatTarget = target;
    this.onCombatTargetDefeated = onDefeated;
    this.attackBehavior.engage(target);
    this.followAngleOffset = Math.random() * Math.PI * 2;

    // Register combat through manager (handles attacker registration)
    this.combatManager?.startCombat(this, target);
  }

  /**
   * Exit combat mode
   */
  public exitCombat(): void {
    if (!this.combatTarget) return;

    const callback = this.onCombatTargetDefeated;
    const wasDefeated = this.combatTarget.isDefeated();

    this.combatTarget = undefined;
    this.onCombatTargetDefeated = undefined;
    this.attackBehavior.disengage();

    // End combat through manager (handles attacker unregistration)
    this.combatManager?.endCombat(this);

    // Fire the defeat callback if target was defeated
    if (callback && wasDefeated) {
      callback();
    }
  }

  /**
   * Check if currently in combat
   */
  public isInCombat(): boolean {
    return this.combatTarget !== undefined && this.attackBehavior.isEngaged();
  }

  update(delta: number = 0): void {
    // Don't update if defeated (death animation playing)
    if (this.defeated) return;

    // Update selection circle position
    if (this.selectionCircle) {
      this.selectionCircle.setPosition(this.x, this.y);
    }

    // Update HP bar position
    this.updateStatBars();

    // Auto-aggro: check for nearby enemies when truly idle (no active command)
    if (this.autoAggroEnabled && !this.hasActiveCommand && !this.isInCombat() && this.threatTracker) {
      this.threatTracker.update(delta, this.x, this.y, this.nearbyEnemies);
      const highestThreat = this.threatTracker.getHighestThreat();
      if (highestThreat) {
        // Auto-engage the threat
        this.enterCombat(highestThreat, () => {});
      }
    }

    // If in combat, update attack behavior and maintain position
    if (this.isInCombat() && this.combatTarget) {
      // Stay at target's edge
      const perimeterDistance = this.combatTarget.getRadius() + MINION_RADIUS;
      const targetX = this.combatTarget.x + Math.cos(this.followAngleOffset) * perimeterDistance;
      const targetY = this.combatTarget.y + Math.sin(this.followAngleOffset) * perimeterDistance;
      this.movement.moveTo(targetX, targetY);

      // Update attack behavior
      this.attackBehavior.update(delta);

      this.movement.update();
      return;
    }

    // If following a target, update destination and check edge-based arrival
    if (this.followingTarget) {
      const perimeterDistance = this.followingTarget.getRadius() + MINION_RADIUS;
      const targetX = this.followingTarget.x + Math.cos(this.followAngleOffset) * perimeterDistance;
      const targetY = this.followingTarget.y + Math.sin(this.followAngleOffset) * perimeterDistance;

      this.movement.moveTo(targetX, targetY);

      // Check edge-based arrival (touching the target)
      // Use a slightly generous tolerance to avoid near-misses
      const distanceToTarget = Phaser.Math.Distance.Between(
        this.x, this.y,
        this.followingTarget.x, this.followingTarget.y
      );
      const touchDistance = MINION_RADIUS + this.followingTarget.getRadius() + 5; // +5 tolerance

      if (distanceToTarget <= touchDistance) {
        this.movement.stop();
        const callback = this.arrivalCallback;
        this.arrivalCallback = undefined;
        // Only clear follow target if not persistent
        if (!this.persistentFollow) {
          this.followingTarget = undefined;
          this.hasActiveCommand = false; // Command complete, allow auto-aggro
        }
        if (callback) callback();
        return;
      }
    }

    // Update movement component
    const arrived = this.movement.update();

    // Clear active command when movement completes
    if (arrived) {
      this.hasActiveCommand = false;
    }

    // Fire arrival callback if we just arrived
    // For follow targets this is a fallback if edge detection didn't trigger
    if (arrived && this.arrivalCallback) {
      const callback = this.arrivalCallback;
      const target = this.followingTarget;
      this.arrivalCallback = undefined;
      this.followingTarget = undefined;

      // If we were following a target, check we're close enough before triggering
      if (target) {
        const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
        const maxDistance = MINION_RADIUS + target.getRadius() + 15; // generous fallback
        if (distance <= maxDistance) {
          callback();
        }
        // If too far, the interaction just doesn't happen (edge case)
      } else {
        callback();
      }
    }
  }

  private showAttackEffect(target: Combatable): void {
    // Jab toward target and return - like a little tackle
    const startX = this.x;
    const startY = this.y;

    // Calculate jab direction toward target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const jabDistance = 8;
    const jabX = this.x + Math.cos(angle) * jabDistance;
    const jabY = this.y + Math.sin(angle) * jabDistance;

    // Jab forward then return
    this.scene.tweens.add({
      targets: this,
      x: jabX,
      y: jabY,
      duration: 50,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        // Ensure we return to exact position
        this.x = startX;
        this.y = startY;
      }
    });
  }

  destroy(fromScene?: boolean): void {
    this.selectionCircle?.destroy();
    this.statBars.destroy();
    super.destroy(fromScene);
  }
}
