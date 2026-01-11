import Phaser from 'phaser';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { AttackBehavior } from '../../../core/components/AttackBehavior';
import { HpBar } from '../../../core/components/HpBar';
import { CombatManager } from '../../../core/components/CombatManager';
import { Unit, Followable, Combatable, Attacker, AttackConfig } from '../../../core/types/interfaces';

const MINION_RADIUS = 10;

// Default minion stats
const DEFAULT_ATTACK: AttackConfig = {
  damage: 1,
  cooldownMs: 500,
  effectType: 'melee'
};

const DEFAULT_MAX_HP = 3;

export interface MinionConfig {
  maxHp?: number;
  combatManager?: CombatManager;
}

export class Minion extends Phaser.Physics.Arcade.Sprite implements Unit, Attacker, Combatable {
  private selected = false;
  private selectionCircle?: Phaser.GameObjects.Graphics;
  private movement!: TargetedMovement;
  private attackBehavior!: AttackBehavior;
  private arrivalCallback?: () => void;
  private followingTarget?: Followable;
  private followAngleOffset = 0;
  private persistentFollow = false;

  // HP state
  private hp: number;
  private maxHp: number;
  private defeated = false;
  private hpBar: HpBar;

  // Combat state
  private combatTarget?: Combatable;
  private onCombatTargetDefeated?: () => void;
  private combatManager?: CombatManager;

  // Death callback
  private onDeathCallback?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MinionConfig = {}) {
    super(scene, x, y, '');

    // Initialize HP
    this.maxHp = config.maxHp ?? DEFAULT_MAX_HP;
    this.hp = this.maxHp;

    // Store combat manager reference
    this.combatManager = config.combatManager;

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

    // Visual feedback when attacking
    this.attackBehavior.onAttack((target) => {
      this.showAttackEffect(target);
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

    // Create HP bar (auto-hides when full)
    this.hpBar = new HpBar(scene, {
      width: MINION_RADIUS * 2,
      offsetY: -MINION_RADIUS - 6
    });
  }

  public getPrimaryAttack(): AttackConfig {
    return DEFAULT_ATTACK;
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
    this.arrivalCallback = onArrival;
    this.movement.moveTo(x, y);
  }

  public followTarget(target: Followable, onArrival?: () => void, persistent = false): void {
    this.exitCombat(); // Cancel combat if following new target
    this.followingTarget = target;
    this.arrivalCallback = onArrival;
    this.persistentFollow = persistent;
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

  // Combatable interface
  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.maxHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

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

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.maxHp);
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
    // Update selection circle position
    if (this.selectionCircle) {
      this.selectionCircle.setPosition(this.x, this.y);
    }

    // Update HP bar position
    this.updateHpBar();

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
        }
        if (callback) callback();
        return;
      }
    }

    // Update movement component
    const arrived = this.movement.update();

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
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
