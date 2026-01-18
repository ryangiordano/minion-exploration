import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GemIcon, TextButton } from '../components';

const GEMS_PER_ROW = 5;

/** React-based inventory modal that displays collected gems */
export function InventoryModal() {
  const closeMenu = useGameStore((s) => s.closeMenu);
  const inventoryGems = useGameStore((s) => s.inventoryGems);
  const minions = useGameStore((s) => s.minions);
  const playerEssence = useGameStore((s) => s.playerEssence);
  const equipGem = useGameStore((s) => s.equipGem);

  // Selected gem for equipping
  const [selectedGemId, setSelectedGemId] = useState<string | null>(null);
  // Selected minion to equip on
  const [selectedMinionId, setSelectedMinionId] = useState<string | null>(null);

  const selectedGem = inventoryGems.find((g) => g.instanceId === selectedGemId);
  const canAfford = selectedGem ? playerEssence >= selectedGem.essenceCost : false;

  const handleGemClick = (instanceId: string) => {
    if (selectedGemId === instanceId) {
      setSelectedGemId(null);
      setSelectedMinionId(null);
    } else {
      setSelectedGemId(instanceId);
      setSelectedMinionId(null);
    }
  };

  const handleMinionClick = (minionId: string) => {
    if (!selectedGem) return;

    if (!canAfford) {
      return;
    }

    setSelectedMinionId(minionId);
    // Equip the gem
    equipGem(minionId, selectedGem.gemId);
    // Clear selection
    setSelectedGemId(null);
    setSelectedMinionId(null);
  };

  const handleClose = () => {
    setSelectedGemId(null);
    setSelectedMinionId(null);
    closeMenu();
  };

  // Create grid rows from gems
  const rows: typeof inventoryGems[] = [];
  for (let i = 0; i < inventoryGems.length; i += GEMS_PER_ROW) {
    rows.push(inventoryGems.slice(i, i + GEMS_PER_ROW));
  }

  return (
    <div className="inventory-modal">
      <div className="inventory-backdrop" onClick={handleClose} />
      <div className="inventory-panel panel">
        {/* Header */}
        <div className="inventory-header">
          <h2 className="panel-title">Inventory</h2>
          <TextButton onClick={handleClose} color="#ff6666">
            X
          </TextButton>
        </div>

        {/* Instructions */}
        <p className="inventory-instructions">
          {selectedGem
            ? `Click a minion to equip ${selectedGem.name}`
            : 'Click gem, then click minion to equip'}
        </p>

        {/* Gem Grid */}
        <div className="inventory-grid">
          {inventoryGems.length === 0 ? (
            <p className="empty-text">
              No gems collected
              <br />
              Defeat enemies to find gems!
            </p>
          ) : (
            rows.map((row, rowIndex) => (
              <div key={rowIndex} className="inventory-row">
                {row.map((gem) => {
                  const isSelected = selectedGemId === gem.instanceId;
                  return (
                    <div
                      key={gem.instanceId}
                      className={`inventory-slot ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleGemClick(gem.instanceId)}
                      title={`${gem.name}\n${gem.description}\nCost: ${gem.essenceCost}`}
                    >
                      <GemIcon color={gem.color} />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Selected gem info */}
        {selectedGem && (
          <div className="inventory-selection-info">
            <div className="selection-gem-header">
              <GemIcon color={selectedGem.color} />
              <span className="selection-gem-name">{selectedGem.name}</span>
              <span className={`gem-row-cost ${canAfford ? '' : 'disabled'}`}>
                ◆{selectedGem.essenceCost}
              </span>
            </div>
            <p className="selection-gem-desc">{selectedGem.description}</p>
            {!canAfford && (
              <p className="selection-warning">Not enough essence!</p>
            )}
          </div>
        )}

        {/* Minion selection for equipping */}
        {selectedGem && (
          <div className="inventory-minions">
            <p className="section-title">Select Minion</p>
            <div className="minion-buttons">
              {minions.map((minion, index) => (
                <button
                  key={minion.id}
                  className={`minion-select-btn ${selectedMinionId === minion.id ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}`}
                  onClick={() => handleMinionClick(minion.id)}
                  disabled={!canAfford}
                >
                  #{index + 1}
                  <span className="minion-hp">
                    {minion.hp}/{minion.maxHp}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Essence display */}
        <div className="inventory-footer">
          <span className="essence-display">◆ {playerEssence}</span>
        </div>
      </div>
    </div>
  );
}
