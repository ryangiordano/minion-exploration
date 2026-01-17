import Phaser from 'phaser';
import { LAYERS } from '../../../core/config';
import { AbilityGem } from '../../../core/abilities/types';
import { Minion } from '../../minions';
import { CurrencyDisplay } from '../../level/ui/CurrencyDisplay';
import { GemRegistry, GemRegistryEntry } from '../data/GemRegistry';
import { InventoryState, InventoryGem, getGemVisual } from '../../inventory';

// Larger panel for tabular layout
const PANEL_WIDTH = 340;
const PANEL_PADDING = 16;
const ROW_HEIGHT = 48;
const CORNER_RADIUS = 8;
const PANEL_OFFSET_Y = -180;

const COLORS = {
  background: 0x1a1a2e,
  border: 0x4a4a6a,
  sectionBorder: 0x3a3a5a,
  title: '#ffffff',
  subtitle: '#aaaaaa',
  hint: '#666666',
  text: '#cccccc',
  cost: '#ffd700',
  hp: '#ff6666',
  mp: '#6666ff',
  xp: '#ffd700',
  button: '#44ff44',
  buttonDisabled: '#444444',
  remove: '#ff6666',
};

export interface UpgradeMenuConfig {
  scene: Phaser.Scene;
  currencyDisplay: CurrencyDisplay;
  onGemSelected: (gem: AbilityGem, entry: GemRegistryEntry) => void;
  onCancel: () => void;
  inventory?: InventoryState;
  onInventoryGemEquipped?: (inventoryGem: InventoryGem) => void;
  onGemRemoved?: (minion: Minion, slot: number, gemId: string) => void;
  onRepair?: (minion: Minion) => boolean;
  repairCost?: number;
}

/**
 * Minion management panel with tabular gem layout.
 * Shows minion stats, equipped gems, inventory gems, and repair option.
 */
export class UpgradeMenu {
  private scene: Phaser.Scene;
  private currencyDisplay: CurrencyDisplay;
  private onGemSelected: (gem: AbilityGem, entry: GemRegistryEntry) => void;
  private onCancel: () => void;
  private inventory?: InventoryState;
  private onInventoryGemEquipped?: (inventoryGem: InventoryGem) => void;
  private onGemRemoved?: (minion: Minion, slot: number, gemId: string) => void;
  private onRepair?: (minion: Minion) => boolean;
  private repairCost: number;

  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private dynamicElements: Phaser.GameObjects.GameObject[] = [];

  private targetMinion: Minion | null = null;
  private escKey?: Phaser.Input.Keyboard.Key;
  private clickOutsideHandler?: (pointer: Phaser.Input.Pointer) => void;
  private isMenuOpen = false;

  constructor(config: UpgradeMenuConfig) {
    this.scene = config.scene;
    this.currencyDisplay = config.currencyDisplay;
    this.onGemSelected = config.onGemSelected;
    this.onCancel = config.onCancel;
    this.inventory = config.inventory;
    this.onInventoryGemEquipped = config.onInventoryGemEquipped;
    this.onGemRemoved = config.onGemRemoved;
    this.onRepair = config.onRepair;
    this.repairCost = config.repairCost ?? 10;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(LAYERS.UI_OVERLAY);
    this.container.setVisible(false);

    this.background = this.scene.add.graphics();
    this.container.add(this.background);

    this.escKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey?.on('down', () => {
      if (this.isMenuOpen) {
        this.close();
        this.onCancel();
      }
    });
  }

  private drawBackground(height: number): void {
    this.background.clear();

    this.background.fillStyle(COLORS.background, 0.95);
    this.background.fillRoundedRect(
      -PANEL_WIDTH / 2,
      -height / 2,
      PANEL_WIDTH,
      height,
      CORNER_RADIUS
    );

    this.background.lineStyle(2, COLORS.border, 1);
    this.background.strokeRoundedRect(
      -PANEL_WIDTH / 2,
      -height / 2,
      PANEL_WIDTH,
      height,
      CORNER_RADIUS
    );
  }

  public open(minion: Minion): void {
    if (this.isMenuOpen) return;

    this.targetMinion = minion;
    this.isMenuOpen = true;
    this.clearDynamicElements();

    // Build the UI
    let currentY = 0;
    currentY = this.renderHeader(minion, currentY);
    currentY = this.renderEquippedSection(minion, currentY);
    currentY = this.renderInventorySection(minion, currentY);
    currentY = this.renderFooter(minion, currentY);

    // Calculate actual height needed and draw background
    const totalHeight = currentY + PANEL_PADDING;
    this.drawBackground(totalHeight);

    // Reposition all elements relative to centered panel
    const offsetY = -totalHeight / 2;
    this.dynamicElements.forEach(el => {
      if ('y' in el) {
        (el as unknown as { y: number }).y += offsetY;
      }
    });

    this.updatePosition(totalHeight);

    // Fade in
    this.container.setAlpha(0);
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
    });

    // Click outside handler
    this.scene.time.delayedCall(100, () => {
      this.clickOutsideHandler = (pointer: Phaser.Input.Pointer) => {
        if (!this.isMenuOpen) return;
        const localX = pointer.worldX - this.container.x;
        const localY = pointer.worldY - this.container.y;
        const halfH = totalHeight / 2;
        if (localX < -PANEL_WIDTH / 2 || localX > PANEL_WIDTH / 2 ||
            localY < -halfH || localY > halfH) {
          this.close();
          this.onCancel();
        }
      };
      this.scene.input.on('pointerdown', this.clickOutsideHandler);
    });
  }

  /** Render header with minion stats */
  private renderHeader(minion: Minion, startY: number): number {
    let y = startY + PANEL_PADDING;
    const leftX = -PANEL_WIDTH / 2 + PANEL_PADDING;

    // Title
    const title = this.scene.add.text(0, y, 'MINION', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.title,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    this.dynamicElements.push(title);
    y += 22;

    // HP bar
    const hp = minion.getCurrentHp();
    const maxHp = minion.getMaxHp();
    y = this.renderStatBar(leftX, y, 'HP', hp, maxHp, COLORS.hp);

    // MP bar
    const mp = minion.getCurrentMp();
    const maxMp = minion.getMaxMp();
    y = this.renderStatBar(leftX, y, 'MP', mp, maxMp, COLORS.mp);

    // XP progress bar
    const level = minion.getLevel();
    const xp = minion.getXp();
    const xpToNext = minion.getXpToNextLevel();
    y = this.renderXpBar(leftX, y, level, xp, xpToNext);

    // Divider
    y = this.renderDivider(y);

    return y;
  }

  /** Render a stat bar (HP or MP) */
  private renderStatBar(x: number, y: number, label: string, current: number, max: number, color: string): number {
    const barWidth = 120;
    const barHeight = 10;

    // Label
    const labelText = this.scene.add.text(x, y, `${label}:`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.text,
    });
    this.container.add(labelText);
    this.dynamicElements.push(labelText);

    // Bar background
    const barX = x + 30;
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x333333, 1);
    barBg.fillRect(barX, y, barWidth, barHeight);
    this.container.add(barBg);
    this.dynamicElements.push(barBg);

    // Bar fill
    const fillWidth = Math.max(0, (current / max) * barWidth);
    const barFill = this.scene.add.graphics();
    barFill.fillStyle(parseInt(color.replace('#', ''), 16), 1);
    barFill.fillRect(barX, y, fillWidth, barHeight);
    this.container.add(barFill);
    this.dynamicElements.push(barFill);

    // Value text
    const valueText = this.scene.add.text(barX + barWidth + 8, y, `${current}/${max}`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: color,
    });
    this.container.add(valueText);
    this.dynamicElements.push(valueText);

    return y + barHeight + 6;
  }

  /** Render XP progress bar with level indicator */
  private renderXpBar(x: number, y: number, level: number, xp: number, xpToNext: number): number {
    const barWidth = 120;
    const barHeight = 10;

    // Label with level
    const labelText = this.scene.add.text(x, y, `Lv${level}:`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.text,
    });
    this.container.add(labelText);
    this.dynamicElements.push(labelText);

    // Bar background
    const barX = x + 30;
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x333333, 1);
    barBg.fillRect(barX, y, barWidth, barHeight);
    this.container.add(barBg);
    this.dynamicElements.push(barBg);

    // Bar fill (XP progress)
    const fillWidth = Math.max(0, (xp / xpToNext) * barWidth);
    const barFill = this.scene.add.graphics();
    barFill.fillStyle(parseInt(COLORS.xp.replace('#', ''), 16), 1);
    barFill.fillRect(barX, y, fillWidth, barHeight);
    this.container.add(barFill);
    this.dynamicElements.push(barFill);

    // Value text
    const valueText = this.scene.add.text(barX + barWidth + 8, y, `${xp}/${xpToNext}`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.xp,
    });
    this.container.add(valueText);
    this.dynamicElements.push(valueText);

    return y + barHeight + 6;
  }

  /** Render divider line */
  private renderDivider(y: number): number {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, COLORS.sectionBorder, 0.5);
    divider.lineBetween(-PANEL_WIDTH / 2 + PANEL_PADDING, y, PANEL_WIDTH / 2 - PANEL_PADDING, y);
    this.container.add(divider);
    this.dynamicElements.push(divider);
    return y + 8;
  }

  /** Render equipped gems section */
  private renderEquippedSection(minion: Minion, startY: number): number {
    let y = startY;
    const leftX = -PANEL_WIDTH / 2 + PANEL_PADDING;
    const equippedGems = minion.getAbilitySystem().getEquippedGems();

    // Section header
    const header = this.scene.add.text(leftX, y, 'EQUIPPED', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.subtitle,
    });
    this.container.add(header);
    this.dynamicElements.push(header);
    y += 16;

    if (equippedGems.length === 0) {
      const emptyText = this.scene.add.text(leftX, y, 'No gems equipped', {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: COLORS.hint,
        fontStyle: 'italic',
      });
      this.container.add(emptyText);
      this.dynamicElements.push(emptyText);
      y += 20;
    } else {
      for (let slot = 0; slot < equippedGems.length; slot++) {
        y = this.renderEquippedGemRow(minion, equippedGems[slot], slot, leftX, y);
      }
    }

    y = this.renderDivider(y + 4);
    return y;
  }

  /** Render a single equipped gem row */
  private renderEquippedGemRow(minion: Minion, gem: AbilityGem, slot: number, x: number, y: number): number {
    const entry = GemRegistry.get(gem.id);
    if (!entry) return y + ROW_HEIGHT;

    const visual = getGemVisual(gem.id);

    // Gem icon
    const icon = this.scene.add.circle(x + 10, y + 12, 8, visual.color);
    icon.setStrokeStyle(1, 0xffffff, 0.6);
    this.container.add(icon);
    this.dynamicElements.push(icon);

    // Gem name
    const nameText = this.scene.add.text(x + 26, y + 4, entry.name, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: COLORS.text,
      fontStyle: 'bold',
    });
    this.container.add(nameText);
    this.dynamicElements.push(nameText);

    // Description
    const descText = this.scene.add.text(x + 26, y + 18, entry.description, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.hint,
      wordWrap: { width: 200 },
    });
    this.container.add(descText);
    this.dynamicElements.push(descText);

    // Remove button
    const removeBtn = this.scene.add.text(PANEL_WIDTH / 2 - PANEL_PADDING - 50, y + 10, '[Remove]', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.remove,
    });
    removeBtn.setInteractive({ useHandCursor: true });
    removeBtn.on('pointerover', () => removeBtn.setColor('#ff9999'));
    removeBtn.on('pointerout', () => removeBtn.setColor(COLORS.remove));
    removeBtn.on('pointerdown', () => {
      this.onGemRemoved?.(minion, slot, gem.id);
      this.close();
    });
    this.container.add(removeBtn);
    this.dynamicElements.push(removeBtn);

    return y + 36;
  }

  /** Render inventory gems section */
  private renderInventorySection(minion: Minion, startY: number): number {
    if (!this.inventory) return startY;

    let y = startY;
    const leftX = -PANEL_WIDTH / 2 + PANEL_PADDING;

    const equippedIds = new Set(minion.getAbilitySystem().getEquippedGems().map(g => g.id));
    const availableGems = this.inventory.getGems().filter(g => !equippedIds.has(g.gemId));

    // Section header
    const header = this.scene.add.text(leftX, y, 'INVENTORY', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.subtitle,
    });
    this.container.add(header);
    this.dynamicElements.push(header);
    y += 16;

    if (availableGems.length === 0) {
      const emptyText = this.scene.add.text(leftX, y, 'No gems available', {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: COLORS.hint,
        fontStyle: 'italic',
      });
      this.container.add(emptyText);
      this.dynamicElements.push(emptyText);
      y += 20;
    } else {
      // Show up to 4 gems
      const gemsToShow = availableGems.slice(0, 4);
      for (const inventoryGem of gemsToShow) {
        y = this.renderInventoryGemRow(minion, inventoryGem, leftX, y);
      }
    }

    y = this.renderDivider(y + 4);
    return y;
  }

  /** Render a single inventory gem row */
  private renderInventoryGemRow(_minion: Minion, inventoryGem: InventoryGem, x: number, y: number): number {
    const entry = GemRegistry.get(inventoryGem.gemId);
    if (!entry) return y + ROW_HEIGHT;

    const visual = getGemVisual(inventoryGem.gemId);
    const cost = entry.essenceCost;
    const canAfford = this.currencyDisplay.canAfford(cost);

    // Gem icon
    const icon = this.scene.add.circle(x + 10, y + 12, 8, visual.color);
    icon.setStrokeStyle(1, 0xffffff, 0.6);
    this.container.add(icon);
    this.dynamicElements.push(icon);

    // Gem name
    const nameText = this.scene.add.text(x + 26, y + 4, entry.name, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: canAfford ? COLORS.text : COLORS.hint,
      fontStyle: 'bold',
    });
    this.container.add(nameText);
    this.dynamicElements.push(nameText);

    // Cost badge (more prominent)
    const costBadgeX = x + 26 + nameText.width + 10;
    const costBadgeY = y + 3;
    const costBg = this.scene.add.graphics();
    costBg.fillStyle(canAfford ? 0x4a3a00 : 0x333333, 1);
    costBg.fillRoundedRect(costBadgeX, costBadgeY, 36, 14, 4);
    this.container.add(costBg);
    this.dynamicElements.push(costBg);

    const costText = this.scene.add.text(costBadgeX + 4, costBadgeY + 1, `◆${cost}`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: canAfford ? COLORS.cost : COLORS.hint,
      fontStyle: 'bold',
    });
    this.container.add(costText);
    this.dynamicElements.push(costText);

    // Description
    const descText = this.scene.add.text(x + 26, y + 18, entry.description, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.hint,
      wordWrap: { width: 180 },
    });
    this.container.add(descText);
    this.dynamicElements.push(descText);

    // Equip button
    const btnColor = canAfford ? COLORS.button : COLORS.buttonDisabled;
    const equipBtn = this.scene.add.text(PANEL_WIDTH / 2 - PANEL_PADDING - 40, y + 10, '[Equip]', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: btnColor,
    });

    if (canAfford) {
      equipBtn.setInteractive({ useHandCursor: true });
      equipBtn.on('pointerover', () => equipBtn.setColor('#88ff88'));
      equipBtn.on('pointerout', () => equipBtn.setColor(COLORS.button));
      equipBtn.on('pointerdown', () => {
        const gem = entry.createGem();
        this.onInventoryGemEquipped?.(inventoryGem);
        this.onGemSelected(gem, entry);
      });
    }

    this.container.add(equipBtn);
    this.dynamicElements.push(equipBtn);

    return y + 36;
  }

  /** Render footer with repair button */
  private renderFooter(minion: Minion, startY: number): number {
    let y = startY;
    const isDamaged = minion.getCurrentHp() < minion.getMaxHp();

    // Repair button (if damaged)
    if (this.onRepair && isDamaged) {
      const canAfford = this.currencyDisplay.canAfford(this.repairCost);
      const btnColor = canAfford ? COLORS.button : COLORS.buttonDisabled;

      const repairBtn = this.scene.add.text(0, y, `[Repair - ${this.repairCost} Essence]`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: btnColor,
        fontStyle: 'bold',
      });
      repairBtn.setOrigin(0.5, 0);

      if (canAfford) {
        repairBtn.setInteractive({ useHandCursor: true });
        repairBtn.on('pointerover', () => repairBtn.setColor('#88ff88'));
        repairBtn.on('pointerout', () => repairBtn.setColor(COLORS.button));
        repairBtn.on('pointerdown', () => {
          if (this.onRepair?.(minion)) {
            this.close();
          }
        });
      }

      this.container.add(repairBtn);
      this.dynamicElements.push(repairBtn);
      y += 20;
    }

    // Close hint
    const hint = this.scene.add.text(0, y, 'ESC to close', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.hint,
    });
    hint.setOrigin(0.5, 0);
    this.container.add(hint);
    this.dynamicElements.push(hint);
    y += 16;

    return y;
  }

  public close(): void {
    if (!this.isMenuOpen) return;

    this.isMenuOpen = false;
    this.targetMinion = null;

    if (this.clickOutsideHandler) {
      this.scene.input.off('pointerdown', this.clickOutsideHandler);
      this.clickOutsideHandler = undefined;
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.clearDynamicElements();
      },
    });

    this.scene.input.setDefaultCursor('default');
  }

  public isOpen(): boolean {
    return this.isMenuOpen;
  }

  public getTargetMinion(): Minion | null {
    return this.targetMinion;
  }

  public update(): void {
    // Menu doesn't follow minion anymore - it's positioned once on open
  }

  private updatePosition(panelHeight: number): void {
    if (!this.targetMinion) return;

    const camera = this.scene.cameras.main;
    let targetX = this.targetMinion.x;
    let targetY = this.targetMinion.y + PANEL_OFFSET_Y;

    const halfWidth = PANEL_WIDTH / 2;
    const halfHeight = panelHeight / 2;
    const padding = 10;

    const minX = camera.scrollX + padding + halfWidth;
    const maxX = camera.scrollX + camera.width - padding - halfWidth;
    const minY = camera.scrollY + padding + halfHeight;
    const maxY = camera.scrollY + camera.height - padding - halfHeight;

    targetX = Phaser.Math.Clamp(targetX, minX, maxX);
    targetY = Phaser.Math.Clamp(targetY, minY, maxY);

    this.container.setPosition(targetX, targetY);
  }

  private clearDynamicElements(): void {
    this.dynamicElements.forEach(el => el.destroy());
    this.dynamicElements = [];
  }

  public destroy(): void {
    this.close();
    this.escKey?.destroy();
    this.container.destroy();
  }
}
