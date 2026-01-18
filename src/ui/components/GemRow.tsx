import { GemIcon } from './GemIcon';
import { TextButton } from './Button';

interface GemRowProps {
  name: string;
  description: string;
  color: number;
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
export function GemRow({ name, description, color, action, cost }: GemRowProps) {
  const isDisabled = cost && !cost.canAfford;

  return (
    <div className={`gem-row ${isDisabled ? 'gem-row-disabled' : ''}`}>
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
        <TextButton
          onClick={action.onClick}
          color={action.color || (isDisabled ? '#444444' : '#44ff44')}
        >
          [{action.label}]
        </TextButton>
      )}
    </div>
  );
}
