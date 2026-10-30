'use client';

import React from 'react';

export type AvatarSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';

export interface AvatarProps {
  readonly name?: string;
  readonly initials?: string;
  readonly src?: string;
  readonly size?: AvatarSize;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

const sizeMap: Record<AvatarSize, { dimension: number; fontSize: string }> = {
  xsmall: { dimension: 16, fontSize: '9px' },
  small: { dimension: 24, fontSize: '11px' },
  medium: { dimension: 32, fontSize: '12px' },
  large: { dimension: 40, fontSize: '14px' },
  xlarge: { dimension: 48, fontSize: '16px' },
};

function extractInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  initials,
  src,
  size = 'medium',
  className,
  style,
}: AvatarProps): React.JSX.Element {
  const { dimension, fontSize } = sizeMap[size];
  const computedInitials = initials || extractInitials(name);

  return (
    <div
      className={className}
      style={{
        width: `${dimension}px`,
        height: `${dimension}px`,
        minWidth: `${dimension}px`,
        minHeight: `${dimension}px`,
        borderRadius: '50%',
        backgroundColor: '#deebff',
        color: '#0747a6',
        fontWeight: 600,
        fontSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        userSelect: 'none',
        border: '2px solid #ffffff',
        boxShadow: '0 0 0 1px #dfe1e6',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{computedInitials}</span>
      )}
    </div>
  );
}

export default Avatar;
