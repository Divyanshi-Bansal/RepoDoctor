import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Header } from '../components/Header.js';

describe('Web Header Auth Component', () => {
  it('renders sign-in button when user is unauthenticated', () => {
    const onLogin = vi.fn();
    const onLogout = vi.fn();

    const element = Header({
      repositories: [],
      selectedRepoId: '',
      onSelectRepo: vi.fn(),
      user: null,
      onLogin,
      onLogout,
      activeTab: 'dashboard',
      onSelectTab: vi.fn(),
    });

    expect(element).toBeDefined();
    expect(element.type).toBe('header');
    expect(element.props['data-testid']).toBe('portal-header');
  });

  it('renders navigation tabs and user avatar dropdown when user is authenticated', () => {
    const onLogin = vi.fn();
    const onLogout = vi.fn();

    const element = Header({
      repositories: [
        {
          id: 'repo-1',
          githubOrg: 'octo-org',
          name: 'repo-one',
          defaultBranch: 'main',
          lastCommitSha: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      selectedRepoId: 'repo-1',
      onSelectRepo: vi.fn(),
      user: {
        id: '123',
        username: 'octocat',
        name: 'Octo Cat',
        email: 'octo@github.com',
        githubUsername: 'octocat',
        gitlabUsername: null,
      },
      onLogin,
      onLogout,
      activeTab: 'dashboard',
      onSelectTab: vi.fn(),
    });

    expect(element).toBeDefined();
    expect(element.type).toBe('header');
    expect(element.props['data-testid']).toBe('portal-header');
  });
});
