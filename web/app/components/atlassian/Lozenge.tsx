'use client';

import React from 'react';

export type LozengeAppearance =
  | 'default'
  | 'success'
  | 'inprogress'
  | 'removed'
  | 'moved'
  | 'new';

export interface LozengeProps {
  readonly appearance?: LozengeAppearance;
  readonly isBold?: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const subtlePalette: Record<LozengeAppearance, { bg: string; text: string }> = {
  default: { bg: '#DFE1E6', text: '#42526E' },
  success: { bg: '#E3FCEF', text: '#006644' },
  inprogress: { bg: '#DEEBFF', text: '#0747A6' },
  removed: { bg: '#FFEBE6', text: '#BF2600' },
  moved: { bg: '#FFF0B3', text: '#172B4D' },
  new: { bg: '#EAE6FF', text: '#403294' },
};

const boldPalette: Record<LozengeAppearance, { bg: string; text: string }> = {
  default: { bg: '#42526E', text: '#FFFFFF' },
  success: { bg: '#00875A', text: '#FFFFFF' },
  inprogress: { bg: '#0052CC', text: '#FFFFFF' },
  removed: { bg: '#DE350B', text: '#FFFFFF' },
  moved: { bg: '#FFAB00', text: '#172B4D' },
  new: { bg: '#5243AA', text: '#FFFFFF' },
};

export function Lozenge({
  appearance = 'default',
  isBold = false,
  children,
  className,
  style,
}: LozengeProps): React.JSX.Element {
  const palette = isBold ? boldPalette[appearance] : subtlePalette[appearance];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 4px 3px 4px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: 1,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: palette.bg,
        color: palette.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default Lozenge;
