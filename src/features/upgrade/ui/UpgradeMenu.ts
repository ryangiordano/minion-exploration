import Phaser from 'phaser';
import { LAYERS } from '../../../core/config';
import { AbilityGem } from '../../../core/abilities/types';
import { Minion } from '../../minions';
import { CurrencyDisplay } from '../../level/ui/CurrencyDisplay';
import { GemRegistry, GemRegistryEntry } from '../data/GemRegistry';
import { InventoryState, InventoryGem, getGemVisual } from '../../inventory';

// Two-panel layout: left panel for gems, right panel for stats
const LEFT_PANEL_WIDTH = 340;
const RIGHT_PANEL_WIDTH = 180;
const PANEL_GAP = 8;
const TOTAL_WIDTH = LEFT_PANEL_WIDTH + PANEL_GAP + RIGHT_PANEL_WIDTH;
const PANEL_PADDING = 16;
const ROW_HEIGHT = 48;
const CORNER_RADIUS = 8;

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
  statLabel: '#888888',
  statValue: '#ffffff',
  strength: '#ff8844',
  magic: '#aa66ff',
  dexterity: '#44ff88',
  resilience: '#66aaff',
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
 * Minion management panel with two-panel layout.
 * Left panel: equipped gems, inventory gems, repair option.
 * Right panel: all combat stats.
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

  // Pagination state for inventory section
  private inventoryPage = 0;
  private inventoryGemsPerPage = 4;

  // Track panel height for click-outside detection
  private currentPanelHeight = 0;

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

  /** Draw both panels' backgrounds */
  private drawBackground(leftHeight: number, rightHeight: number): void {
    this.background.clear();

    const maxHeight = Math.max(leftHeight, rightHeight);
    const leftX = -TOTAL_WIDTH / 2;
    const rightX = leftX + LEFT_PANEL_WIDTH + PANEL_GAP;

    // Left panel background
    this.background.fillStyle(COLORS.background, 0.95);
    this.background.fillRoundedRect(
      leftX,
      -maxHeight / 2,
      LEFT_PANEL_WIDTH,
      maxHeight,
      CORNER_RADIUS
    );
    this.background.lineStyle(2, COLORS.border, 1);
    this.background.strokeRoundedRect(
      leftX,
      -maxHeight / 2,
      LEFT_PANEL_WIDTH,
      maxHeight,
      CORNER_RADIUS
    );

    // Right panel background
    this.background.fillStyle(COLORS.background, 0.95);
    this.background.fillRoundedRect(
      rightX,
      -maxHeight / 2,
      RIGHT_PANEL_WIDTH,
      maxHeight,
      CORNER_RADIUS
    );
    this.background.lineStyle(2, COLORS.border, 1);
    this.background.strokeRoundedRect(
      rightX,
      -maxHeight / 2,
      RIGHT_PANEL_WIDTH,
      maxHeight,
      CORNER_RADIUS
    );

    this.currentPanelHeight = maxHeight;
  }

  public open(minion: Minion): void {
    if (this.isMenuOpen) return;

    this.targetMinion = minion;
    this.isMenuOpen = true;
    this.inventoryPage = 0;

    this.renderFullMenu(minion);

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
        const halfH = this.currentPanelHeight / 2;
        // Check if click is outside both panels
        if (localX < -TOTAL_WIDTH / 2 || localX > TOTAL_WIDTH / 2 ||
            localY < -halfH || localY > halfH) {
          this.close();
          this.onCancel();
        }
      };
      this.scene.input.on('pointerdown', this.clickOutsideHandler);
    });
  }

  /** Render the complete menu (both panels) */
  private renderFullMenu(minion: Minion): void {
    this.clearDynamicElements();

    const leftX = -TOTAL_WIDTH / 2;
    const rightX = leftX + LEFT_PANEL_WIDTH + PANEL_GAP;

    // Render left panel content
    let leftY = 0;
    leftY = this.renderLeftHeader(minion, leftX, leftY);
    leftY = this.renderEquippedSection(minion, leftX, leftY);
    leftY = this.renderInventorySection(minion, leftX, leftY);
    leftY = this.renderFooter(minion, leftX, leftY);
    const leftHeight = leftY + PANEL_PADDING;

    // Render right panel content (stats)
    let rightY = 0;
    rightY = this.renderStatsPanel(minion, rightX, rightY);
    const rightHeight = rightY + PANEL_PADDING;

    // Draw backgrounds
    this.drawBackground(leftHeight, rightHeight);

    // Reposition all elements relative to centered panels
    const maxHeight = Math.max(leftHeight, rightHeight);
    const offsetY = -maxHeight / 2;
    this.dynamicElements.forEach(el => {
      if ('y' in el) {
        (el as unknown as { y: number }).y += offsetY;
      }
    });

    this.centerOnScreen();
  }

  /** Render left panel header with title */
  private renderLeftHeader(_minion: Minion, panelX: number, startY: number): number {
    let y = startY + PANEL_PADDING;
    const centerX = panelX + LEFT_PANEL_WIDTH / 2;

    // Title
    const title = this.scene.add.text(centerX, y, 'MINION', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.title,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    this.dynamicElements.push(title);
    y += 22;

    // Divider
    y = this.renderDivider(panelX, LEFT_PANEL_WIDTH, y);

    return y;
  }

  /** Render the stats panel on the right */
  private renderStatsPanel(minion: Minion, panelX: number, startY: number): number {
    let y = startY + PANEL_PADDING;
    const leftX = panelX + PANEL_PADDING;
    const centerX = panelX + RIGHT_PANEL_WIDTH / 2;

    // Title
    const title = this.scene.add.text(centerX, y, 'STATS', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.title,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    this.dynamicElements.push(title);
    y += 22;

    // Divider
    y = this.renderDivider(panelX, RIGHT_PANEL_WIDTH, y);

    // Get effective stats
    const stats = (minion as unknown as { getEffectiveStats(): Record<string, number> }).getEffectiveStats?.()
      ?? this.getStatsFromMinion(minion);

    // HP bar
    const hp = minion.getCurrentHp();
    const maxHp = minion.getMaxHp();
    y = this.renderMiniStatBar(leftX, y, 'HP', hp, maxHp, COLORS.hp, RIGHT_PANEL_WIDTH - PANEL_PADDING * 2);

    // MP bar
    const mp = minion.getCurrentMp();
    const maxMp = minion.getMaxMp();
    y = this.renderMiniStatBar(leftX, y, 'MP', mp, maxMp, COLORS.mp, RIGHT_PANEL_WIDTH - PANEL_PADDING * 2);

    // XP bar
    const level = minion.getLevel();
    const xp = minion.getXp();
    const xpToNext = minion.getXpToNextLevel();
    y = this.renderMiniXpBar(leftX, y, level, xp, xpToNext, RIGHT_PANEL_WIDTH - PANEL_PADDING * 2);

    y += 4;
    y = this.renderDivider(panelX, RIGHT_PANEL_WIDTH, y);

    // Combat stats
    y = this.renderStatLine(leftX, y, 'Strength', Math.floor(stats.strength ?? 1), COLORS.strength);
    y = this.renderStatLine(leftX, y, 'Magic', Math.floor(stats.magic ?? 1), COLORS.magic);
    y = this.renderStatLine(leftX, y, 'Dexterity', Math.floor(stats.dexterity ?? 1), COLORS.dexterity);
    y = this.renderStatLine(leftX, y, 'Resilience', Math.floor(stats.resilience ?? 1), COLORS.resilience);

    y += 4;
    y = this.renderDivider(panelX, RIGHT_PANEL_WIDTH, y);

    // Attack stats
    const attack = minion.getEffectiveAttack();
    y = this.renderStatLine(leftX, y, 'Damage', attack.damage, COLORS.strength);
    y = this.renderStatLine(leftX, y, 'Range', attack.range ?? 0, COLORS.text);
    y = this.renderStatLine(leftX, y, 'Type', attack.effectType ?? 'melee', COLORS.text, true);

    return y;
  }

  /** Fallback to get stats from minion if getEffectiveStats isn't available */
  private getStatsFromMinion(minion: Minion): Record<string, number> {
    return {
      maxHp: minion.getMaxHp(),
      maxMp: minion.getMaxMp(),
      strength: minion.getStat('strength'),
      magic: minion.getStat('magic'),
      dexterity: minion.getStat('dexterity'),
      resilience: 1,
    };
  }

  /** Render a compact stat bar for the right panel */
  private renderMiniStatBar(x: number, y: number, label: string, current: number, max: number, color: string, maxWidth: number): number {
    const barWidth = maxWidth - 50;
    const barHeight = 8;

    // Label
    const labelText = this.scene.add.text(x, y, `${label}`, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.statLabel,
    });
    this.container.add(labelText);
    this.dynamicElements.push(labelText);

    // Bar background
    const barX = x + 25;
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
    const valueText = this.scene.add.text(barX + barWidth + 4, y - 1, `${current}/${max}`, {
      fontFamily: 'Arial',
      fontSize: '8px',
      color: color,
    });
    this.container.add(valueText);
    this.dynamicElements.push(valueText);

    return y + barHeight + 6;
  }

  /** Render a compact XP bar */
  private renderMiniXpBar(x: number, y: number, level: number, xp: number, xpToNext: number, maxWidth: number): number {
    const barWidth = maxWidth - 50;
    const barHeight = 8;

    // Label with level
    const labelText = this.scene.add.text(x, y, `Lv${level}`, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.statLabel,
    });
    this.container.add(labelText);
    this.dynamicElements.push(labelText);

    // Bar background
    const barX = x + 25;
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x333333, 1);
    barBg.fillRect(barX, y, barWidth, barHeight);
    this.container.add(barBg);
    this.dynamicElements.push(barBg);

    // Bar fill
    const fillWidth = Math.max(0, (xp / xpToNext) * barWidth);
    const barFill = this.scene.add.graphics();
    barFill.fillStyle(parseInt(COLORS.xp.replace('#', ''), 16), 1);
    barFill.fillRect(barX, y, fillWidth, barHeight);
    this.container.add(barFill);
    this.dynamicElements.push(barFill);

    // Value text
    const valueText = this.scene.add.text(barX + barWidth + 4, y - 1, `${xp}/${xpToNext}`, {
      fontFamily: 'Arial',
      fontSize: '8px',
      color: COLORS.xp,
    });
    this.container.add(valueText);
    this.dynamicElements.push(valueText);

    return y + barHeight + 6;
  }

  /** Render a single stat line */
  private renderStatLine(x: number, y: number, label: string, value: number | string, color: string, isString = false): number {
    const labelText = this.scene.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.statLabel,
    });
    this.container.add(labelText);
    this.dynamicElements.push(labelText);

    const valueStr = isString ? String(value) : String(value);
    const valueText = this.scene.add.text(x + RIGHT_PANEL_WIDTH - PANEL_PADDING * 2, y, valueStr, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: color,
      fontStyle: 'bold',
    });
    valueText.setOrigin(1, 0);
    this.container.add(valueText);
    this.dynamicElements.push(valueText);

    return y + 16;
  }

  /** Render divider line for a specific panel */
  private renderDivider(panelX: number, panelWidth: number, y: number): number {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, COLORS.sectionBorder, 0.5);
    divider.lineBetween(panelX + PANEL_PADDING, y, panelX + panelWidth - PANEL_PADDING, y);
    this.container.add(divider);
    this.dynamicElements.push(divider);
    return y + 8;
  }

  /** Render equipped gems section */
  private renderEquippedSection(minion: Minion, panelX: number, startY: number): number {
    let y = startY;
    const leftX = panelX + PANEL_PADDING;
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
        y = this.renderEquippedGemRow(minion, equippedGems[slot], slot, panelX, leftX, y);
      }
    }

    y = this.renderDivider(panelX, LEFT_PANEL_WIDTH, y + 4);
    return y;
  }

  /** Render a single equipped gem row */
  private renderEquippedGemRow(minion: Minion, gem: AbilityGem, slot: number, panelX: number, x: number, y: number): number {
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
    const removeBtn = this.scene.add.text(panelX + LEFT_PANEL_WIDTH - PANEL_PADDING - 50, y + 10, '[Remove]', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.remove,
    });
    removeBtn.setInteractive({ useHandCursor: true });
    removeBtn.on('pointerover', () => removeBtn.setColor('#ff9999'));
    removeBtn.on('pointerout', () => removeBtn.setColor(COLORS.remove));
    removeBtn.on('pointerdown', () => {
      this.onGemRemoved?.(minion, slot, gem.id);
      // Refresh instead of close
      this.refreshMenu(minion);
    });
    this.container.add(removeBtn);
    this.dynamicElements.push(removeBtn);

    return y + 36;
  }

  /** Render inventory gems section with pagination */
  private renderInventorySection(minion: Minion, panelX: number, startY: number): number {
    if (!this.inventory) return startY;

    let y = startY;
    const leftX = panelX + PANEL_PADDING;
    const rightX = panelX + LEFT_PANEL_WIDTH - PANEL_PADDING;

    const equippedIds = new Set(minion.getAbilitySystem().getEquippedGems().map(g => g.id));
    const availableGems = this.inventory.getGems().filter(g => !equippedIds.has(g.gemId));

    // Calculate pagination
    const totalPages = Math.max(1, Math.ceil(availableGems.length / this.inventoryGemsPerPage));
    this.inventoryPage = Math.min(this.inventoryPage, totalPages - 1);
    const startIndex = this.inventoryPage * this.inventoryGemsPerPage;
    const endIndex = Math.min(startIndex + this.inventoryGemsPerPage, availableGems.length);

    // Section header with pagination arrows
    const header = this.scene.add.text(leftX, y, 'INVENTORY', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.subtitle,
    });
    this.container.add(header);
    this.dynamicElements.push(header);

    // Pagination controls (only show if more than one page)
    if (totalPages > 1) {
      this.renderPaginationControls(minion, rightX, y, totalPages);
    }

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
      // Show gems for current page
      const gemsToShow = availableGems.slice(startIndex, endIndex);
      for (const inventoryGem of gemsToShow) {
        y = this.renderInventoryGemRow(minion, inventoryGem, panelX, leftX, y);
      }
    }

    y = this.renderDivider(panelX, LEFT_PANEL_WIDTH, y + 4);
    return y;
  }

  /** Render pagination arrows and page indicator */
  private renderPaginationControls(minion: Minion, rightX: number, y: number, totalPages: number): void {
    const arrowSpacing = 12;

    // Page indicator (e.g., "1/3")
    const pageText = this.scene.add.text(rightX, y, `${this.inventoryPage + 1}/${totalPages}`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: COLORS.subtitle,
    });
    pageText.setOrigin(1, 0);
    this.container.add(pageText);
    this.dynamicElements.push(pageText);

    // Right arrow
    const canGoRight = this.inventoryPage < totalPages - 1;
    const rightArrow = this.scene.add.text(rightX - pageText.width - 4, y, '>', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: canGoRight ? COLORS.text : COLORS.hint,
      fontStyle: 'bold',
    });
    rightArrow.setOrigin(1, 0);
    if (canGoRight) {
      rightArrow.setInteractive({ useHandCursor: true });
      rightArrow.on('pointerover', () => rightArrow.setColor('#ffffff'));
      rightArrow.on('pointerout', () => rightArrow.setColor(COLORS.text));
      rightArrow.on('pointerdown', () => {
        this.inventoryPage++;
        this.refreshMenu(minion);
      });
    }
    this.container.add(rightArrow);
    this.dynamicElements.push(rightArrow);

    // Left arrow
    const canGoLeft = this.inventoryPage > 0;
    const leftArrow = this.scene.add.text(rightX - pageText.width - arrowSpacing - 4, y, '<', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: canGoLeft ? COLORS.text : COLORS.hint,
      fontStyle: 'bold',
    });
    leftArrow.setOrigin(1, 0);
    if (canGoLeft) {
      leftArrow.setInteractive({ useHandCursor: true });
      leftArrow.on('pointerover', () => leftArrow.setColor('#ffffff'));
      leftArrow.on('pointerout', () => leftArrow.setColor(COLORS.text));
      leftArrow.on('pointerdown', () => {
        this.inventoryPage--;
        this.refreshMenu(minion);
      });
    }
    this.container.add(leftArrow);
    this.dynamicElements.push(leftArrow);
  }

  /** Refresh the menu content without closing it */
  private refreshMenu(minion: Minion): void {
    this.renderFullMenu(minion);
  }

  /** Render a single inventory gem row */
  private renderInventoryGemRow(_minion: Minion, inventoryGem: InventoryGem, panelX: number, x: number, y: number): number {
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
    const equipBtn = this.scene.add.text(panelX + LEFT_PANEL_WIDTH - PANEL_PADDING - 40, y + 10, '[Equip]', {
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
        // Refresh instead of relying on external close
        if (this.targetMinion) {
          this.refreshMenu(this.targetMinion);
        }
      });
    }

    this.container.add(equipBtn);
    this.dynamicElements.push(equipBtn);

    return y + 36;
  }

  /** Render footer with repair button */
  private renderFooter(minion: Minion, panelX: number, startY: number): number {
    let y = startY;
    const centerX = panelX + LEFT_PANEL_WIDTH / 2;
    const isDamaged = minion.getCurrentHp() < minion.getMaxHp();

    // Repair button (if damaged)
    if (this.onRepair && isDamaged) {
      const canAfford = this.currencyDisplay.canAfford(this.repairCost);
      const btnColor = canAfford ? COLORS.button : COLORS.buttonDisabled;

      const repairBtn = this.scene.add.text(centerX, y, `[Repair - ${this.repairCost} Essence]`, {
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
            // Refresh instead of close to show updated HP
            this.refreshMenu(minion);
          }
        });
      }

      this.container.add(repairBtn);
      this.dynamicElements.push(repairBtn);
      y += 20;
    }

    // Close hint
    const hint = this.scene.add.text(centerX, y, 'ESC to close', {
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
    // Menu doesn't follow minion anymore - it's centered on screen
  }

  /** Center the menu on the screen */
  private centerOnScreen(): void {
    const camera = this.scene.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    this.container.setPosition(centerX, centerY);
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
