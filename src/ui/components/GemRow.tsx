import { GemIcon } from './GemIcon';
import { TextButton } from './Button';

interface GemRowProps {
  name: string;
  description: string;
  color: number;
  /** Whether this row is currently selected */
  isSelected?: boolean;
  /** Click handler for the entire row */
  onClick?: () => void;
  action?: {
    label: string;
    onClick: () => void;
    color?: string;
  };
  cost?: {
    amount: number;
    canAfford: boolean;
  };
}

/** A row displaying a gem with icon, name, description, and optional action */
export function GemRow({ name, description, color, isSelected, onClick, action, cost }: GemRowProps) {
  const isDisabled = cost && !cost.canAfford;
  const isClickable = !!onClick && !isDisabled;

  return (
    <div
      className={`gem-row ${isDisabled ? 'gem-row-disabled' : ''} ${isSelected ? 'gem-row-selected' : ''} ${isClickable ? 'gem-row-clickable' : ''}`}
      onClick={isClickable ? onClick : undefined}
      style={isClickable ? { cursor: 'pointer' } : undefined}
    >
      <GemIcon color={color} />
      <div className="gem-row-content">
        <div className="gem-row-header">
          <span className={`gem-row-name ${isDisabled ? 'disabled' : ''}`}>{name}</span>
          {cost && (
            <span className={`gem-row-cost ${cost.canAfford ? '' : 'disabled'}`}>
              ◆{cost.amount}
            </span>
          )}
        </div>
        <span className="gem-row-desc">{description}</span>
      </div>
      {action && (
        <div onClick={(e) => e.stopPropagation()}>
          <TextButton
            onClick={action.onClick}
            color={action.color || (isDisabled ? '#444444' : '#44ff44')}
          >
            [{action.label}]
          </TextButton>
        </div>
      )}
    </div>
  );
}
