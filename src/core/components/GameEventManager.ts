import Phaser from 'phaser';
import { FloatingText } from './FloatingText';

/**
 * Event types that can be emitted through the scene's event system.
 * Use scene.events.emit(GameEvents.HEAL, payload) to trigger.
 */
export const GameEvents = {
  FLOATING_TEXT: 'game:floatingText',
  HEAL: 'game:heal',
  DAMAGE: 'game:damage',
  LEVEL_UP: 'game:levelUp',
} as const;

/**
 * Payload for floating text event
 */
export interface FloatingTextEvent {
  x: number;
  y: number;
  text: string;
  color?: string;
  fontSize?: number;
}

/**
 * Payload for heal event
 */
export interface HealEvent {
  x: number;
  y: number;
  amount: number;
}

/**
 * Payload for damage event
 */
export interface DamageEvent {
  x: number;
  y: number;
  amount: number;
}

/**
 * Payload for level up event
 */
export interface LevelUpEvent {
  x: number;
  y: number;
}

/**
 * Listens for game events on the scene and triggers visual effects.
 * Centralizes UI feedback so game logic doesn't need to know about rendering.
 *
 * Usage:
 *   // In scene create():
 *   this.eventManager = new GameEventManager(this);
 *
 *   // Anywhere with scene access:
 *   scene.events.emit(GameEvents.HEAL, { x: 100, y: 100, amount: 5 });
 */
export class GameEventManager {
  private scene: Phaser.Scene;
  private floatingText: FloatingText;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.floatingText = new FloatingText(scene);

    this.setupListeners();
  }

  private setupListeners(): void {
    const events = this.scene.events;

    // Generic floating text
    events.on(GameEvents.FLOATING_TEXT, (payload: FloatingTextEvent) => {
      this.floatingText.show({
        text: payload.text,
        x: payload.x,
        y: payload.y,
        color: payload.color,
        fontSize: payload.fontSize,
      });
    });

    // Heal event - green floating number
    events.on(GameEvents.HEAL, (payload: HealEvent) => {
      this.floatingText.showHeal(payload.x, payload.y, payload.amount);
    });

    // Damage event - red floating number
    events.on(GameEvents.DAMAGE, (payload: DamageEvent) => {
      this.floatingText.showDamage(payload.x, payload.y, payload.amount);
    });

    // Level up event
    events.on(GameEvents.LEVEL_UP, (payload: LevelUpEvent) => {
      this.floatingText.showLevelUp(payload.x, payload.y);
    });

    // Clean up listeners when scene shuts down
    this.scene.events.once('shutdown', () => {
      this.destroy();
    });
  }

  /**
   * Remove all event listeners
   */
  public destroy(): void {
    const events = this.scene.events;
    events.off(GameEvents.FLOATING_TEXT);
    events.off(GameEvents.HEAL);
    events.off(GameEvents.DAMAGE);
    events.off(GameEvents.LEVEL_UP);
  }
}
