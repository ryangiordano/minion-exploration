import Phaser from 'phaser';
import { Combatable } from '../../../core/types/interfaces';
import { StatBar, HP_BAR_DEFAULTS } from '../../../core/components';

const DUMMY_RADIUS = 20;

export interface TargetDummyConfig {
  maxHp?: number;     // Default: 100
  color?: number;     // Default: 0x8888aa (gray-blue)
}

/**
 * A non-aggressive target dummy for testing abilities.
 * Has high HP, doesn't move, doesn't attack.
 */
export class TargetDummy extends Phaser.Physics.Arcade.Sprite implements Combatable {
  private maxHp: number;
  private hp: number;
  private defeated = false;
  private hpBar: StatBar;

  // Death callback
  private onDeathCallback?: (dummy: TargetDummy) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config: TargetDummyConfig = {}) {
    super(scene, x, y, '');

    this.maxHp = config.maxHp ?? 100;
    this.hp = this.maxHp;

    // Add to scene with physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (gray-blue circle with crosshair pattern)
    const color = config.color ?? 0x8888aa;
    const textureKey = `target_dummy_${color}`;

    if (!scene.textures.exists(textureKey)) {
      const graphics = scene.add.graphics();
      // Main body
      graphics.fillStyle(color, 1);
      graphics.fillCircle(DUMMY_RADIUS, DUMMY_RADIUS, DUMMY_RADIUS);
      // Target rings
      graphics.lineStyle(2, 0xffffff, 0.5);
      graphics.strokeCircle(DUMMY_RADIUS, DUMMY_RADIUS, DUMMY_RADIUS);
      graphics.strokeCircle(DUMMY_RADIUS, DUMMY_RADIUS, DUMMY_RADIUS * 0.6);
      // Crosshair
      graphics.lineStyle(1, 0xffffff, 0.3);
      graphics.lineBetween(DUMMY_RADIUS, 0, DUMMY_RADIUS, DUMMY_RADIUS * 2);
      graphics.lineBetween(0, DUMMY_RADIUS, DUMMY_RADIUS * 2, DUMMY_RADIUS);
      graphics.generateTexture(textureKey, DUMMY_RADIUS * 2, DUMMY_RADIUS * 2);
      graphics.destroy();
    }

    this.setTexture(textureKey);

    // Static - doesn't move
    this.setImmovable(true);

    // Create HP bar
    this.hpBar = new StatBar(scene, {
      ...HP_BAR_DEFAULTS,
      width: DUMMY_RADIUS * 2.5,
      offsetY: -DUMMY_RADIUS - 10,
      hideWhenFull: false,  // Always show HP for dummy
    });
    this.updateHpBar();

    // Make interactive for click detection
    this.setInteractive({ useHandCursor: true });
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.maxHp);
  }

  public getRadius(): number {
    return DUMMY_RADIUS;
  }

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

    // Visual feedback: flash and shake
    this.scene.tweens.add({
      targets: this,
      alpha: 0.6,
      duration: 50,
      yoyo: true,
    });

    // Small shake
    const startX = this.x;
    this.scene.tweens.add({
      targets: this,
      x: startX + 3,
      duration: 30,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.x = startX;
      }
    });

    if (this.hp <= 0) {
      this.defeat();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  /**
   * Set callback for when this dummy is destroyed
   */
  public onDeath(callback: (dummy: TargetDummy) => void): void {
    this.onDeathCallback = callback;
  }

  /**
   * Required for CombatableWithAttackers - dummy doesn't fight back
   */
  public addAttacker(_attacker: Combatable): void {
    // Dummy doesn't react to attackers
  }

  public removeAttacker(_attacker: Combatable): void {
    // Dummy doesn't track attackers
  }

  /**
   * Update - just update HP bar position
   */
  public update(): void {
    if (this.defeated) return;
    this.updateHpBar();
  }

  private defeat(): void {
    if (this.defeated) return;

    this.defeated = true;

    // Fire death callback
    if (this.onDeathCallback) {
      this.onDeathCallback(this);
    }

    // Death animation - pop and fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      ease: 'Power2',
      onComplete: () => this.destroy()
    });
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
