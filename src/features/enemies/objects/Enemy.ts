import Phaser from 'phaser';
import { Combatable, AttackConfig, AggroCapable } from '../../../core/types/interfaces';
import { StatBar, HP_BAR_DEFAULTS, AttackBehavior, ThreatTracker, TargetedMovement, LevelingSystem, defaultXpCurve, FloatingText } from '../../../core/components';
import { EnemyTypeConfig, EnemyConfig } from '../types';
import { LACKEY_CONFIG } from '../configs';

const DEFAULT_AGGRO_RADIUS = 150;
const DEFAULT_ATTACK_RANGE = 5; // Must be within this distance (beyond touching) to attack

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Combatable, AggroCapable {
  private typeConfig: EnemyTypeConfig;
  private leveling: LevelingSystem;
  private hp: number;
  private defeated = false;
  private hpBar: StatBar;
  private attackBehavior: AttackBehavior;
  private threatTracker: ThreatTracker;
  private movement: TargetedMovement;
  private nearbyTargets: Combatable[] = [];
  private attackRange: number;
  private followAngleOffset = 0;

  // Death callback
  private onDeathCallback?: (enemy: Enemy) => void;

  // Visual feedback
  private floatingText!: FloatingText;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig = {}) {
    super(scene, x, y, '');

    this.typeConfig = config.type ?? LACKEY_CONFIG;

    // Initialize leveling system
    this.leveling = new LevelingSystem({
      baseStats: this.typeConfig.baseStats,
      growthPerLevel: this.typeConfig.statGrowth,
      xpCurve: defaultXpCurve,
    });

    // Set starting level if specified
    if (config.level && config.level > 1) {
      this.leveling.setLevel(config.level);
    }

    // Initialize HP from stats
    const stats = this.leveling.getStats();
    this.hp = stats.maxHp;
    this.attackRange = config.attackRange ?? DEFAULT_ATTACK_RANGE;

    // Add to scene with physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (circle texture based on type)
    const radius = this.typeConfig.radius;
    const textureKey = `enemy_${radius}`;
    if (!scene.textures.exists(textureKey)) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(this.typeConfig.color, 1);
      graphics.fillCircle(radius, radius, radius);
      graphics.lineStyle(2, this.typeConfig.strokeColor);
      graphics.strokeCircle(radius, radius, radius);
      graphics.generateTexture(textureKey, radius * 2, radius * 2);
      graphics.destroy();
    }

    this.setTexture(textureKey);
    this.setScale(2);

    // Calculate visual dimensions for 2x scale
    const visualRadius = radius * 2;

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup movement component
    this.movement = new TargetedMovement(this, {
      speed: this.typeConfig.speed,
      arrivalDistance: 5,
      slowdownDistance: 40,
      minSpeedScale: 0.3
    });

    // Create HP bar component (auto-hides when full)
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: visualRadius * 2,
      offsetY: -visualRadius - 8
    });
    this.updateHpBar();

    // Make interactive for click detection
    this.setInteractive({ useHandCursor: true });

    // Floating damage text
    this.floatingText = new FloatingText(scene);

    // Setup attack behavior for fighting back (damage from stats)
    this.attackBehavior = new AttackBehavior({
      defaultAttack: this.getPrimaryAttack()
    });

    // Visual feedback when attacking
    this.attackBehavior.onAttack((ctx) => {
      this.showAttackEffect();
      // Enemies are currently melee-only, but if they had ranged attacks,
      // we'd need to handle deferred damage here (or via an ability system)
      if (ctx.damageDeferred && ctx.dealDamage) {
        ctx.dealDamage();
      }
    });

    // When current target dies, find next highest threat
    this.attackBehavior.onTargetDefeated((target) => {
      this.threatTracker.clearThreat(target);
      this.retarget();
    });

    // Setup threat tracker for aggro detection
    this.threatTracker = new ThreatTracker({
      aggroRadius: config.aggroRadius ?? DEFAULT_AGGRO_RADIUS,
      baseThreat: 10,
      damageMultiplier: 5,
      decayRate: 2
    });

    // When new threat detected, start pursuing if idle
    this.threatTracker.onNewThreat((target) => {
      if (!this.attackBehavior.isEngaged()) {
        this.attackBehavior.engage(target);
        this.followAngleOffset = Math.random() * Math.PI * 2;
      }
    });

    // When threat cleared and it was our target, retarget
    this.threatTracker.onThreatCleared((target) => {
      if (this.attackBehavior.getTarget() === target) {
        this.retarget();
      }
    });
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.getMaxHp());
  }

  public getPrimaryAttack(): AttackConfig {
    const stats = this.leveling.getStats();
    return {
      damage: Math.floor(stats.strength),
      cooldownMs: this.typeConfig.attackCooldown,
      effectType: 'melee'
    };
  }

  public getRadius(): number {
    return this.typeConfig.radius;
  }

  public getAggroRadius(): number {
    return this.threatTracker.getAggroRadius();
  }

  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.leveling.getStats().maxHp;
  }

  public getLevel(): number {
    return this.leveling.getLevel();
  }

  /** Returns random essence drop amount based on enemy type config */
  public getEssenceDropAmount(): number {
    const [min, max] = this.typeConfig.essenceDrop;
    return Phaser.Math.Between(min, max);
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    // Show white floating damage text
    this.floatingText.show({
      text: `-${amount}`,
      x: this.x,
      y: this.y - this.typeConfig.radius,
      color: '#ffffff',
      fontSize: 14,
      duration: 800,
      floatSpeed: 40,
    });

    // Visual feedback: flash
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
    });

    if (this.hp <= 0) {
      this.defeat();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  /**
   * Set callback for when this enemy dies
   */
  public onDeath(callback: (enemy: Enemy) => void): void {
    this.onDeathCallback = callback;
  }

  /**
   * Set the list of potential targets for aggro detection
   */
  public setNearbyTargets(targets: Combatable[]): void {
    this.nearbyTargets = targets;
  }

  /**
   * Register an attacker - adds high threat for direct combat
   */
  public addAttacker(attacker: Combatable): void {
    // Add high threat for direct attack command
    this.threatTracker.addThreat(attacker, 50);

    // If not currently fighting, start attacking
    if (!this.attackBehavior.isEngaged()) {
      this.attackBehavior.engage(attacker);
      this.followAngleOffset = Math.random() * Math.PI * 2;
    }
  }

  /**
   * Remove an attacker (e.g., when they leave combat)
   */
  public removeAttacker(attacker: Combatable): void {
    this.threatTracker.clearThreat(attacker);

    // If we were attacking them, find new target
    if (this.attackBehavior.getTarget() === attacker) {
      this.retarget();
    }
  }

  /**
   * Update - call each frame to process threat detection, movement, and attacks
   */
  public update(delta: number): void {
    if (this.defeated) return;

    // Update HP bar position
    this.updateHpBar();

    // Update threat tracker with nearby targets
    this.threatTracker.update(delta, this.x, this.y, this.nearbyTargets);

    // Re-evaluate target based on highest threat
    const highestThreat = this.threatTracker.getHighestThreat();
    const currentTarget = this.attackBehavior.getTarget();

    if (highestThreat && highestThreat !== currentTarget) {
      // Switch to higher threat target
      this.attackBehavior.engage(highestThreat);
      this.followAngleOffset = Math.random() * Math.PI * 2;
    } else if (!highestThreat && currentTarget) {
      // No threats left, disengage and stop
      this.attackBehavior.disengage();
      this.movement.stop();
    }

    // If we have a target, move toward it and attack when in range
    const target = this.attackBehavior.getTarget();
    if (target && !target.isDefeated()) {
      const radius = this.typeConfig.radius;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      const touchDistance = radius + target.getRadius();

      if (distance <= touchDistance + this.attackRange) {
        // In attack range - stop moving and attack
        this.movement.stop();
        this.attackBehavior.update(delta);
      } else {
        // Move toward target's perimeter
        const perimeterDistance = target.getRadius() + radius;
        const targetX = target.x + Math.cos(this.followAngleOffset) * perimeterDistance;
        const targetY = target.y + Math.sin(this.followAngleOffset) * perimeterDistance;
        this.movement.moveTo(targetX, targetY);
        this.movement.update();
      }
    }
  }

  private retarget(): void {
    this.attackBehavior.disengage();

    // Find highest threat target
    const highestThreat = this.threatTracker.getHighestThreat();
    if (highestThreat && !highestThreat.isDefeated()) {
      this.attackBehavior.engage(highestThreat);
      this.followAngleOffset = Math.random() * Math.PI * 2;
    } else {
      this.movement.stop();
    }
  }

  private showAttackEffect(): void {
    // Quick pulse effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 50,
      yoyo: true,
    });
  }

  public defeat(): void {
    if (this.defeated) return;

    this.defeated = true;
    this.movement.stop();

    // Fire death callback before animation (for XP distribution while attackers still registered)
    if (this.onDeathCallback) {
      this.onDeathCallback(this);
    }

    // Death animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      onComplete: () => this.destroy()
    });
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
