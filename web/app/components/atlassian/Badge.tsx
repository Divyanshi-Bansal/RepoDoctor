'use client';

import React from 'react';

export type BadgeAppearance = 'default' | 'primary' | 'important' | 'added' | 'removed';

export interface BadgeProps {
  readonly appearance?: BadgeAppearance;
  readonly children: React.ReactNode;
  readonly max?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const appearanceStyles: Record<BadgeAppearance, { bg: string; text: string }> = {
  default: { bg: '#DFE1E6', text: '#172B4D' },
  primary: { bg: '#0052CC', text: '#FFFFFF' },
  important: { bg: '#DE350B', text: '#FFFFFF' },
  added: { bg: '#E3FCEF', text: '#006644' },
  removed: { bg: '#FFEBE6', text: '#BF2600' },
};

export function Badge({
  appearance = 'default',
  children,
  max,
  className,
  style,
}: BadgeProps): React.JSX.Element {
  let displayValue = children;
  if (typeof children === 'number' && max !== undefined && children > max) {
    displayValue = `${max}+`;
  }

  const { bg, text } = appearanceStyles[appearance];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 6px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1,
        backgroundColor: bg,
        color: text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {displayValue}
    </span>
  );
}

export default Badge;
