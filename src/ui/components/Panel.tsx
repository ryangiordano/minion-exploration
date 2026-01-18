import { ReactNode } from 'react';

interface PanelProps {
  title: string;
  width?: number;
  children: ReactNode;
}

/** A styled container panel with a title header */
export function Panel({ title, width = 340, children }: PanelProps) {
  return (
    <div className="panel" style={{ width }}>
      <div className="panel-header">
        <span className="panel-title">{title}</span>
      </div>
      <div className="panel-divider" />
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
  rightContent?: ReactNode;
}

/** A section within a panel with its own header */
export function Section({ title, children, rightContent }: SectionProps) {
  return (
    <div className="panel-section">
      <div className="section-header">
        <span className="section-title">{title}</span>
        {rightContent && <div className="section-right">{rightContent}</div>}
      </div>
      <div className="section-content">
        {children}
      </div>
      <div className="panel-divider" />
    </div>
  );
}

/** Styled text for empty states */
export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="empty-text">{children}</p>;
}

/** Styled hint text at bottom of panels */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint-text">{children}</p>;
}
