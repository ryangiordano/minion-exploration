import Phaser from 'phaser';
import { LAYERS } from '../config';

export interface HoldToChargeConfig {
  /** Time in ms to fully charge (default 800) */
  chargeTime?: number;
  /** Rate at which charge decays when released, relative to fill rate (default 2.0) */
  decayRate?: number;
  /** Radius of the progress ring (default 35) */
  radius?: number;
  /** Ring color (default 0x88ccff) */
  color?: number;
  /** Ring line width (default 4) */
  lineWidth?: number;
}

export interface ChargeTarget {
  x: number;
  y: number;
}

/**
 * Hold-to-charge component - displays a circular progress ring that fills
 * while a key is held, and decays when released. Fires callback on complete.
 */
export class HoldToCharge {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private readonly chargeTime: number;
  private readonly decayRate: number;
  private readonly radius: number;
  private readonly color: number;
  private readonly lineWidth: number;

  private chargeProgress = 0;
  private isCharging = false;
  private key?: Phaser.Input.Keyboard.Key;
  private getTarget?: () => ChargeTarget;

  private onChargeStartCallback?: () => boolean | void;
  private onChargeCompleteCallback?: () => void;
  private onChargeCancelCallback?: () => void;

  constructor(scene: Phaser.Scene, config: HoldToChargeConfig = {}) {
    this.scene = scene;
    this.chargeTime = config.chargeTime ?? 800;
    this.decayRate = config.decayRate ?? 2.0;
    this.radius = config.radius ?? 35;
    this.color = config.color ?? 0x88ccff;
    this.lineWidth = config.lineWidth ?? 4;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYERS.UI_WORLD);
  }

  /** Bind to a keyboard key - hold to charge */
  public bindKey(keyCode: number): this {
    if (this.scene.input.keyboard) {
      this.key = this.scene.input.keyboard.addKey(keyCode);

      this.key.on('down', () => {
        this.startCharge();
      });

      this.key.on('up', () => {
        this.stopCharge();
      });
    }
    return this;
  }

  /** Set function to get the target position for the ring */
  public setTarget(getter: () => ChargeTarget): this {
    this.getTarget = getter;
    return this;
  }

  /** Register callback for when charging starts. Return false to cancel charge. */
  public onChargeStart(callback: () => boolean | void): this {
    this.onChargeStartCallback = callback;
    return this;
  }

  /** Register callback for when charge completes */
  public onChargeComplete(callback: () => void): this {
    this.onChargeCompleteCallback = callback;
    return this;
  }

  /** Register callback for when charge is cancelled (released before complete) */
  public onChargeCancel(callback: () => void): this {
    this.onChargeCancelCallback = callback;
    return this;
  }

  private startCharge(): void {
    if (this.isCharging) return;

    // Call start callback - if it returns false, cancel the charge
    const result = this.onChargeStartCallback?.();
    if (result === false) {
      return;
    }

    this.isCharging = true;
  }

  private stopCharge(): void {
    if (!this.isCharging) return;
    this.isCharging = false;

    // Only fire cancel if we didn't complete
    if (this.chargeProgress < 1) {
      this.onChargeCancelCallback?.();
    }
  }

  /** Update charge progress and draw - call in scene update() */
  public update(delta: number): void {
    if (this.isCharging) {
      // Fill up
      const fillRate = 1 / this.chargeTime;
      this.chargeProgress = Math.min(1, this.chargeProgress + fillRate * delta);

      // Check for completion
      if (this.chargeProgress >= 1) {
        this.triggerComplete();
      }
    } else if (this.chargeProgress > 0) {
      // Decay when not charging
      const decayAmount = (1 / this.chargeTime) * this.decayRate;
      this.chargeProgress = Math.max(0, this.chargeProgress - decayAmount * delta);
    }

    this.draw();
  }

  private triggerComplete(): void {
    this.isCharging = false;
    this.chargeProgress = 0;
    this.onChargeCompleteCallback?.();
  }

  private draw(): void {
    this.graphics.clear();

    if (this.chargeProgress <= 0) return;

    const target = this.getTarget?.();
    if (!target) return;

    // Calculate alpha based on progress (fade in quickly, then stay visible)
    const alpha = Math.min(1, this.chargeProgress * 3) * 0.8;

    // Draw background ring (dim)
    this.graphics.lineStyle(this.lineWidth, this.color, alpha * 0.3);
    this.graphics.strokeCircle(target.x, target.y, this.radius);

    // Draw progress arc
    const startAngle = -Math.PI / 2; // Start from top
    const endAngle = startAngle + this.chargeProgress * Math.PI * 2;

    this.graphics.lineStyle(this.lineWidth, this.color, alpha);
    this.graphics.beginPath();
    this.graphics.arc(target.x, target.y, this.radius, startAngle, endAngle);
    this.graphics.strokePath();

    // Draw glow effect at the leading edge
    if (this.chargeProgress > 0.05) {
      const glowX = target.x + Math.cos(endAngle) * this.radius;
      const glowY = target.y + Math.sin(endAngle) * this.radius;
      this.graphics.fillStyle(this.color, alpha * 0.6);
      this.graphics.fillCircle(glowX, glowY, this.lineWidth);
    }
  }

  /** Get current charge progress (0-1) */
  public getChargeProgress(): number {
    return this.chargeProgress;
  }

  /** Check if currently charging */
  public isActivelyCharging(): boolean {
    return this.isCharging;
  }

  public destroy(): void {
    this.key?.destroy();
    this.graphics.destroy();
  }
}
