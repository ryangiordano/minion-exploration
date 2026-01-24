import Phaser from 'phaser';
import { Combatable } from '../../../core/types/interfaces';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { FloatingText } from '../../../core/components/FloatingText';
import { LAYERS } from '../../../core/config';
import { RockTypeConfig } from '../types';
import { SMALL_ROCK_CONFIG } from '../configs';
import { RockTextureGenerator } from '../RockTextureGenerator';

/** Counter for generating unique rock seeds */
let rockInstanceCounter = 0;

/** Light greyscale colors for debris particles */
const DEBRIS_COLORS = [0x8a8a8a, 0x9a9a9a, 0x7d7d7d, 0xa5a5a5];

/**
 * A breakable rock that can be targeted by minions or destroyed by dashing.
 * Drops essence when destroyed.
 */
export class Rock extends Phaser.Physics.Arcade.Image implements Combatable {
  private typeConfig: RockTypeConfig;
  private hp: number;
  private defeated = false;
  private instanceSeed: number;

  // Visual components
  private hpBar: StatBar;
  private floatingText: FloatingText;

  // Death callback
  private onDeathCallback?: (rock: Rock) => void;

  // Shared texture generator
  private static textureGenerator: RockTextureGenerator | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config?: RockTypeConfig) {
    super(scene, x, y, '');

    this.typeConfig = config ?? SMALL_ROCK_CONFIG;
    this.hp = this.typeConfig.baseHp;
    this.instanceSeed = rockInstanceCounter++;

    // Generate procedural texture
    if (!Rock.textureGenerator) {
      Rock.textureGenerator = new RockTextureGenerator(scene);
    }
    const textureKey = Rock.textureGenerator.generateTexture(this.typeConfig, this.instanceSeed);

    this.setTexture(textureKey);
    this.setOrigin(0.5, 0.5);

    // Add to scene with physics
    scene.add.existing(this);

    // All rocks use static bodies - they never move
    scene.physics.add.existing(this, true);

    this.setDepth(LAYERS.ENTITIES);

    // Set collision body to match visual size (square), centered on the sprite
    const { size } = this.typeConfig;
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(size, size, true);

    // Make interactive for click targeting
    this.setInteractive({ useHandCursor: true });

    // HP bar (auto-hides when full)
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: this.typeConfig.size,
      offsetY: -this.typeConfig.size / 2 - 8,
    });
    this.updateHpBar();

    // Floating damage text
    this.floatingText = new FloatingText(scene);
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.getMaxHp());
  }

  // ============================================
  // Combatable interface
  // ============================================

  public getRadius(): number {
    return this.typeConfig.size / 2;
  }

  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.typeConfig.baseHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated || !this.scene) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    // Floating damage text
    this.floatingText.show({
      text: `-${amount}`,
      x: this.x,
      y: this.y - this.typeConfig.size / 2,
      color: '#cccccc',
      fontSize: 12,
      duration: 600,
      floatSpeed: 30,
    });

    // Visual feedback - brief flash
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.defeated && this.scene) this.clearTint();
    });

    // Damage particle - small debris effect
    this.playDamageParticle();

    if (this.hp <= 0) {
      this.defeat();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  // ============================================
  // Rock-specific methods
  // ============================================

  /** Whether this rock blocks movement */
  public blocksMovement(): boolean {
    return this.typeConfig.blocksMovement;
  }

  /** Get essence drop amount */
  public getEssenceDropAmount(): number {
    const [min, max] = this.typeConfig.essenceDrop;
    return Phaser.Math.Between(min, max);
  }

  /** Register death callback */
  public onDeath(callback: (rock: Rock) => void): void {
    this.onDeathCallback = callback;
  }

  private defeat(): void {
    if (this.defeated) return;

    this.defeated = true;

    // Fire callback before animation
    if (this.onDeathCallback) {
      this.onDeathCallback(this);
    }

    // Death particles
    this.playDeathParticles();

    // Death animation - crumble effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: 0.3,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  private playDamageParticle(): void {
    // Small debris flying off when hit
    const numDebris = 2;
    for (let i = 0; i < numDebris; i++) {
      this.spawnDebris(
        this.x + Phaser.Math.Between(-10, 10),
        this.y + Phaser.Math.Between(-10, 10),
        { velocityMultiplier: 0.6, fadeDelay: 200 }
      );
    }
  }

  private playDeathParticles(): void {
    // More debris on death - they fly out, arc, land and fade
    const numDebris = Phaser.Math.Between(4, 6);
    for (let i = 0; i < numDebris; i++) {
      this.spawnDebris(
        this.x + Phaser.Math.Between(-this.typeConfig.size / 4, this.typeConfig.size / 4),
        this.y + Phaser.Math.Between(-this.typeConfig.size / 4, this.typeConfig.size / 4),
        { velocityMultiplier: 1, fadeDelay: 400 }
      );
    }
  }

  /** Spawn a circular debris piece that flies out, lands and fades */
  private spawnDebris(
    x: number,
    y: number,
    options: { velocityMultiplier: number; fadeDelay: number }
  ): void {
    if (!this.scene) return;

    // Capture scene reference for callbacks
    const scene = this.scene;

    // Create a small circle debris piece
    const debrisRadius = Phaser.Math.Between(2, 4);
    const debrisColor = Phaser.Utils.Array.GetRandom(DEBRIS_COLORS);

    const circle = scene.add.circle(x, y, debrisRadius, debrisColor);
    circle.setDepth(LAYERS.EFFECTS);

    // Random outward angle
    const angle = Math.random() * Math.PI * 2;
    const speed = Phaser.Math.Between(80, 150) * options.velocityMultiplier;
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed - 100; // Launch upward

    // Simulate physics with tweens (arc trajectory)
    const gravity = 400;
    const duration = 500;

    // Calculate landing position (simple ballistic arc)
    const landX = x + velocityX * (duration / 1000);
    const landY = y + velocityY * (duration / 1000) + 0.5 * gravity * Math.pow(duration / 1000, 2);

    // Arc motion
    scene.tweens.add({
      targets: circle,
      x: landX,
      duration: duration,
      ease: 'Linear',
    });

    // Vertical arc (up then down with gravity)
    scene.tweens.add({
      targets: circle,
      y: { value: landY, ease: 'Quad.easeIn' },
      duration: duration,
    });

    // After landing, fade out
    scene.time.delayedCall(duration + options.fadeDelay, () => {
      if (!circle.active) return;
      scene.tweens.add({
        targets: circle,
        alpha: 0,
        duration: 300,
        onComplete: () => circle.destroy(),
      });
    });
  }

  update(): void {
    if (this.defeated) return;
    this.updateHpBar();
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
