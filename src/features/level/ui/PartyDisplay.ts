import Phaser from 'phaser';
import { PartyManager } from '../../../core/game-state';

/**
 * UI display showing current party size vs max.
 * Example: "Minions: 2/3"
 */
export class PartyDisplay {
  private text: Phaser.GameObjects.Text;
  private partyManager: PartyManager;

  constructor(scene: Phaser.Scene, partyManager: PartyManager, x: number, y: number) {
    this.partyManager = partyManager;

    this.text = scene.add.text(x, y, this.getDisplayText(), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
    });
    this.text.setScrollFactor(0);
    this.text.setDepth(100);
  }

  private getDisplayText(): string {
    return `Minions: ${this.partyManager.getSize()}/${this.partyManager.getMaxSize()}`;
  }

  /** Update display to reflect current party state */
  update(): void {
    this.text.setText(this.getDisplayText());

    // Color code based on status
    if (this.partyManager.getSize() === 0) {
      this.text.setColor('#ff6666'); // Red - no minions
    } else if (this.partyManager.isFull()) {
      this.text.setColor('#88ff88'); // Green - full party
    } else {
      this.text.setColor('#ffffff'); // White - normal
    }
  }

  destroy(): void {
    this.text.destroy();
  }
}
