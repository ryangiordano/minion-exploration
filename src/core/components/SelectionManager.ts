import { Selectable } from '../types/interfaces';

/**
 * Manages selection of units
 */
export class SelectionManager {
  private selected: Set<Selectable> = new Set();

  /**
   * Select a single unit (clears previous selection)
   */
  public select(unit: Selectable): void {
    this.clearSelection();
    this.addToSelection(unit);
  }

  /**
   * Add a unit to the current selection (multi-select)
   */
  public addToSelection(unit: Selectable): void {
    this.selected.add(unit);
    unit.select();
  }

  /**
   * Remove a unit from the selection
   */
  public removeFromSelection(unit: Selectable): void {
    if (this.selected.has(unit)) {
      this.selected.delete(unit);
      unit.deselect();
    }
  }

  /**
   * Toggle a unit's selection state
   */
  public toggleSelection(unit: Selectable): void {
    if (this.selected.has(unit)) {
      this.removeFromSelection(unit);
    } else {
      this.addToSelection(unit);
    }
  }

  /**
   * Select multiple units at once (clears previous selection)
   */
  public selectMultiple(units: Selectable[]): void {
    this.clearSelection();
    units.forEach(unit => this.addToSelection(unit));
  }

  /**
   * Add multiple units to the current selection (additive)
   */
  public addMultipleToSelection(units: Selectable[]): void {
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
  public getSelected(): Selectable[] {
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
}
