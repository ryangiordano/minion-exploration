import Phaser from 'phaser';
import { LAYERS } from '../../../core/config';
import { AbilityGem } from '../../../core/abilities/types';
import { Minion } from '../../minions';
import { CurrencyDisplay } from '../../level/ui/CurrencyDisplay';
import { GemRegistry, GemRegistryEntry } from '../data/GemRegistry';
import { GemCard } from './GemCard';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 200;
const PANEL_PADDING = 12;
const CARD_SPACING = 16;
const CORNER_RADIUS = 8;
const PANEL_OFFSET_Y = -120;

const COLORS = {
  background: 0x1a1a2e,
  border: 0x4a4a6a,
  title: '#ffffff',
  hint: '#888888',
};

export interface UpgradeMenuConfig {
  scene: Phaser.Scene;
  currencyDisplay: CurrencyDisplay;
  onGemSelected: (gem: AbilityGem, entry: GemRegistryEntry) => void;
  onCancel: () => void;
}

/**
 * Floating panel that displays two gem choices for upgrading a minion.
 */
export class UpgradeMenu {
  private scene: Phaser.Scene;
  private currencyDisplay: CurrencyDisplay;
  private onGemSelected: (gem: AbilityGem, entry: GemRegistryEntry) => void;
  private onCancel: () => void;

  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private gemCards: GemCard[] = [];
  private currentOffers: GemRegistryEntry[] = [];

  private targetMinion: Minion | null = null;
  private escKey?: Phaser.Input.Keyboard.Key;
  private clickOutsideHandler?: (pointer: Phaser.Input.Pointer) => void;

  private isMenuOpen = false;

  constructor(config: UpgradeMenuConfig) {
    this.scene = config.scene;
    this.currencyDisplay = config.currencyDisplay;
    this.onGemSelected = config.onGemSelected;
    this.onCancel = config.onCancel;

    // Create container (hidden initially)
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(LAYERS.UI_OVERLAY);
    this.container.setVisible(false);

    // Background panel
    this.background = this.scene.add.graphics();
    this.container.add(this.background);

    // Title
    this.titleText = this.scene.add.text(0, -PANEL_HEIGHT / 2 + PANEL_PADDING + 8, 'UPGRADE MINION', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.title,
      fontStyle: 'bold',
    });
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);

    // Cancel hint
    this.hintText = this.scene.add.text(0, PANEL_HEIGHT / 2 - PANEL_PADDING - 8, 'ESC or click outside to cancel', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.hint,
    });
    this.hintText.setOrigin(0.5, 1);
    this.container.add(this.hintText);

    // Draw background
    this.drawBackground();

    // Setup ESC key
    this.escKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey?.on('down', () => {
      if (this.isMenuOpen) {
        this.close();
        this.onCancel();
      }
    });
  }

  private drawBackground(): void {
    this.background.clear();

    // Background fill
    this.background.fillStyle(COLORS.background, 0.95);
    this.background.fillRoundedRect(
      -PANEL_WIDTH / 2,
      -PANEL_HEIGHT / 2,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      CORNER_RADIUS
    );

    // Border
    this.background.lineStyle(2, COLORS.border, 1);
    this.background.strokeRoundedRect(
      -PANEL_WIDTH / 2,
      -PANEL_HEIGHT / 2,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      CORNER_RADIUS
    );
  }

  public open(minion: Minion): void {
    if (this.isMenuOpen) return;

    this.targetMinion = minion;
    this.isMenuOpen = true;

    // Get current equipped gem to exclude from offers (optional: keep variety)
    const equippedGems = minion.getAbilitySystem().getEquippedGems();
    const excludeIds = equippedGems.map(g => g.id);

    // Generate random gem offers
    this.currentOffers = GemRegistry.getRandomGems(2, excludeIds);
    console.log('Upgrade menu opened, offers:', this.currentOffers.length, this.currentOffers.map(o => o.name));

    // If not enough gems available, just take what we can
    if (this.currentOffers.length === 0) {
      this.currentOffers = GemRegistry.getRandomGems(2);
      console.log('Fallback offers:', this.currentOffers.length);
    }

    // Clear old cards
    this.clearGemCards();

    // Create gem cards
    const cardY = 15;
    const totalCardWidth = this.currentOffers.length * 120 + (this.currentOffers.length - 1) * CARD_SPACING;
    const startX = -totalCardWidth / 2 + 60;

    console.log('About to create cards. Offers:', this.currentOffers.length, 'startX:', startX, 'cardY:', cardY);

    for (let index = 0; index < this.currentOffers.length; index++) {
      const entry = this.currentOffers[index];
      const cardX = startX + index * (120 + CARD_SPACING);
      const canAfford = this.currencyDisplay.canAfford(entry.essenceCost);

      const card = new GemCard(this.scene, cardX, cardY, {
        entry,
        canAfford,
        onClick: () => this.selectGem(entry),
      });

      // Add card container to menu container
      const cardContainer = card.getContainer();
      this.container.add(cardContainer);
      this.gemCards.push(card);
      console.log('Added card:', entry.name, 'at', cardX, cardY, 'container children after add:', this.container.list.length);
    }

    // Debug: log all children of the menu container
    console.log('Menu container total children:', this.container.list.length, this.container.list.map((c: Phaser.GameObjects.GameObject) => c.type));

    // Position menu near minion
    this.updatePosition();
    console.log('Menu position:', this.container.x, this.container.y, 'visible:', this.container.visible, 'depth:', this.container.depth);

    // Show with fade in
    this.container.setAlpha(0);
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
    });

    // Setup click outside handler (delayed to avoid immediate trigger)
    this.scene.time.delayedCall(100, () => {
      this.clickOutsideHandler = (pointer: Phaser.Input.Pointer) => {
        if (!this.isMenuOpen) return;

        // Check if click is outside menu bounds
        const localX = pointer.worldX - this.container.x;
        const localY = pointer.worldY - this.container.y;

        if (
          localX < -PANEL_WIDTH / 2 ||
          localX > PANEL_WIDTH / 2 ||
          localY < -PANEL_HEIGHT / 2 ||
          localY > PANEL_HEIGHT / 2
        ) {
          this.close();
          this.onCancel();
        }
      };

      this.scene.input.on('pointerdown', this.clickOutsideHandler);
    });
  }

  public close(): void {
    if (!this.isMenuOpen) return;

    this.isMenuOpen = false;
    this.targetMinion = null;

    // Remove click outside handler
    if (this.clickOutsideHandler) {
      this.scene.input.off('pointerdown', this.clickOutsideHandler);
      this.clickOutsideHandler = undefined;
    }

    // Fade out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.clearGemCards();
      },
    });

    // Reset cursor
    this.scene.input.setDefaultCursor('default');
  }

  public isOpen(): boolean {
    return this.isMenuOpen;
  }

  public getTargetMinion(): Minion | null {
    return this.targetMinion;
  }

  public update(): void {
    if (!this.isMenuOpen || !this.targetMinion) return;

    // Update position to follow minion
    this.updatePosition();

    // Update affordability of cards
    this.currentOffers.forEach((entry, index) => {
      if (this.gemCards[index]) {
        this.gemCards[index].setCanAfford(this.currencyDisplay.canAfford(entry.essenceCost));
      }
    });
  }

  private updatePosition(): void {
    if (!this.targetMinion) return;

    const camera = this.scene.cameras.main;

    // Target position above minion
    let targetX = this.targetMinion.x;
    let targetY = this.targetMinion.y + PANEL_OFFSET_Y;

    // Clamp to camera bounds
    const halfWidth = PANEL_WIDTH / 2;
    const halfHeight = PANEL_HEIGHT / 2;
    const padding = 10;

    const minX = camera.scrollX + padding + halfWidth;
    const maxX = camera.scrollX + camera.width - padding - halfWidth;
    const minY = camera.scrollY + padding + halfHeight;
    const maxY = camera.scrollY + camera.height - padding - halfHeight;

    targetX = Phaser.Math.Clamp(targetX, minX, maxX);
    targetY = Phaser.Math.Clamp(targetY, minY, maxY);

    this.container.setPosition(targetX, targetY);
  }

  private selectGem(entry: GemRegistryEntry): void {
    if (!this.currencyDisplay.canAfford(entry.essenceCost)) {
      return;
    }

    const gem = entry.createGem();
    this.onGemSelected(gem, entry);
  }

  private clearGemCards(): void {
    this.gemCards.forEach(card => card.destroy());
    this.gemCards = [];
  }

  public destroy(): void {
    this.close();
    this.escKey?.destroy();
    this.container.destroy();
  }
}
