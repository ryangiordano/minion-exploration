import { ReactNode } from 'react';

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'text';
  children: ReactNode;
}

/** A styled button with primary, danger, and text variants */
export function Button({ onClick, disabled = false, variant = 'primary', children }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

interface TextButtonProps {
  onClick: () => void;
  color?: string;
  hoverColor?: string;
  children: ReactNode;
}

/** A minimal text-style button for inline actions */
export function TextButton({ onClick, color = '#44ff44', children }: TextButtonProps) {
  return (
    <button
      className="btn-text"
      onClick={onClick}
      style={{ color }}
    >
      {children}
    </button>
  );
}
