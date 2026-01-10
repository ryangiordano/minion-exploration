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
  private readonly acceleration = 800;
  private readonly drag = 600;

  // Stamina system
  public stamina = 100;
  public readonly maxStamina = 100;
  private readonly staminaDrainRate = 20; // per second when sprinting
  private readonly staminaRegenRate = 15; // per second when idle/walking

  // Cache shift key to avoid creating new one each frame
  private shiftKey?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (simple circle for MVP)
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x4a90e2, 1);
    graphics.fillCircle(16, 16, 16); // Draw at center of texture
    graphics.generateTexture('player', 32, 32);
    graphics.destroy();

    this.setTexture('player');

    // Setup physics - use drag for smooth deceleration
    this.setCollideWorldBounds(true);
    this.setDrag(this.drag);
    this.setMaxVelocity(this.sprintSpeed);

    // Setup input
    this.cursors = scene.input.keyboard?.createCursorKeys();
    if (scene.input.keyboard) {
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      };
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }
  }

  update(delta: number): void {
    if (!this.cursors || !this.wasd || !this.shiftKey) return;

    const deltaSeconds = delta / 1000;
    let accelerationX = 0;
    let accelerationY = 0;

    // Check if shift is held for sprinting
    const isSprinting = this.shiftKey.isDown && this.stamina > 0;
    const maxSpeed = isSprinting ? this.sprintSpeed : this.moveSpeed;

    // Check movement input (WASD or Arrow keys)
    const left = this.cursors.left?.isDown || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const up = this.cursors.up?.isDown || this.wasd.up.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down.isDown;

    // Apply acceleration in the direction of input
    if (left) accelerationX = -this.acceleration;
    if (right) accelerationX = this.acceleration;
    if (up) accelerationY = -this.acceleration;
    if (down) accelerationY = this.acceleration;

    // Apply acceleration (Phaser handles drag automatically)
    this.setAcceleration(accelerationX, accelerationY);

    // Update max velocity based on sprint state
    this.setMaxVelocity(maxSpeed);

    // Update stamina
    const isMoving = Math.abs(this.body!.velocity.x) > 10 || Math.abs(this.body!.velocity.y) > 10;

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
