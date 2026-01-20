/**
 * Helper functions to convert Phaser game objects to store state.
 * This keeps the conversion logic separate from the scene.
 */

import type { MinionState, EquippedGemState, InventoryGemState } from '../../shared/types';
import type { Minion } from '../../features/minions';
import type { InventoryState, InventoryGem } from '../../features/inventory';
import { GemRegistry } from '../../features/upgrade';
import { getGemVisual } from '../../features/inventory';

/** Convert a Minion game object to MinionState for the store */
export function minionToState(minion: Minion, index: number): MinionState {
  const attack = minion.getEffectiveAttack();
  const equippedGems = minion.getAbilitySystem().getEquippedGems();

  return {
    id: `minion-${index}`,
    hp: minion.getCurrentHp(),
    maxHp: minion.getMaxHp(),
    mp: minion.getCurrentMp(),
    maxMp: minion.getMaxMp(),
    xp: minion.getXp(),
    xpToNext: minion.getXpToNextLevel(),
    level: minion.getLevel(),
    stats: {
      strength: Math.floor(minion.getStat('strength')),
      magic: Math.floor(minion.getStat('magic')),
      dexterity: Math.floor(minion.getStat('dexterity')),
      resilience: 1, // Resilience not exposed via getStat, use default
    },
    equippedGems: equippedGems.map((gem, slot) => {
      const entry = GemRegistry.get(gem.id);
      const visual = getGemVisual(gem.id);
      const essenceCost = entry?.essenceCost ?? 0;
      return {
        id: gem.id,
        slot,
        name: entry?.name ?? 'Unknown Gem',
        description: entry?.description ?? '',
        color: visual.color,
        removalCost: Math.floor(essenceCost * 0.25),
      } satisfies EquippedGemState;
    }),
    attack: {
      damage: attack.damage,
      range: attack.range ?? 0,
      effectType: attack.effectType ?? 'melee',
    },
  };
}

/** Convert multiple minions to state array */
export function minionsToState(minions: Minion[]): MinionState[] {
  return minions.map((m, i) => minionToState(m, i));
}

/** Convert inventory gems to state for the store */
export function inventoryToGemState(inventory: InventoryState): InventoryGemState[] {
  return inventory.getGems().map((gem: InventoryGem) => {
    const entry = GemRegistry.get(gem.gemId);
    const visual = getGemVisual(gem.gemId);
    const essenceCost = entry?.essenceCost ?? 0;
    return {
      instanceId: gem.instanceId,
      gemId: gem.gemId,
      name: entry?.name ?? 'Unknown Gem',
      description: entry?.description ?? '',
      essenceCost,
      sellValue: Math.floor(essenceCost * 0.25),
      color: visual.color,
    } satisfies InventoryGemState;
  });
}
