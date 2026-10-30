'use client';

import React from 'react';
import Link from 'next/link';

export type ButtonAppearance = 'primary' | 'default' | 'subtle' | 'danger';
export type ButtonSpacing = 'default' | 'compact' | 'none';

export interface AtlassianButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly appearance?: ButtonAppearance;
  readonly spacing?: ButtonSpacing;
  readonly href?: string;
  readonly children: React.ReactNode;
}

const getStyles = (
  appearance: ButtonAppearance = 'default',
  spacing: ButtonSpacing = 'default',
  isDisabled = false
): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1,
    borderRadius: '3px',
    border: 'none',
    boxShadow: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'background 0.1s ease-out, box-shadow 0.15s cubic-bezier(0.47, 0.03, 0.49, 1.38)',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const spacingStyles: Record<ButtonSpacing, React.CSSProperties> = {
    default: {
      height: '32px',
      padding: '0 12px',
    },
    compact: {
      height: '24px',
      padding: '0 8px',
      fontSize: '12px',
    },
    none: {
      height: 'auto',
      padding: 0,
    },
  };

  const appearanceStyles: Record<ButtonAppearance, React.CSSProperties> = {
    primary: {
      backgroundColor: '#0052cc',
      color: '#ffffff',
    },
    default: {
      backgroundColor: 'rgba(9, 30, 66, 0.04)',
      color: '#172b4d',
    },
    subtle: {
      backgroundColor: 'transparent',
      color: '#172b4d',
    },
    danger: {
      backgroundColor: '#de350b',
      color: '#ffffff',
    },
  };

  return {
    ...base,
    ...spacingStyles[spacing],
    ...appearanceStyles[appearance],
  };
};

export function Button({
  appearance = 'default',
  spacing = 'default',
  href,
  children,
  className,
  style,
  disabled,
  ...props
}: AtlassianButtonProps): React.JSX.Element {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  const computedStyles = React.useMemo(() => {
    const s = getStyles(appearance, spacing, disabled);

    if (!disabled) {
      if (isActive) {
        if (appearance === 'primary') s.backgroundColor = '#0747a6';
        else if (appearance === 'subtle') s.backgroundColor = 'rgba(9, 30, 66, 0.14)';
        else if (appearance === 'default') s.backgroundColor = 'rgba(9, 30, 66, 0.14)';
        else if (appearance === 'danger') s.backgroundColor = '#bf2600';
      } else if (isHovered) {
        if (appearance === 'primary') s.backgroundColor = '#0065ff';
        else if (appearance === 'subtle') s.backgroundColor = 'rgba(9, 30, 66, 0.08)';
        else if (appearance === 'default') s.backgroundColor = 'rgba(9, 30, 66, 0.08)';
        else if (appearance === 'danger') s.backgroundColor = '#ff5630';
      }
    }

    return { ...s, ...style };
  }, [appearance, spacing, disabled, isHovered, isActive, style]);

  const eventHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => {
      setIsHovered(false);
      setIsActive(false);
    },
    onMouseDown: () => setIsActive(true),
    onMouseUp: () => setIsActive(false),
  };

  if (href) {
    return (
      <Link
        href={href}
        style={computedStyles}
        className={className}
        {...eventHandlers}
        {...(props as any)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      style={computedStyles}
      className={className}
      disabled={disabled}
      {...eventHandlers}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
