import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Panel, Section, EmptyText, Hint } from '../components/Panel';
import { StatBar, StatLine, Divider } from '../components/StatBar';
import { Button } from '../components/Button';
import { GemRow } from '../components/GemRow';
import type { MinionState } from '../../shared/types';

const REPAIR_COST = 10;
const GEMS_PER_PAGE = 3;

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

export function PartyUpgradeMenu() {
  const minions = useGameStore((s) => s.minions);
  const inventoryGems = useGameStore((s) => s.inventoryGems);
  const essence = useGameStore((s) => s.playerEssence);
  const closeMenu = useGameStore((s) => s.closeMenu);
  const equipGem = useGameStore((s) => s.equipGem);
  const removeGem = useGameStore((s) => s.removeGem);
  const repairMinion = useGameStore((s) => s.repairMinion);

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

  // Handle click outside to close
  const handleBackdropClick = () => {
    closeMenu();
  };

  if (minions.length === 0) return null;

  return (
    <div className="party-menu">
      <div className="party-backdrop" onClick={handleBackdropClick} />
      <div className="party-panels">
        {minions.map((minion, index) => (
          <MinionPanel
            key={minion.id}
            minion={minion}
            minionIndex={index + 1}
            inventoryGems={inventoryGems}
            essence={essence}
            equipGem={equipGem}
            removeGem={removeGem}
            repairMinion={repairMinion}
          />
        ))}
      </div>
      <Hint>ESC to close</Hint>
    </div>
  );
}

interface MinionPanelProps {
  minion: MinionState;
  minionIndex: number;
  inventoryGems: ReturnType<typeof useGameStore.getState>['inventoryGems'];
  essence: number;
  equipGem: (minionId: string, gemId: string) => void;
  removeGem: (minionId: string, slot: number) => void;
  repairMinion: (minionId: string) => void;
}

function MinionPanel({
  minion,
  minionIndex,
  inventoryGems,
  essence,
  equipGem,
  removeGem,
  repairMinion,
}: MinionPanelProps) {
  const [inventoryPage, setInventoryPage] = useState(0);

  const isDamaged = minion.hp < minion.maxHp;
  const canRepair = essence >= REPAIR_COST && isDamaged;

  // Filter out gems already equipped on this minion
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
    <Panel title={`MINION ${minionIndex}`}>
      {/* Stats Section - stacked on top */}
      <Section title="STATS">
        <StatBar label="HP" current={minion.hp} max={minion.maxHp} color={COLORS.hp} />
        <StatBar label="MP" current={minion.mp} max={minion.maxMp} color={COLORS.mp} />
        <StatBar
          label={`Lv${minion.level}`}
          current={minion.xp}
          max={minion.xpToNext}
          color={COLORS.xp}
        />

        <Divider />

        <div className="stat-grid">
          <StatLine label="STR" value={minion.stats.strength} color={COLORS.strength} />
          <StatLine label="MAG" value={minion.stats.magic} color={COLORS.magic} />
          <StatLine label="DEX" value={minion.stats.dexterity} color={COLORS.dexterity} />
          <StatLine label="RES" value={minion.stats.resilience} color={COLORS.resilience} />
        </div>

        <Divider />

        <StatLine label="Damage" value={minion.attack.damage} color={COLORS.strength} />
        <StatLine label="Range" value={minion.attack.range} />
      </Section>

      {/* Equipped Gems */}
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

      {/* Inventory Gems */}
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

      {/* Repair Button */}
      {isDamaged && (
        <div className="repair-section">
          <Button onClick={() => repairMinion(minion.id)} disabled={!canRepair}>
            Repair - {REPAIR_COST} Essence
          </Button>
        </div>
      )}
    </Panel>
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
      <button className="pagination-btn" onClick={onPrev} disabled={page === 0}>
        {'<'}
      </button>
      <span className="pagination-text">
        {page + 1}/{totalPages}
      </span>
      <button className="pagination-btn" onClick={onNext} disabled={page >= totalPages - 1}>
        {'>'}
      </button>
    </div>
  );
}
