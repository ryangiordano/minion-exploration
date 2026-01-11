import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../../../core/types/interfaces';
import { HpBar, AttackBehavior } from '../../../core/components';

const ENEMY_RADIUS = 16;

// Default enemy attack stats (slower than minions)
const DEFAULT_ATTACK: AttackConfig = {
  damage: 1,
  cooldownMs: 1000,
  effectType: 'melee'
};

export interface EnemyConfig {
  maxHp?: number;
  damage?: number;
  attackCooldown?: number;
}

export class Enemy extends Phaser.GameObjects.Container implements Combatable {
  private hp: number;
  private maxHp: number;
  private defeated = false;
  private hpBar: HpBar;
  private bodyCircle?: Phaser.GameObjects.Arc;
  private attackBehavior: AttackBehavior;
  private attackers: Set<Combatable> = new Set();

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

    // Setup attack behavior for fighting back
    const attackConfig: AttackConfig = {
      damage: config.damage ?? DEFAULT_ATTACK.damage,
      cooldownMs: config.attackCooldown ?? DEFAULT_ATTACK.cooldownMs,
      effectType: 'melee'
    };
    this.attackBehavior = new AttackBehavior({ defaultAttack: attackConfig });

    // Visual feedback when attacking
    this.attackBehavior.onAttack(() => {
      this.showAttackEffect();
    });

    // When current target dies, find next attacker
    this.attackBehavior.onTargetDefeated(() => {
      this.attackers.delete(this.attackBehavior.getTarget()!);
      this.retarget();
    });
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

  /**
   * Register an attacker - enemy will fight back
   */
  public addAttacker(attacker: Combatable): void {
    this.attackers.add(attacker);
    // If not currently fighting, start attacking this one
    if (!this.attackBehavior.isEngaged()) {
      this.attackBehavior.engage(attacker);
    }
  }

  /**
   * Remove an attacker (e.g., when they leave combat)
   */
  public removeAttacker(attacker: Combatable): void {
    this.attackers.delete(attacker);
    // If we were attacking them, find new target
    if (this.attackBehavior.getTarget() === attacker) {
      this.retarget();
    }
  }

  /**
   * Update - call each frame to process attacks
   */
  public update(delta: number): void {
    if (this.defeated) return;

    this.attackBehavior.update(delta);
  }

  private retarget(): void {
    this.attackBehavior.disengage();

    // Find next attacker that isn't defeated
    for (const attacker of this.attackers) {
      if (!attacker.isDefeated()) {
        this.attackBehavior.engage(attacker);
        return;
      }
    }
    // No valid targets, clear attackers set
    this.attackers.clear();
  }

  private showAttackEffect(): void {
    // Quick pulse effect
    if (this.bodyCircle) {
      this.scene.tweens.add({
        targets: this.bodyCircle,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 50,
        yoyo: true,
      });
    }
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
