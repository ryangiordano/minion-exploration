import { AbilityGem, GemOwner } from '../types';
import { ShieldComponent } from '../../components/ShieldComponent';

export interface ShieldGemConfig {
  /** Shield HP (default: 1) */
  shieldHp?: number;
  /** Shield color (default: blue) */
  color?: number;
}

const DEFAULT_SHIELD_HP = 1;
const DEFAULT_COLOR = 0x4488ff;

/**
 * Defensive gem that grants a one-time shield to the equipped entity.
 * Shield absorbs damage fully until depleted, then breaks.
 * Does not regenerate - provides protection for one floor only.
 *
 * When equipped to robot's personal slots: Robot gets a shield
 * When equipped to robot's nanobot slots: All nanobots get shields
 */
export class ShieldGem implements AbilityGem {
  readonly id = 'shield';
  readonly name = 'Shield Gem';
  readonly description = 'One-time shield that absorbs 1 hit';

  private readonly shieldHp: number;
  private readonly color: number;

  /** Track shields per owner (nanobots/robot each get their own) */
  private shields: WeakMap<GemOwner, ShieldComponent> = new WeakMap();
  /** Track all active shields for cleanup on unequip */
  private allShields: Set<ShieldComponent> = new Set();

  constructor(config: ShieldGemConfig = {}) {
    this.shieldHp = config.shieldHp ?? DEFAULT_SHIELD_HP;
    this.color = config.color ?? DEFAULT_COLOR;
  }

  /**
   * Create a shield for an entity. Called by the entity (nanobot/robot)
   * when it initializes with this gem equipped.
   */
  public createShieldFor(owner: GemOwner): ShieldComponent {
    // If owner already has a shield, destroy it first
    const existing = this.shields.get(owner);
    if (existing) {
      existing.destroy();
      this.allShields.delete(existing);
    }

    const shield = new ShieldComponent(owner.getScene(), owner, {
      maxHp: this.shieldHp,
      color: this.color,
    });

    this.shields.set(owner, shield);
    this.allShields.add(shield);
    return shield;
  }

  /**
   * Get the shield for an owner, if it exists and is active
   */
  public getShieldFor(owner: GemOwner): ShieldComponent | null {
    const shield = this.shields.get(owner);
    return shield?.isActive() ? shield : null;
  }

  /**
   * Try to absorb damage with the shield. Returns true if damage was absorbed.
   */
  public tryAbsorbDamage(owner: GemOwner, amount: number): boolean {
    const shield = this.shields.get(owner);
    if (!shield || !shield.isActive()) {
      return false;
    }
    return shield.absorbDamage(amount);
  }

  /**
   * Remove shield for an owner (e.g., when they die or gem is unequipped)
   */
  public removeShieldFor(owner: GemOwner): void {
    const shield = this.shields.get(owner);
    if (shield) {
      shield.destroy();
      this.shields.delete(owner);
      this.allShields.delete(shield);
    }
  }

  /**
   * Remove all shields (called when gem is unequipped)
   */
  public removeAllShields(): void {
    for (const shield of this.allShields) {
      shield.destroy();
    }
    this.allShields.clear();
    // WeakMap entries will be garbage collected
  }

  /**
   * Update shield position. Should be called each frame by the owner.
   */
  public updateShieldFor(owner: GemOwner): void {
    const shield = this.shields.get(owner);
    if (shield?.isActive()) {
      shield.update();
    }
  }

  /**
   * Set visibility for a specific owner's shield.
   */
  public setShieldVisible(owner: GemOwner, visible: boolean): void {
    const shield = this.shields.get(owner);
    shield?.setVisible(visible);
  }

  /**
   * Set visibility for all shields.
   */
  public setAllShieldsVisible(visible: boolean): void {
    for (const shield of this.allShields) {
      shield.setVisible(visible);
    }
  }

  // Standard gem interface - called when equipped to robot
  onEquip(_owner: GemOwner): void {
    // Shields are created explicitly by entities (robot/nanobots) since:
    // - Robot personal slots: Robot calls createShieldFor(robot)
    // - Nanobot slots: Each nanobot calls createShieldFor(nanobot)
    // This is because the AbilitySystem owner is always robot, but for
    // nanobot slots the actual shield recipients are the nanobots.
  }

  onUnequip(_owner: GemOwner): void {
    // Remove all shields when gem is unequipped
    // This handles both robot personal slots and nanobot slots
    this.removeAllShields();
  }
}
