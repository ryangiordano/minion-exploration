import Phaser from 'phaser';
import { InventoryState, InventoryGem } from '../data/InventoryState';
import { getGemVisual } from '../data/GemConfig';
import { GemRegistry } from '../../upgrade';

const MODAL_WIDTH = 300;
const MODAL_HEIGHT = 400;
const GEM_SLOT_SIZE = 40;
const GEM_SLOT_PADDING = 8;
const GEMS_PER_ROW = 5;

export interface InventoryModalConfig {
  scene: Phaser.Scene;
  inventory: InventoryState;
  onGemSelected?: (gem: InventoryGem) => void;
  onClose?: () => void;
}

/**
 * Modal UI that displays the player's gem inventory.
 * Opens with I key, allows selecting gems for equipping.
 */
export class InventoryModal {
  private scene: Phaser.Scene;
  private inventory: InventoryState;
  private onGemSelected?: (gem: InventoryGem) => void;
  private onClose?: () => void;

  private container?: Phaser.GameObjects.Container;
  private gemSlots: Phaser.GameObjects.Container[] = [];
  private selectedGem: InventoryGem | null = null;
  private closeKeyTimer?: Phaser.Time.TimerEvent;
  private escKeyHandler?: () => void;
  private iKeyHandler?: () => void;

  constructor(config: InventoryModalConfig) {
    this.scene = config.scene;
    this.inventory = config.inventory;
    this.onGemSelected = config.onGemSelected;
    this.onClose = config.onClose;
  }

  public open(): void {
    console.log('InventoryModal.open() called, container exists:', !!this.container);
    if (this.container) return;

    this.createModal();
    this.renderGems();
    console.log('Modal created, container:', !!this.container);
  }

  public close(): void {
    if (!this.container) return;

    // Clean up key listeners
    if (this.closeKeyTimer) {
      this.closeKeyTimer.destroy();
      this.closeKeyTimer = undefined;
    }
    if (this.escKeyHandler) {
      this.scene.input.keyboard?.off('keydown-ESC', this.escKeyHandler);
      this.escKeyHandler = undefined;
    }
    if (this.iKeyHandler) {
      this.scene.input.keyboard?.off('keydown-I', this.iKeyHandler);
      this.iKeyHandler = undefined;
    }

    this.container.destroy();
    this.container = undefined;
    this.gemSlots = [];
    this.selectedGem = null;
    this.onClose?.();
  }

  public isOpen(): boolean {
    return !!this.container;
  }

  public getSelectedGem(): InventoryGem | null {
    return this.selectedGem;
  }

  public clearSelection(): void {
    this.selectedGem = null;
    this.updateSlotHighlights();
  }

  private createModal(): void {
    const camera = this.scene.cameras.main;
    // Position in screen space (accounting for camera scroll)
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;

    console.log('Creating modal at', centerX, centerY, 'camera scroll:', camera.scrollX, camera.scrollY);

    this.container = this.scene.add.container(centerX, centerY);
    this.container.setDepth(2000);

    // Semi-transparent backdrop
    const backdrop = this.scene.add.rectangle(
      0, 0,
      camera.width * 2, camera.height * 2,
      0x000000, 0.5
    );
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.close());
    this.container.add(backdrop);

    // Modal panel
    const panel = this.scene.add.rectangle(
      0, 0,
      MODAL_WIDTH, MODAL_HEIGHT,
      0x2a2a2a, 1
    );
    panel.setStrokeStyle(2, 0x666666);
    panel.setInteractive(); // Prevent clicks from closing
    this.container.add(panel);

    // Title
    const title = this.scene.add.text(0, -MODAL_HEIGHT / 2 + 20, 'Inventory', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);

    // Instructions
    const instructions = this.scene.add.text(0, -MODAL_HEIGHT / 2 + 50, 'Click gem, then click minion to equip', {
      fontSize: '12px',
      color: '#aaaaaa',
    });
    instructions.setOrigin(0.5, 0);
    this.container.add(instructions);

    // Close button
    const closeBtn = this.scene.add.text(
      MODAL_WIDTH / 2 - 15,
      -MODAL_HEIGHT / 2 + 15,
      'X',
      { fontSize: '18px', color: '#ff6666', fontStyle: 'bold' }
    );
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff9999'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    this.container.add(closeBtn);

    // Escape key to close (delay to avoid triggering on the same keypress that opened)
    this.escKeyHandler = () => this.close();
    this.iKeyHandler = () => this.close();

    const escHandler = this.escKeyHandler;
    const iHandler = this.iKeyHandler;

    this.closeKeyTimer = this.scene.time.delayedCall(100, () => {
      this.scene.input.keyboard?.on('keydown-ESC', escHandler);
      this.scene.input.keyboard?.on('keydown-I', iHandler);
    });
  }

  private renderGems(): void {
    if (!this.container) return;

    // Clear existing slots
    this.gemSlots.forEach(slot => slot.destroy());
    this.gemSlots = [];

    const gems = this.inventory.getGems();
    const startX = -((GEMS_PER_ROW - 1) * (GEM_SLOT_SIZE + GEM_SLOT_PADDING)) / 2;
    const startY = -MODAL_HEIGHT / 2 + 90;

    gems.forEach((gem, index) => {
      const col = index % GEMS_PER_ROW;
      const row = Math.floor(index / GEMS_PER_ROW);
      const x = startX + col * (GEM_SLOT_SIZE + GEM_SLOT_PADDING);
      const y = startY + row * (GEM_SLOT_SIZE + GEM_SLOT_PADDING);

      const slot = this.createGemSlot(gem, x, y);
      this.gemSlots.push(slot);
      this.container!.add(slot);
    });

    // Empty state
    if (gems.length === 0) {
      const emptyText = this.scene.add.text(0, 0, 'No gems collected\nDefeat enemies to find gems!', {
        fontSize: '14px',
        color: '#888888',
        align: 'center',
      });
      emptyText.setOrigin(0.5, 0.5);
      this.container.add(emptyText);
    }
  }

  private createGemSlot(gem: InventoryGem, x: number, y: number): Phaser.GameObjects.Container {
    const slot = this.scene.add.container(x, y);
    const visual = getGemVisual(gem.gemId);
    const entry = GemRegistry.get(gem.gemId);

    // Slot background
    const bg = this.scene.add.rectangle(0, 0, GEM_SLOT_SIZE, GEM_SLOT_SIZE, 0x444444);
    bg.setStrokeStyle(2, 0x666666);
    slot.add(bg);

    // Gem circle
    const gemCircle = this.scene.add.circle(0, 0, 12, visual.color);
    gemCircle.setStrokeStyle(2, 0xffffff);
    slot.add(gemCircle);

    // Make interactive
    slot.setSize(GEM_SLOT_SIZE, GEM_SLOT_SIZE);
    slot.setInteractive({ useHandCursor: true });

    // Store reference for highlighting
    slot.setData('gem', gem);
    slot.setData('bg', bg);

    // Click to select
    slot.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.selectGem(gem);
      }
    });

    // Hover effects
    slot.on('pointerover', () => {
      bg.setFillStyle(0x555555);
      this.showTooltip(slot, gem, entry);
    });

    slot.on('pointerout', () => {
      const isSelected = this.selectedGem?.instanceId === gem.instanceId;
      bg.setFillStyle(isSelected ? 0x666688 : 0x444444);
      this.hideTooltip();
    });

    return slot;
  }

  private selectGem(gem: InventoryGem): void {
    // Toggle selection
    if (this.selectedGem?.instanceId === gem.instanceId) {
      this.selectedGem = null;
    } else {
      this.selectedGem = gem;
      this.onGemSelected?.(gem);
    }
    this.updateSlotHighlights();
  }

  private updateSlotHighlights(): void {
    this.gemSlots.forEach(slot => {
      const slotGem = slot.getData('gem') as InventoryGem;
      const bg = slot.getData('bg') as Phaser.GameObjects.Rectangle;
      const isSelected = this.selectedGem?.instanceId === slotGem.instanceId;
      bg.setFillStyle(isSelected ? 0x666688 : 0x444444);
      bg.setStrokeStyle(2, isSelected ? 0x8888ff : 0x666666);
    });
  }

  private tooltipContainer?: Phaser.GameObjects.Container;

  private showTooltip(slot: Phaser.GameObjects.Container, gem: InventoryGem, entry: ReturnType<typeof GemRegistry.get>): void {
    this.hideTooltip();

    if (!entry || !this.container) return;

    const visual = getGemVisual(gem.gemId);
    const tooltip = this.scene.add.container(slot.x, slot.y + GEM_SLOT_SIZE / 2 + 10);

    const bg = this.scene.add.rectangle(0, 20, 140, 50, 0x222222, 0.95);
    bg.setStrokeStyle(1, 0x666666);
    tooltip.add(bg);

    const name = this.scene.add.text(0, 8, entry.name, {
      fontSize: '12px',
      color: `#${visual.color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    });
    name.setOrigin(0.5, 0);
    tooltip.add(name);

    const desc = this.scene.add.text(0, 24, entry.description, {
      fontSize: '10px',
      color: '#aaaaaa',
    });
    desc.setOrigin(0.5, 0);
    tooltip.add(desc);

    this.tooltipContainer = tooltip;
    this.container.add(tooltip);
  }

  private hideTooltip(): void {
    this.tooltipContainer?.destroy();
    this.tooltipContainer = undefined;
  }
}
