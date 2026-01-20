import Phaser from 'phaser';
import { Combatable } from '../../../core/types/interfaces';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components/StatBar';
import { FloatingText } from '../../../core/components/FloatingText';
import { LAYERS } from '../../../core/config';
import { RockTypeConfig } from '../types';
import { SMALL_ROCK_CONFIG } from '../configs';

/**
 * A breakable rock that can be targeted by minions or destroyed by dashing.
 * Drops essence when destroyed.
 */
export class Rock extends Phaser.Physics.Arcade.Image implements Combatable {
  private typeConfig: RockTypeConfig;
  private hp: number;
  private defeated = false;

  // Visual components
  private hpBar: StatBar;
  private floatingText: FloatingText;

  // Death callback
  private onDeathCallback?: (rock: Rock) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config?: RockTypeConfig) {
    super(scene, x, y, '');

    this.typeConfig = config ?? SMALL_ROCK_CONFIG;
    this.hp = this.typeConfig.baseHp;

    // Create texture for this rock type
    const textureKey = this.getTextureKey();
    if (!scene.textures.exists(textureKey)) {
      this.createRockTexture(scene, textureKey);
    }

    this.setTexture(textureKey);
    this.setOrigin(0.5, 0.5);

    // Add to scene with physics
    scene.add.existing(this);

    // Use static body for blocking rocks (truly immovable), dynamic for non-blocking
    const isStatic = this.typeConfig.blocksMovement;
    scene.physics.add.existing(this, isStatic);

    this.setDepth(LAYERS.ENTITIES);

    // Set collision body to match visual size, centered on the sprite
    const { width, height } = this.typeConfig;
    if (isStatic) {
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(width, height, true); // Center the body on the sprite
    } else {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setSize(width, height);
      body.setImmovable(true);
    }

    // Make interactive for click targeting
    this.setInteractive({ useHandCursor: true });

    // HP bar (auto-hides when full)
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: this.typeConfig.width,
      offsetY: -this.typeConfig.height / 2 - 8,
    });
    this.updateHpBar();

    // Floating damage text
    this.floatingText = new FloatingText(scene);
  }

  private getTextureKey(): string {
    return `rock_${this.typeConfig.width}_${this.typeConfig.height}_${this.typeConfig.color.toString(16)}`;
  }

  private createRockTexture(scene: Phaser.Scene, key: string): void {
    const { width, height, color, strokeColor } = this.typeConfig;
    const graphics = scene.add.graphics();
    const cornerRadius = Math.min(width, height) * 0.2;

    // Draw filled rounded rectangle with stroke
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(0, 0, width, height, cornerRadius);
    graphics.lineStyle(2, strokeColor);
    graphics.strokeRoundedRect(0, 0, width, height, cornerRadius);

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.getMaxHp());
  }

  // ============================================
  // Combatable interface
  // ============================================

  public getRadius(): number {
    // Return average of half-width and half-height for targeting purposes
    return (this.typeConfig.width + this.typeConfig.height) / 4;
  }

  public getCurrentHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.typeConfig.baseHp;
  }

  public takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    // Floating damage text
    this.floatingText.show({
      text: `-${amount}`,
      x: this.x,
      y: this.y - this.typeConfig.height / 2,
      color: '#cccccc',
      fontSize: 12,
      duration: 600,
      floatSpeed: 30,
    });

    // Visual feedback - brief flash
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.defeated) this.clearTint();
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
    // Small debris chunks flying off
    const numChunks = 3;
    for (let i = 0; i < numChunks; i++) {
      const chunk = this.scene.add.rectangle(
        this.x + Phaser.Math.Between(-10, 10),
        this.y + Phaser.Math.Between(-10, 10),
        Phaser.Math.Between(3, 6),
        Phaser.Math.Between(3, 6),
        this.typeConfig.color
      );
      chunk.setDepth(LAYERS.EFFECTS);

      const angle = Math.random() * Math.PI * 2;
      const distance = Phaser.Math.Between(20, 40);

      this.scene.tweens.add({
        targets: chunk,
        x: chunk.x + Math.cos(angle) * distance,
        y: chunk.y + Math.sin(angle) * distance - 10, // Arc upward slightly
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => chunk.destroy(),
      });
    }
  }

  private playDeathParticles(): void {
    // More debris on death
    const numChunks = 8;
    for (let i = 0; i < numChunks; i++) {
      const size = Phaser.Math.Between(4, 10);
      const chunk = this.scene.add.rectangle(
        this.x + Phaser.Math.Between(-this.typeConfig.width / 3, this.typeConfig.width / 3),
        this.y + Phaser.Math.Between(-this.typeConfig.height / 3, this.typeConfig.height / 3),
        size,
        size,
        this.typeConfig.color
      );
      chunk.setDepth(LAYERS.EFFECTS);

      const angle = Math.random() * Math.PI * 2;
      const distance = Phaser.Math.Between(30, 60);

      this.scene.tweens.add({
        targets: chunk,
        x: chunk.x + Math.cos(angle) * distance,
        y: chunk.y + Math.sin(angle) * distance,
        alpha: 0,
        rotation: Math.random() * Math.PI,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => chunk.destroy(),
      });
    }
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
