'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AuthUserInfo } from './Header';

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

  // Close when clicking outside
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
        className="avatar-btn"
        data-testid="user-avatar-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`Account: ${displayName}`}
      >
        <span>{initials}</span>
      </button>

      {isOpen && (
        <div
          className="user-dropdown-menu"
          role="menu"
          data-testid="user-dropdown-menu"
          aria-label="User account menu"
        >
          {/* User Identity Header */}
          <div className="dropdown-user-info">
            <div className="dropdown-user-name" data-testid="dropdown-user-name">
              {displayName}
            </div>
            {user.email && (
              <div className="dropdown-user-email" data-testid="dropdown-user-email">
                {user.email}
              </div>
            )}

            {/* Provider Status Indicators */}
            <div className="dropdown-status-row">
              <div className="dropdown-status-pill">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: user.githubUsername ? 'var(--accent-green)' : 'var(--border-muted)',
                  }}
                />
                <span>
                  GitHub:{' '}
                  {user.githubUsername ? (
                    <strong style={{ color: 'var(--text-primary)' }}>@{user.githubUsername}</strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Disconnected</span>
                  )}
                </span>
              </div>

              <div className="dropdown-status-pill">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: user.gitlabUsername ? 'var(--accent-purple)' : 'var(--border-muted)',
                  }}
                />
                <span>
                  GitLab:{' '}
                  {user.gitlabUsername ? (
                    <strong style={{ color: 'var(--text-primary)' }}>@{user.gitlabUsername}</strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Disconnected</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Provider Connect (if disconnected) */}
          {(!user.githubUsername || !user.gitlabUsername) && (
            <div style={{ padding: '0.4rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-default)' }}>
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
                    padding: '0.3rem 0',
                    fontSize: '0.825rem',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer',
                    fontWeight: 600,
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
                    padding: '0.3rem 0',
                    fontSize: '0.825rem',
                    color: 'var(--accent-purple)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  + Connect GitLab Account
                </button>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div className="dropdown-menu-list">
            <button
              type="button"
              className="dropdown-menu-item"
              data-testid="dropdown-profile-link"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onNavigateProfile();
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>👤</span>
              <span>My Profile</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          {/* Sign Out */}
          <div className="dropdown-menu-list">
            <button
              type="button"
              className="dropdown-menu-item logout"
              data-testid="dropdown-logout-btn"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
