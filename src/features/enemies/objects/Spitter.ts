import Phaser from 'phaser';
import { Combatable, AggroCapable } from '../../../core/types/interfaces';
import {
  StatBar,
  HP_BAR_DEFAULTS,
  ThreatTracker,
  LevelingSystem,
  defaultXpCurve,
  FloatingText,
  DebuffManager,
  DebuffType,
  createDebuffVisual,
} from '../../../core/components';
import { WanderBehavior } from '../../../core/components/WanderBehavior';
import { LAYERS } from '../../../core/config';
import { EnemyTypeConfig, EnemyConfig } from '../types';
import { EnemyProjectile, EnemyProjectileConfig } from './EnemyProjectile';

/** Spitter-specific config extending base enemy config */
export interface SpitterConfig extends EnemyConfig {
  /** Angular spread for inaccuracy (radians). Default ±0.26 (~15°) */
  inaccuracySpread?: number;
  /** Projectile configuration */
  projectile?: EnemyProjectileConfig;
}

/** Get flash color based on HP percentage */
function getHpFlashColor(hpPercent: number): number {
  if (hpPercent > 0.75) return 0xffffff;
  if (hpPercent > 0.5) return 0xffff00;
  if (hpPercent > 0.25) return 0xff8800;
  return 0xff0000;
}

const DEFAULT_AGGRO_RADIUS = 200;
const DEFAULT_ATTACK_RANGE = 250;
const DEFAULT_INACCURACY = 0.26; // ~15 degrees

/**
 * Ranged enemy that wanders aimlessly and fires projectiles at the robot.
 * Projectiles are slow and can be dodged.
 */
export class Spitter extends Phaser.Physics.Arcade.Sprite implements Combatable, AggroCapable {
  private typeConfig: EnemyTypeConfig;
  private leveling: LevelingSystem;
  private hp: number;
  private defeated = false;
  private hpBar: StatBar;
  private threatTracker: ThreatTracker;
  private wanderBehavior: WanderBehavior;
  private nearbyTargets: Combatable[] = [];
  private attackRange: number;
  private inaccuracySpread: number;
  private projectileConfig: EnemyProjectileConfig;

  // Attack timing
  private attackCooldown: number;
  private lastAttackTime = 0;

  // Death callback
  private onDeathCallback?: (spitter: Spitter) => void;

  // Projectile spawn callback (for scene to track projectiles)
  private onProjectileSpawnCallback?: (projectile: EnemyProjectile) => void;

  // Visual feedback
  private floatingText!: FloatingText;
  private debuffs: DebuffManager;

  // Inner collision body
  private collisionBody!: Phaser.Physics.Arcade.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    typeConfig: EnemyTypeConfig,
    config: SpitterConfig = {}
  ) {
    super(scene, x, y, '');

    this.typeConfig = typeConfig;
    this.attackRange = config.attackRange ?? DEFAULT_ATTACK_RANGE;
    this.inaccuracySpread = config.inaccuracySpread ?? DEFAULT_INACCURACY;
    this.attackCooldown = typeConfig.attackCooldown;
    this.projectileConfig = config.projectile ?? {};

    // Initialize leveling system
    this.leveling = new LevelingSystem({
      baseStats: typeConfig.baseStats,
      growthPerLevel: typeConfig.statGrowth,
      xpCurve: defaultXpCurve,
    });

    if (config.level && config.level > 1) {
      this.leveling.setLevel(config.level);
    }

    const stats = this.leveling.getStats();
    this.hp = stats.maxHp;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual
    const radius = typeConfig.radius;
    const textureKey = `spitter_${radius}`;
    if (!scene.textures.exists(textureKey)) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(typeConfig.color, 1);
      graphics.fillCircle(radius, radius, radius);
      graphics.lineStyle(2, typeConfig.strokeColor);
      graphics.strokeCircle(radius, radius, radius);
      // Add a small indicator to distinguish from regular enemies
      graphics.fillStyle(0xffffff, 0.6);
      graphics.fillCircle(radius, radius - radius * 0.3, radius * 0.25);
      graphics.generateTexture(textureKey, radius * 2, radius * 2);
      graphics.destroy();
    }

    this.setTexture(textureKey);
    this.setScale(2);

    const visualRadius = radius * 2;
    this.setCollideWorldBounds(true);

    // Create inner collision body
    const collisionRadius = visualRadius / 2;
    const collisionTextureKey = `collision_circle_${collisionRadius}`;
    if (!scene.textures.exists(collisionTextureKey)) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(collisionRadius, collisionRadius, collisionRadius);
      g.generateTexture(collisionTextureKey, collisionRadius * 2, collisionRadius * 2);
      g.destroy();
    }

    this.collisionBody = scene.physics.add.image(x, y, collisionTextureKey);
    this.collisionBody.setVisible(false);
    this.collisionBody.setImmovable(false);
    this.collisionBody.setCircle(collisionRadius);
    this.collisionBody.setDepth(LAYERS.ENTITIES);

    // Setup wander behavior
    this.wanderBehavior = new WanderBehavior(this, {
      speed: typeConfig.speed,
      minWaitTime: 800,
      maxWaitTime: 2500,
      minTravelDistance: 40,
      maxTravelDistance: 120,
    });

    // HP bar
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: visualRadius * 2,
      offsetY: -visualRadius - 8,
    });
    this.updateHpBar();

    this.setInteractive({ useHandCursor: true });

    // Floating text
    this.floatingText = new FloatingText(scene);

    // Debuff system
    const entityId = `spitter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.debuffs = new DebuffManager(scene, entityId, { visualFactory: createDebuffVisual });

    // Threat tracker
    this.threatTracker = new ThreatTracker({
      aggroRadius: config.aggroRadius ?? DEFAULT_AGGRO_RADIUS,
      baseThreat: 10,
      damageMultiplier: 5,
      decayRate: 2,
    });
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.getMaxHp());
  }

  public getRadius(): number {
    return this.typeConfig.radius;
  }

  public getCollisionBody(): Phaser.Physics.Arcade.Image {
    return this.collisionBody;
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

  public getEssenceDropAmount(): number {
    const [min, max] = this.typeConfig.essenceDrop;
    return Phaser.Math.Between(min, max);
  }

  public takeDamage(amount: number, attacker?: Combatable): void {
    if (this.defeated) return;

    if (attacker && !attacker.isDefeated()) {
      this.threatTracker.addThreat(attacker, 50);
    }

    const hpPercentBefore = this.hp / this.getMaxHp();
    const flashColor = getHpFlashColor(hpPercentBefore);

    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    this.floatingText.show({
      text: `-${amount}`,
      x: this.x,
      y: this.y - this.typeConfig.radius,
      color: '#ffffff',
      fontSize: 14,
      duration: 800,
      floatSpeed: 40,
    });

    this.setTint(flashColor);
    this.scene.time.delayedCall(100, () => this.clearTint());
    this.playDamageParticle(flashColor);

    if (this.hp <= 0) {
      this.defeat();
    }
  }

  private playDamageParticle(color: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(LAYERS.EFFECTS);

    const startRadius = this.typeConfig.radius * 0.5;
    const endRadius = this.typeConfig.radius * 1.5;
    const duration = 200;

    let elapsed = 0;
    const updateEvent = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(duration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const currentRadius = startRadius + (endRadius - startRadius) * easedProgress;
        const alpha = 0.5 * (1 - progress);

        graphics.clear();
        graphics.fillStyle(color, alpha);
        graphics.fillCircle(this.x, this.y, currentRadius);

        if (progress >= 1) {
          graphics.destroy();
          updateEvent.destroy();
        }
      },
    });
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  public onDeath(callback: (spitter: Spitter) => void): void {
    this.onDeathCallback = callback;
  }

  /** Register callback for when this spitter fires a projectile */
  public onProjectileSpawn(callback: (projectile: EnemyProjectile) => void): void {
    this.onProjectileSpawnCallback = callback;
  }

  public setNearbyTargets(targets: Combatable[]): void {
    this.nearbyTargets = targets;
  }

  public update(delta: number): void {
    if (this.defeated) return;

    // Sync collision body
    this.collisionBody.setPosition(this.x, this.y);
    this.updateHpBar();
    this.debuffs.update(this.x, this.y);

    if (this.debuffs.isStunned()) {
      this.wanderBehavior.stop();
      return;
    }

    // Update threat tracker
    this.threatTracker.update(delta, this.x, this.y, this.nearbyTargets);

    const target = this.threatTracker.getHighestThreat();

    if (target && !target.isDefeated()) {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

      if (distance <= this.attackRange) {
        // In range - stop wandering and try to attack
        this.wanderBehavior.setEnabled(false);
        this.wanderBehavior.stop();
        this.tryAttack(target);
      } else {
        // Target out of range - resume wandering
        this.wanderBehavior.setEnabled(true);
        this.wanderBehavior.update(delta);
      }
    } else {
      // No target - just wander
      this.wanderBehavior.setEnabled(true);
      this.wanderBehavior.update(delta);
    }
  }

  private tryAttack(target: Combatable): void {
    const now = this.scene.time.now;
    if (now - this.lastAttackTime < this.attackCooldown) {
      return;
    }

    this.lastAttackTime = now;
    this.fireProjectile(target);
  }

  private fireProjectile(target: Combatable): void {
    // Calculate angle with inaccuracy
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const spread = (Math.random() - 0.5) * 2 * this.inaccuracySpread;
    const angle = baseAngle + spread;

    // Calculate target position based on angle (far away so projectile travels in that direction)
    const targetX = this.x + Math.cos(angle) * 1000;
    const targetY = this.y + Math.sin(angle) * 1000;

    // Get damage from stats
    const stats = this.leveling.getStats();
    const damage = Math.max(1, Math.floor(stats.strength));

    const projectile = new EnemyProjectile(
      this.scene,
      this.x,
      this.y,
      targetX,
      targetY,
      {
        ...this.projectileConfig,
        damage,
      }
    );

    // Visual feedback - muzzle flash
    this.showAttackEffect();

    // Notify scene about the new projectile
    if (this.onProjectileSpawnCallback) {
      this.onProjectileSpawnCallback(projectile);
    }
  }

  private showAttackEffect(): void {
    // Quick pulse
    this.scene.tweens.add({
      targets: this,
      scaleX: 2.3,
      scaleY: 2.3,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // Muzzle flash
    const graphics = this.scene.add.graphics();
    graphics.setDepth(LAYERS.EFFECTS);
    graphics.fillStyle(0xffaa00, 0.8);
    graphics.fillCircle(this.x, this.y, this.typeConfig.radius * 1.5);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 100,
      onComplete: () => graphics.destroy(),
    });
  }

  public defeat(): void {
    if (this.defeated) return;

    this.defeated = true;
    this.wanderBehavior.stop();

    if (this.onDeathCallback) {
      this.onDeathCallback(this);
    }

    this.playDeathParticles();

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  private playDeathParticles(): void {
    const deathX = this.x;
    const deathY = this.y;
    const baseRadius = this.typeConfig.radius;

    const colors = [0xffaa00, 0xff6600, 0xffff00];
    const delays = [0, 50, 100];
    const scales = [1.0, 0.7, 0.5];

    colors.forEach((color, index) => {
      const offsetX = (Math.random() - 0.5) * baseRadius * 1.5;
      const offsetY = (Math.random() - 0.5) * baseRadius * 1.5;
      const particleX = deathX + offsetX;
      const particleY = deathY + offsetY;

      this.scene.time.delayedCall(delays[index], () => {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(LAYERS.EFFECTS);

        const startRadius = baseRadius * scales[index];
        const endRadius = baseRadius * 3 * scales[index];
        const duration = 300;

        let elapsed = 0;
        const updateEvent = this.scene.time.addEvent({
          delay: 16,
          repeat: Math.floor(duration / 16),
          callback: () => {
            elapsed += 16;
            const progress = Math.min(1, elapsed / duration);
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            const currentRadius = startRadius + (endRadius - startRadius) * easedProgress;
            const alpha = 0.6 * (1 - progress);

            graphics.clear();
            graphics.fillStyle(color, alpha);
            graphics.fillCircle(particleX, particleY, currentRadius);

            if (progress >= 1) {
              graphics.destroy();
              updateEvent.destroy();
            }
          },
        });
      });
    });
  }

  public applyDebuff(type: DebuffType, ticks: number, onTick?: () => void): void {
    this.debuffs.apply(type, ticks, onTick);
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    this.debuffs.destroy();
    this.collisionBody.destroy();
    super.destroy(fromScene);
  }
}
