import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Panel, Section, EmptyText, Hint } from '../components/Panel';
import { StatBar, StatLine, Divider } from '../components/StatBar';
import { Button } from '../components/Button';
import { GemRow } from '../components/GemRow';

const REPAIR_COST = 10;
const GEMS_PER_PAGE = 4;

/** Color constants matching the Phaser version */
const COLORS = {
  strength: '#ff8844',
  magic: '#aa66ff',
  dexterity: '#44ff88',
  resilience: '#66aaff',
  hp: '#ff6666',
  mp: '#6666ff',
  xp: '#ffd700',
};

export function UpgradeMenu() {
  const selectedMinionId = useGameStore((s) => s.selectedMinionId);
  const minions = useGameStore((s) => s.minions);
  const inventoryGems = useGameStore((s) => s.inventoryGems);
  const essence = useGameStore((s) => s.playerEssence);
  const closeMenu = useGameStore((s) => s.closeMenu);
  const equipGem = useGameStore((s) => s.equipGem);
  const removeGem = useGameStore((s) => s.removeGem);
  const repairMinion = useGameStore((s) => s.repairMinion);

  const [inventoryPage, setInventoryPage] = useState(0);

  const minion = minions.find((m) => m.id === selectedMinionId);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu]);

  if (!minion) return null;

  const isDamaged = minion.hp < minion.maxHp;
  const canRepair = essence >= REPAIR_COST && isDamaged;

  // Filter out equipped gems from inventory
  const equippedGemIds = new Set(minion.equippedGems.map((g) => g.id));
  const availableGems = inventoryGems.filter((g) => !equippedGemIds.has(g.gemId));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(availableGems.length / GEMS_PER_PAGE));
  const currentPage = Math.min(inventoryPage, totalPages - 1);
  const pagedGems = availableGems.slice(
    currentPage * GEMS_PER_PAGE,
    (currentPage + 1) * GEMS_PER_PAGE
  );

  return (
    <div className="upgrade-menu">
      {/* Left Panel - Gems */}
      <Panel title="MINION" width={340}>
        <Section title="EQUIPPED">
          {minion.equippedGems.length === 0 ? (
            <EmptyText>No gems equipped</EmptyText>
          ) : (
            minion.equippedGems.map((gem) => (
              <GemRow
                key={`${gem.id}-${gem.slot}`}
                name={gem.name}
                description={gem.description}
                color={gem.color}
                action={{
                  label: 'Remove',
                  onClick: () => removeGem(minion.id, gem.slot),
                  color: '#ff6666',
                }}
              />
            ))
          )}
        </Section>

        <Section
          title="INVENTORY"
          rightContent={
            totalPages > 1 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPrev={() => setInventoryPage((p) => Math.max(0, p - 1))}
                onNext={() => setInventoryPage((p) => Math.min(totalPages - 1, p + 1))}
              />
            )
          }
        >
          {availableGems.length === 0 ? (
            <EmptyText>No gems available</EmptyText>
          ) : (
            pagedGems.map((gem) => {
              const canAfford = essence >= gem.essenceCost;
              return (
                <GemRow
                  key={gem.instanceId}
                  name={gem.name}
                  description={gem.description}
                  color={gem.color}
                  cost={{ amount: gem.essenceCost, canAfford }}
                  action={{
                    label: 'Equip',
                    onClick: () => {
                      if (canAfford) {
                        equipGem(minion.id, gem.gemId);
                      }
                    },
                    color: canAfford ? '#44ff44' : '#444444',
                  }}
                />
              );
            })
          )}
        </Section>

        {isDamaged && (
          <div className="repair-section">
            <Button onClick={() => repairMinion(minion.id)} disabled={!canRepair}>
              Repair - {REPAIR_COST} Essence
            </Button>
          </div>
        )}

        <Hint>ESC to close</Hint>
      </Panel>

      {/* Right Panel - Stats */}
      <Panel title="STATS" width={180}>
        <StatBar label="HP" current={minion.hp} max={minion.maxHp} color={COLORS.hp} />
        <StatBar label="MP" current={minion.mp} max={minion.maxMp} color={COLORS.mp} />
        <StatBar
          label={`Lv${minion.level}`}
          current={minion.xp}
          max={minion.xpToNext}
          color={COLORS.xp}
        />

        <Divider />

        <StatLine label="Strength" value={minion.stats.strength} color={COLORS.strength} />
        <StatLine label="Magic" value={minion.stats.magic} color={COLORS.magic} />
        <StatLine label="Dexterity" value={minion.stats.dexterity} color={COLORS.dexterity} />
        <StatLine label="Resilience" value={minion.stats.resilience} color={COLORS.resilience} />

        <Divider />

        <StatLine label="Damage" value={minion.attack.damage} color={COLORS.strength} />
        <StatLine label="Range" value={minion.attack.range} />
        <StatLine label="Type" value={minion.attack.effectType} />
      </Panel>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={onPrev}
        disabled={page === 0}
      >
        {'<'}
      </button>
      <span className="pagination-text">
        {page + 1}/{totalPages}
      </span>
      <button
        className="pagination-btn"
        onClick={onNext}
        disabled={page >= totalPages - 1}
      >
        {'>'}
      </button>
    </div>
  );
}
