import Phaser from 'phaser';
import { GemRegistryEntry } from '../data/GemRegistry';

const CARD_WIDTH = 120;
const CARD_HEIGHT = 140;
const PADDING = 8;
const CORNER_RADIUS = 6;

const COLORS = {
  background: 0x2a2a3a,
  backgroundHover: 0x3a3a4a,
  backgroundDisabled: 0x1a1a1a,
  border: 0x5a5a6a,
  borderHover: 0x8a8aff,
  text: '#ffffff',
  textDisabled: '#666666',
  costNormal: '#ffcc00',
  costCantAfford: '#ff4444',
  passiveBadge: 0x4488ff,
  activeBadge: 0xff8844,
};

export interface GemCardConfig {
  entry: GemRegistryEntry;
  canAfford: boolean;
  onClick: () => void;
}

/**
 * Individual gem option card shown in the upgrade menu.
 */
export class GemCard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private typeText: Phaser.GameObjects.Text;
  private costText: Phaser.GameObjects.Text;
  private entry: GemRegistryEntry;
  private canAfford: boolean;
  private onClick: () => void;
  private isHovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: GemCardConfig) {
    this.scene = scene;
    this.entry = config.entry;
    this.canAfford = config.canAfford;
    this.onClick = config.onClick;

    // Create container at the specified position (relative to parent if added to one)
    this.container = scene.add.container(x, y);

    // Background - create and add to container
    this.background = scene.add.graphics();
    this.container.add(this.background);

    console.log('GemCard created:', this.entry.name, 'container children:', this.container.list.length);

    // Name text
    this.nameText = scene.add.text(0, -CARD_HEIGHT / 2 + PADDING + 8, this.entry.name, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: CARD_WIDTH - PADDING * 2 },
    });
    this.nameText.setOrigin(0.5, 0);
    this.container.add(this.nameText);

    // Description text
    this.descText = scene.add.text(0, -CARD_HEIGHT / 2 + PADDING + 32, this.entry.description, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.text,
      align: 'center',
      wordWrap: { width: CARD_WIDTH - PADDING * 2 },
    });
    this.descText.setOrigin(0.5, 0);
    this.container.add(this.descText);

    // Type badge
    const typeLabel = this.entry.gemType === 'active' ? 'ACTIVE' : 'PASSIVE';
    this.typeText = scene.add.text(0, CARD_HEIGHT / 2 - PADDING - 40, typeLabel, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: this.entry.gemType === 'active'
        ? '#' + COLORS.activeBadge.toString(16)
        : '#' + COLORS.passiveBadge.toString(16),
      padding: { x: 4, y: 2 },
    });
    this.typeText.setOrigin(0.5, 0.5);
    this.container.add(this.typeText);

    // Cost text
    this.costText = scene.add.text(0, CARD_HEIGHT / 2 - PADDING - 12, `Cost: ${this.entry.essenceCost}`, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: this.canAfford ? COLORS.costNormal : COLORS.costCantAfford,
      fontStyle: 'bold',
    });
    this.costText.setOrigin(0.5, 0.5);
    this.container.add(this.costText);

    // Draw initial background
    this.drawBackground();

    // Setup interactivity
    this.setupInteractivity();
  }

  private drawBackground(): void {
    this.background.clear();

    const bgColor = !this.canAfford
      ? COLORS.backgroundDisabled
      : this.isHovered
        ? COLORS.backgroundHover
        : COLORS.background;

    const borderColor = this.isHovered && this.canAfford
      ? COLORS.borderHover
      : COLORS.border;

    console.log('Drawing card background:', this.entry.name, 'color:', bgColor.toString(16));

    // Background fill
    this.background.fillStyle(bgColor, 1);
    this.background.fillRoundedRect(
      -CARD_WIDTH / 2,
      -CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT,
      CORNER_RADIUS
    );

    // Border
    this.background.lineStyle(2, borderColor, 1);
    this.background.strokeRoundedRect(
      -CARD_WIDTH / 2,
      -CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT,
      CORNER_RADIUS
    );

    // Update text colors based on affordability
    const textColor = this.canAfford ? COLORS.text : COLORS.textDisabled;
    this.nameText.setColor(textColor);
    this.descText.setColor(textColor);
    this.costText.setColor(this.canAfford ? COLORS.costNormal : COLORS.costCantAfford);
  }

  private setupInteractivity(): void {
    // Create hit area
    const hitArea = new Phaser.Geom.Rectangle(
      -CARD_WIDTH / 2,
      -CARD_HEIGHT / 2,
      CARD_WIDTH,
      CARD_HEIGHT
    );

    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    this.container.on('pointerover', () => {
      this.isHovered = true;
      this.drawBackground();
      if (this.canAfford) {
        this.scene.input.setDefaultCursor('pointer');
      }
    });

    this.container.on('pointerout', () => {
      this.isHovered = false;
      this.drawBackground();
      this.scene.input.setDefaultCursor('default');
    });

    this.container.on('pointerdown', () => {
      if (this.canAfford) {
        // Click feedback
        this.scene.tweens.add({
          targets: this.container,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 50,
          yoyo: true,
        });
        this.onClick();
      } else {
        // Shake feedback for can't afford
        this.scene.tweens.add({
          targets: this.container,
          x: this.container.x + 5,
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
      }
    });
  }

  public setCanAfford(canAfford: boolean): void {
    this.canAfford = canAfford;
    this.drawBackground();
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.scene.input.setDefaultCursor('default');
    this.container.destroy();
  }
}
