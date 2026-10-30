'use client';

import React from 'react';

export interface EmptyStateProps {
  readonly header: string;
  readonly description?: React.ReactNode;
  readonly primaryAction?: React.ReactNode;
  readonly secondaryAction?: React.ReactNode;
  readonly renderImage?: () => React.ReactNode;
  readonly testId?: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function DefaultEmptyIllustration(): React.JSX.Element {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto' }}
      aria-hidden="true"
    >
      {/* Background soft backdrop */}
      <ellipse cx="80" cy="98" rx="64" ry="14" fill="#EBECF0" />

      {/* Main card / repo box */}
      <rect
        x="36"
        y="24"
        width="88"
        height="64"
        rx="3"
        fill="#FFFFFF"
        stroke="#DFE1E6"
        strokeWidth="1.5"
      />

      {/* Header bar of card */}
      <rect x="36" y="24" width="88" height="16" rx="3" fill="#FAFBFC" />
      <line x1="36" y1="40" x2="124" y2="40" stroke="#DFE1E6" strokeWidth="1" />
      <circle cx="46" cy="32" r="3" fill="#4C9AFF" />
      <circle cx="56" cy="32" r="3" fill="#DFE1E6" />
      <circle cx="66" cy="32" r="3" fill="#DFE1E6" />

      {/* Repository branches & node lines */}
      <path
        d="M50 56H68C72.4183 56 76 59.5817 76 64V72"
        stroke="#4C9AFF"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      <circle cx="50" cy="56" r="4" fill="#0052CC" />
      <circle cx="76" cy="72" r="4" fill="#36B37E" />
      <circle cx="106" cy="56" r="4" fill="#6554C0" />
      <path
        d="M86 56H106"
        stroke="#DFE1E6"
        strokeWidth="2"
      />

      {/* Floating accent elements */}
      <rect x="120" y="32" width="16" height="16" rx="3" fill="#DEEBFF" />
      <path d="M125 40H131M128 37V43" stroke="#0052CC" strokeWidth="1.5" strokeLinecap="round" />

      <circle cx="28" cy="44" r="5" fill="#EAE6FF" />
      <circle cx="28" cy="44" r="2" fill="#6554C0" />
    </svg>
  );
}

export function EmptyState({
  header,
  description,
  primaryAction,
  secondaryAction,
  renderImage,
  testId,
  className,
  style,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        maxWidth: '640px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        border: '1px solid #dfe1e6',
        borderRadius: '3px',
        boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        {renderImage ? renderImage() : <DefaultEmptyIllustration />}
      </div>

      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: '20px',
          fontWeight: 600,
          lineHeight: '24px',
          color: '#172b4d',
          letterSpacing: '-0.008em',
        }}
      >
        {header}
      </h3>

      {description && (
        <div
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b778c',
            maxWidth: '520px',
          }}
        >
          {description}
        </div>
      )}

      {(primaryAction || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
