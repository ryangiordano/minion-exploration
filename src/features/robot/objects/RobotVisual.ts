import Phaser from 'phaser';

/** Configuration for the robot visual */
export interface RobotVisualConfig {
  radius?: number;
  bodyColor?: number;
  faceColor?: number;
  /** Sprite key for face texture. If provided, uses sprite instead of drawn face. */
  faceSprite?: string;
  /** Initial frame for sprite face (for spritesheets) */
  faceFrame?: number;
}

/**
 * Visual component for the robot - a rolling sphere with a face.
 * The face scrolls opposite to movement direction, creating a rolling illusion.
 */
export class RobotVisual extends Phaser.GameObjects.Container {
  private readonly radius: number;

  // The wrap distance simulates going around the sphere (half circumference = pi * radius)
  // This creates the illusion that the face travels "around the back" before reappearing
  private readonly wrapDistance: number;

  // Visual elements
  private sphereBody: Phaser.GameObjects.Graphics;
  private faceContainer: Phaser.GameObjects.Container;
  private faceMask: Phaser.GameObjects.Graphics;
  private tintOverlay: Phaser.GameObjects.Graphics;

  // Face sprites (if using sprite-based face)
  private faceSprites: Phaser.GameObjects.Sprite[] = [];

  // Face offset for rolling effect (in pixels from center)
  private faceOffsetX = 0;
  private faceOffsetY = 0;

  // Rolling speed multiplier (how fast face moves relative to body movement)
  private readonly rollMultiplier = 1.0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: RobotVisualConfig = {}) {
    super(scene, x, y);

    this.radius = config.radius ?? 20;
    // Half the circumference of a sphere (pi * radius) - face goes "around the back"
    this.wrapDistance = Math.PI * this.radius;

    const bodyColor = config.bodyColor ?? 0xa8a8a8;
    const faceColor = config.faceColor ?? 0x1a1a2e;

    // Create the sphere body
    this.sphereBody = this.createSphereBody(bodyColor);
    this.add(this.sphereBody);

    // Create the face container (will be masked)
    // Use sprite if provided, otherwise use drawn graphics
    if (config.faceSprite) {
      this.faceContainer = this.createSpriteFace(config.faceSprite, config.faceFrame);
    } else {
      this.faceContainer = this.createFace(faceColor);
    }
    this.add(this.faceContainer);

    // Create and apply circular mask
    this.faceMask = this.createMask();
    const mask = this.faceMask.createGeometryMask();
    this.faceContainer.setMask(mask);

    // Create tint overlay (hidden by default)
    this.tintOverlay = this.createTintOverlay();
    this.add(this.tintOverlay);

    scene.add.existing(this);
  }

  /** Creates the main sphere body */
  private createSphereBody(color: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();

    // Main body fill
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, this.radius);

    // Subtle highlight for 3D effect
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillCircle(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.3);

    // Edge outline
    graphics.lineStyle(2, 0x707070, 1);
    graphics.strokeCircle(0, 0, this.radius);

    return graphics;
  }

  /** Creates the face elements in a container */
  private createFace(color: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);

    // Create a 3x3 grid of faces for seamless wrapping
    // Spacing is based on wrapDistance to simulate going around the sphere
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        const offsetX = col * this.wrapDistance;
        const offsetY = row * this.wrapDistance;
        const faceElements = this.createFaceElements(color, offsetX, offsetY);
        container.add(faceElements);
      }
    }

    return container;
  }

  /** Creates a sprite-based face in a container (for custom face textures) */
  private createSpriteFace(spriteKey: string, frame?: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);

    // Create a 3x3 grid of face sprites for seamless wrapping
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        const offsetX = col * this.wrapDistance;
        const offsetY = row * this.wrapDistance;
        const sprite = this.scene.add.sprite(offsetX, offsetY, spriteKey, frame);

        // Scale sprite to fit within the sphere diameter
        // Use slightly smaller than diameter to give some padding
        const targetSize = this.radius * 1.8;
        const scale = targetSize / sprite.width;
        sprite.setScale(scale);

        this.faceSprites.push(sprite);
        container.add(sprite);
      }
    }

    return container;
  }

  /** Creates the actual face graphics (eyes and mouth) at an offset */
  private createFaceElements(color: number, offsetX: number, offsetY: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    const eyeRadius = this.radius * 0.18;
    const eyeSpacing = this.radius * 0.4;
    const eyeY = -this.radius * 0.15 + offsetY;

    // Left eye
    graphics.fillStyle(color, 1);
    graphics.fillCircle(-eyeSpacing + offsetX, eyeY, eyeRadius);

    // Right eye
    graphics.fillCircle(eyeSpacing + offsetX, eyeY, eyeRadius);

    // Eye highlights (pupils/gleam)
    graphics.fillStyle(0xffffff, 0.8);
    const pupilOffset = eyeRadius * 0.3;
    graphics.fillCircle(-eyeSpacing - pupilOffset + offsetX, eyeY - pupilOffset, eyeRadius * 0.35);
    graphics.fillCircle(eyeSpacing - pupilOffset + offsetX, eyeY - pupilOffset, eyeRadius * 0.35);

    // Slight smile
    graphics.lineStyle(2, color, 1);
    const mouthY = this.radius * 0.35 + offsetY;
    const mouthWidth = this.radius * 0.3;
    graphics.beginPath();
    graphics.arc(offsetX, mouthY - this.radius * 0.2, mouthWidth, 0.3, Math.PI - 0.3, false);
    graphics.strokePath();

    return graphics;
  }

  /** Creates the circular mask for the face */
  private createMask(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(0, 0, this.radius - 2); // Slightly smaller to avoid edge artifacts

    // The mask needs to follow the container
    this.on('destroy', () => graphics.destroy());

    return graphics;
  }

  /** Creates a tint overlay for damage flash effects */
  private createTintOverlay(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xff0000, 0.5);
    graphics.fillCircle(0, 0, this.radius);
    graphics.setVisible(false);
    return graphics;
  }

  /** Update the rolling effect based on velocity */
  public updateRoll(velocityX: number, velocityY: number, delta: number): void {
    // Face moves opposite to velocity (rolling effect)
    // Scale by delta for frame-rate independence
    const deltaSeconds = delta / 1000;

    this.faceOffsetX += velocityX * this.rollMultiplier * deltaSeconds;
    this.faceOffsetY += velocityY * this.rollMultiplier * deltaSeconds;

    // Wrap offsets to stay within one diameter
    this.faceOffsetX = this.wrapOffset(this.faceOffsetX);
    this.faceOffsetY = this.wrapOffset(this.faceOffsetY);

    // Apply offset to face container
    this.faceContainer.setPosition(this.faceOffsetX, this.faceOffsetY);

    // Update mask position to follow the main container
    this.faceMask.setPosition(this.x, this.y);
  }

  /** Wraps an offset value to stay within [-wrapDistance/2, wrapDistance/2] */
  private wrapOffset(offset: number): number {
    const halfWrap = this.wrapDistance / 2;
    while (offset > halfWrap) offset -= this.wrapDistance;
    while (offset < -halfWrap) offset += this.wrapDistance;
    return offset;
  }

  /** Sync position with physics body */
  public syncPosition(x: number, y: number): void {
    this.setPosition(x, y);
    this.faceMask.setPosition(x, y);
  }

  /** Show the tint overlay for damage flash */
  public setTint(_color: number): void {
    this.tintOverlay.setVisible(true);
  }

  /** Hide the tint overlay */
  public clearTint(): void {
    this.tintOverlay.setVisible(false);
  }

  /** Set the frame on all face sprites (for expression changes) */
  public setFaceFrame(frame: number | string): void {
    for (const sprite of this.faceSprites) {
      sprite.setFrame(frame);
    }
  }

  /** Play an animation on all face sprites */
  public playFaceAnimation(key: string, ignoreIfPlaying = true): void {
    for (const sprite of this.faceSprites) {
      sprite.play(key, ignoreIfPlaying);
    }
  }

  /** Stop face animation on all sprites */
  public stopFaceAnimation(): void {
    for (const sprite of this.faceSprites) {
      sprite.stop();
    }
  }

  /** Check if using sprite-based face */
  public hasSpriteFace(): boolean {
    return this.faceSprites.length > 0;
  }

  /** Animate the face to center (for portal transitions, etc.) */
  public centerFace(duration = 400): void {
    this.scene.tweens.add({
      targets: this,
      faceOffsetX: 0,
      faceOffsetY: 0,
      duration,
      ease: 'Sine.inOut',
      onUpdate: () => {
        this.faceContainer.setPosition(this.faceOffsetX, this.faceOffsetY);
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.faceMask.destroy();
    super.destroy(fromScene);
  }
}
