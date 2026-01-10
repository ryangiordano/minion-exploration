import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Movement
  private readonly moveSpeed = 160;
  private readonly sprintSpeed = 240;

  // Stamina system
  public stamina = 100;
  public readonly maxStamina = 100;
  private readonly staminaDrainRate = 20; // per second when sprinting
  private readonly staminaRegenRate = 15; // per second when idle/walking

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (simple circle for MVP)
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x4a90e2, 1);
    graphics.fillCircle(0, 0, 16);
    graphics.generateTexture('player', 32, 32);
    graphics.destroy();

    this.setTexture('player');

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup input
    this.cursors = scene.input.keyboard?.createCursorKeys();
    if (scene.input.keyboard) {
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      };
    }
  }

  update(delta: number): void {
    if (!this.cursors || !this.wasd) return;

    const deltaSeconds = delta / 1000;
    let velocityX = 0;
    let velocityY = 0;

    // Check if shift is held for sprinting
    const isShiftHeld = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT).isDown;
    const isSprinting = isShiftHeld && this.stamina > 0;
    const currentSpeed = isSprinting ? this.sprintSpeed : this.moveSpeed;

    // Check movement input (WASD or Arrow keys)
    const left = this.cursors.left?.isDown || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const up = this.cursors.up?.isDown || this.wasd.up.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down.isDown;

    if (left) velocityX = -currentSpeed;
    if (right) velocityX = currentSpeed;
    if (up) velocityY = -currentSpeed;
    if (down) velocityY = currentSpeed;

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707; // 1/sqrt(2)
      velocityY *= 0.707;
    }

    // Apply velocity
    this.setVelocity(velocityX, velocityY);

    // Update stamina
    const isMoving = velocityX !== 0 || velocityY !== 0;

    if (isSprinting && isMoving) {
      // Drain stamina when sprinting
      this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * deltaSeconds);
    } else {
      // Regenerate stamina when not sprinting
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * deltaSeconds);
    }
  }

  public getStaminaPercentage(): number {
    return this.stamina / this.maxStamina;
  }
}
