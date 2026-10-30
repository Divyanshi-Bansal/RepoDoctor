'use client';

import React from 'react';
import type { RepositoryDto } from '@repo-doctor/shared';
import { UserDropdown } from './UserDropdown';
import { Button } from './atlassian/Button';

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
          </div>

          {/* Primary Navigation Destinations (Only visible when user is authenticated) */}
          {user && (
            <nav
              className="portal-tabs"
              data-testid="portal-navigation"
              aria-label="Main Navigation"
            >
              <button
                type="button"
                data-testid="tab-dashboard"
                className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => onSelectTab('dashboard')}
              >
                <span>Overview</span>
              </button>
              <button
                type="button"
                data-testid="tab-features"
                className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
                onClick={() => onSelectTab('features')}
                disabled={!selectedRepoId && !hasProject}
                title={
                  !selectedRepoId && !hasProject
                    ? 'Select a repository or project to explore features'
                    : undefined
                }
              >
                <span>Features</span>
              </button>
              <button
                type="button"
                data-testid="tab-architecture"
                className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
                onClick={() => onSelectTab('architecture')}
                disabled={!selectedRepoId && !hasProject}
                title={
                  !selectedRepoId && !hasProject
                    ? 'Select a repository or project to explore architecture'
                    : undefined
                }
              >
                <span>Architecture</span>
              </button>
              {onOpenAskDrawer && (
                <button
                  type="button"
                  data-testid="tab-ask-doctor"
                  className="tab-button"
                  onClick={onOpenAskDrawer}
                >
                  <span>Ask RepoDoctor</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right: Repository Context & User Profile Menu */}
        <div className="header-controls">
          {user && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {/* Authorize with GitHub Button */}
              <Button
                appearance="default"
                data-testid="authorize-github-btn"
                onClick={
                  onConnectGitHub ||
                  (() => {
                    const apiUrl =
                      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                    window.location.href = `${apiUrl}/auth/login`;
                  })
                }
                title="Authorize with GitHub to choose repositories"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ marginRight: "6px" }}
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>Authorize with GitHub</span>
              </Button>

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
                onNavigateProfile={
                  onNavigateProfile ||
                  (() => {
                    window.location.href = '/profile';
                  })
                }
                onConnectGitHub={onConnectGitHub}
                onConnectGitLab={onConnectGitLab}
              />
            </div>
          )}

          {!user && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Button
                href="/login"
                appearance="subtle"
                data-testid="login-button"
              >
                Log in
              </Button>
              <Button
                href="/signup"
                appearance="primary"
                data-testid="signup-button"
              >
                Get started free
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
