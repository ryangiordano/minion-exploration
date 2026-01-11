import Phaser from 'phaser';
import { Combatable } from '../../../core/types/interfaces';
import { HpBar } from '../../../core/components';

const ENEMY_RADIUS = 16;

export interface EnemyConfig {
  maxHp?: number;
}

export class Enemy extends Phaser.GameObjects.Container implements Combatable {
  private hp: number;
  private maxHp: number;
  private defeated = false;
  private hpBar: HpBar;
  private bodyCircle?: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig = {}) {
    super(scene, x, y);

    this.maxHp = config.maxHp ?? 3;
    this.hp = this.maxHp;

    // Add to scene
    scene.add.existing(this);

    // Create visual (red circle)
    this.bodyCircle = scene.add.circle(0, 0, ENEMY_RADIUS, 0xff4444);
    this.bodyCircle.setStrokeStyle(2, 0xaa0000);
    this.add(this.bodyCircle);

    // Create HP bar component (auto-hides when full)
    this.hpBar = new HpBar(scene, {
      width: ENEMY_RADIUS * 2,
      offsetY: -ENEMY_RADIUS - 8
    });
    this.updateHpBar();

    // Make interactive for click detection
    this.setSize(ENEMY_RADIUS * 2, ENEMY_RADIUS * 2);
    this.setInteractive({ useHandCursor: true });
  }

  private updateHpBar(): void {
    this.hpBar.update(this.x, this.y, this.hp, this.maxHp);
  }

  public getRadius(): number {
    return ENEMY_RADIUS;
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

    // Visual feedback: flash white
    if (this.bodyCircle) {
      this.scene.tweens.add({
        targets: this.bodyCircle,
        alpha: 0.5,
        duration: 50,
        yoyo: true,
      });
    }

    if (this.hp <= 0) {
      this.defeat();
    }
  }

  public isDefeated(): boolean {
    return this.defeated;
  }

  public defeat(): void {
    if (this.defeated) return;

    this.defeated = true;

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
