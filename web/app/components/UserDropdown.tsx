'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AuthUserInfo } from './Header';
import { Avatar } from './atlassian/Avatar';
import { Lozenge } from './atlassian/Lozenge';

interface UserDropdownProps {
  readonly user: AuthUserInfo;
  readonly onLogout: () => void;
  readonly onNavigateProfile: () => void;
  readonly onConnectGitHub?: () => void;
  readonly onConnectGitLab?: () => void;
}

function getInitials(name?: string, username?: string): string {
  const target = (name || username || 'U').trim();
  const parts = target.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.slice(0, 2).toUpperCase();
}

export function UserDropdown({
  user,
  onLogout,
  onNavigateProfile,
  onConnectGitHub,
  onConnectGitLab,
}: UserDropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const initials = getInitials(user.name, user.username);
  const displayName = user.name || user.username;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      data-testid="user-dropdown-container"
    >
      <button
        type="button"
        data-testid="user-avatar-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`Account: ${displayName}`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          borderRadius: '50%',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Avatar name={displayName} initials={initials} size="medium" />
      </button>

      {isOpen && (
        <div
          role="menu"
          data-testid="user-dropdown-menu"
          aria-label="User account menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            backgroundColor: '#ffffff',
            border: '1px solid #dfe1e6',
            borderRadius: '3px',
            boxShadow: '0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
            padding: '8px 0',
            zIndex: 100,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          }}
        >
          {/* User Identity Header */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #dfe1e6',
            }}
          >
            <div
              data-testid="dropdown-user-name"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#172b4d',
                lineHeight: 1.3,
              }}
            >
              {displayName}
            </div>
            {user.email && (
              <div
                data-testid="dropdown-user-email"
                style={{
                  fontSize: '12px',
                  color: '#6b778c',
                  wordBreak: 'break-all',
                  marginTop: '2px',
                }}
              >
                {user.email}
              </div>
            )}

            {/* Provider Status Indicators */}
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#42526e',
                }}
              >
                <span>GitHub:</span>
                {user.githubUsername ? (
                  <Lozenge appearance="success">@{user.githubUsername}</Lozenge>
                ) : (
                  <Lozenge appearance="default">DISCONNECTED</Lozenge>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#42526e',
                }}
              >
                <span>GitLab:</span>
                {user.gitlabUsername ? (
                  <Lozenge appearance="inprogress">@{user.gitlabUsername}</Lozenge>
                ) : (
                  <Lozenge appearance="default">DISCONNECTED</Lozenge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Provider Connect (if disconnected) */}
          {(!user.githubUsername || !user.gitlabUsername) && (
            <div
              style={{
                padding: '6px 16px',
                backgroundColor: '#fafbfc',
                borderBottom: '1px solid #dfe1e6',
              }}
            >
              {!user.githubUsername && onConnectGitHub && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onConnectGitHub();
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    padding: '4px 0',
                    fontSize: '13px',
                    color: '#0052cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  + Connect GitHub Account
                </button>
              )}
              {!user.gitlabUsername && onConnectGitLab && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onConnectGitLab();
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    padding: '4px 0',
                    fontSize: '13px',
                    color: '#0052cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  + Connect GitLab Account
                </button>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div style={{ padding: '4px 0' }}>
            <button
              type="button"
              data-testid="dropdown-profile-link"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onNavigateProfile();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                fontSize: '14px',
                color: '#172b4d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ebecf0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42526e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>My Profile</span>
            </button>
          </div>

          <div style={{ height: '1px', backgroundColor: '#dfe1e6', margin: '4px 0' }} />

          {/* Sign Out */}
          <div style={{ padding: '4px 0' }}>
            <button
              type="button"
              data-testid="dropdown-logout-btn"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                fontSize: '14px',
                color: '#de350b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffebe6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#de350b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
