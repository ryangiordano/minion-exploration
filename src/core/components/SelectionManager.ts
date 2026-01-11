import { Unit } from '../types/interfaces';
import { Command } from '../commands';

/**
 * Manages selection of units and issuing commands to selected units
 */
export class SelectionManager {
  private selected: Set<Unit> = new Set();

  /**
   * Select a single unit (clears previous selection)
   */
  public select(unit: Unit): void {
    this.clearSelection();
    this.addToSelection(unit);
  }

  /**
   * Add a unit to the current selection (multi-select)
   */
  public addToSelection(unit: Unit): void {
    this.selected.add(unit);
    unit.select();
  }

  /**
   * Remove a unit from the selection
   */
  public removeFromSelection(unit: Unit): void {
    if (this.selected.has(unit)) {
      this.selected.delete(unit);
      unit.deselect();
    }
  }

  /**
   * Toggle a unit's selection state
   */
  public toggleSelection(unit: Unit): void {
    if (this.selected.has(unit)) {
      this.removeFromSelection(unit);
    } else {
      this.addToSelection(unit);
    }
  }

  /**
   * Select multiple units at once (clears previous selection)
   */
  public selectMultiple(units: Unit[]): void {
    this.clearSelection();
    units.forEach(unit => this.addToSelection(unit));
  }

  /**
   * Add multiple units to the current selection (additive)
   */
  public addMultipleToSelection(units: Unit[]): void {
    units.forEach(unit => this.addToSelection(unit));
  }

  /**
   * Clear all selections
   */
  public clearSelection(): void {
    this.selected.forEach(unit => unit.deselect());
    this.selected.clear();
  }

  /**
   * Get all currently selected units
   */
  public getSelected(): Unit[] {
    return Array.from(this.selected);
  }

  /**
   * Check if any units are selected
   */
  public hasSelection(): boolean {
    return this.selected.size > 0;
  }

  /**
   * Get the number of selected units
   */
  public getSelectionCount(): number {
    return this.selected.size;
  }

  /**
   * Issue a command to all selected units
   */
  public issueCommand(command: Command): void {
    this.selected.forEach(unit => command.execute(unit));
  }
}
