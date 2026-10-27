'use client';

import React from 'react';
import type { RepositoryDto } from '@repo-doctor/shared';
import { UserDropdown } from './UserDropdown';

export type ActiveTab = 'dashboard' | 'features' | 'architecture';

export interface AuthUserInfo {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly email?: string;
  readonly createdAt?: string;
  readonly authProvider?: string;
  readonly githubUsername?: string | null;
  readonly gitlabUsername?: string | null;
}

interface HeaderProps {
  readonly repositories: readonly RepositoryDto[];
  readonly selectedRepoId: string;
  readonly onSelectRepo: (id: string) => void;
  readonly onOpenRepoModal?: () => void;
  readonly selectedProjectName?: string;
  readonly projectRepoCount?: number;
  readonly user: AuthUserInfo | null;
  readonly onLogin: () => void;
  readonly onLogout: () => void;
  readonly onNavigateProfile?: () => void;
  readonly onConnectGitHub?: () => void;
  readonly onConnectGitLab?: () => void;
  readonly activeTab: ActiveTab;
  readonly onSelectTab: (tab: ActiveTab) => void;
  readonly onOpenAskDrawer?: () => void;
  readonly hasProject?: boolean;
}

export function Header({
  repositories,
  selectedRepoId,
  onSelectRepo,
  onOpenRepoModal,
  selectedProjectName,
  projectRepoCount,
  user,
  onLogin,
  onLogout,
  onNavigateProfile,
  onConnectGitHub,
  onConnectGitLab,
  activeTab,
  onSelectTab,
  onOpenAskDrawer,
  hasProject,
}: HeaderProps): React.JSX.Element {
  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

  return (
    <header className="portal-header" data-testid="portal-header">
      <div className="portal-header-main">
        {/* Left: Brand Logo & Primary Tabs */}
        <div className="header-left">
          <div className="header-brand">
            <div className="brand-icon">R</div>
            <div>
              <span className="brand-title">RepoDoctor</span>
            </div>
            <span className="brand-badge" data-testid="portal-status-badge">
              v0.1.0
            </span>
          </div>

          {/* Primary Navigation Destinations */}
          <nav className="portal-tabs" data-testid="portal-navigation" aria-label="Main Navigation">
            <button
              type="button"
              data-testid="tab-dashboard"
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab('dashboard')}
            >
              <span>📊</span>
              <span>Overview</span>
            </button>
            <button
              type="button"
              data-testid="tab-features"
              className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
              onClick={() => onSelectTab('features')}
              disabled={!selectedRepoId && !hasProject}
              title={!selectedRepoId && !hasProject ? 'Select a repository or project to explore features' : undefined}
            >
              <span>✨</span>
              <span>Features</span>
            </button>
            <button
              type="button"
              data-testid="tab-architecture"
              className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
              onClick={() => onSelectTab('architecture')}
              disabled={!selectedRepoId && !hasProject}
              title={!selectedRepoId && !hasProject ? 'Select a repository or project to explore architecture' : undefined}
            >
              <span>🕸️</span>
              <span>Architecture</span>
            </button>
            {onOpenAskDrawer && (
              <button
                type="button"
                data-testid="tab-ask-doctor"
                className="tab-button"
                onClick={onOpenAskDrawer}
                style={{
                  color: 'var(--brand-primary, #2563eb)',
                  fontWeight: 600,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                }}
              >
                <span>💬</span>
                <span>Ask RepoDoctor</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right: Repository Context & User Profile Menu */}
        <div className="header-controls">
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {/* Repository Selector Button (opens repository picker modal) */}
              <button
                type="button"
                className="secondary-btn"
                data-testid="open-repo-modal-btn"
                onClick={onOpenRepoModal}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  maxWidth: '280px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>📁</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: selectedRepo ? 600 : 400,
                    color: selectedRepo ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {selectedRepo ? `${selectedRepo.githubOrg}/${selectedRepo.name}` : 'Select Repository'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>▾</span>
              </button>

              {/* Native select fallback for testing & accessibility */}
              <select
                id="repo-select"
                data-testid="repository-select"
                className="select-input"
                value={selectedRepoId}
                onChange={(e) => onSelectRepo(e.target.value)}
                style={{ display: 'none' }}
                aria-hidden="true"
              >
                {!user ? (
                  <option value="">Sign in to view repositories</option>
                ) : repositories.length === 0 ? (
                  <option value="">No Repositories Accessible</option>
                ) : (
                  repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.githubOrg}/{repo.name}
                    </option>
                  ))
                )}
              </select>

              {/* User Profile Avatar Dropdown */}
              <UserDropdown
                user={user}
                onLogout={onLogout}
                onNavigateProfile={onNavigateProfile || (() => { window.location.href = '/profile'; })}
                onConnectGitHub={onConnectGitHub}
                onConnectGitLab={onConnectGitLab}
              />
            </div>
          )}

          {!user && (
            <button
              type="button"
              className="primary-btn"
              data-testid="login-button"
              onClick={onLogin}
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.9rem' }}
            >
              Sign in with GitHub
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
