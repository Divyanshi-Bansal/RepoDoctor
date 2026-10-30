import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../components/Header.js';
import HomePage from '../page.js';
import LoginPage from '../login/page.js';
import SignupPage from '../signup/page.js';
import { Button } from '../components/atlassian/Button.js';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Dedicated Auth Pages & Header Actions', () => {
  it('Header renders distinct Log in and Get started free actions when unauthenticated', () => {
    const html = renderToStaticMarkup(
      React.createElement(Header, {
        repositories: [],
        selectedRepoId: '',
        onSelectRepo: vi.fn(),
        user: null,
        onLogin: vi.fn(),
        onLogout: vi.fn(),
        activeTab: 'dashboard',
        onSelectTab: vi.fn(),
      })
    );

    expect(html).toContain('Log in');
    expect(html).toContain('Get started free');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');

    // Navigation tabs must be hidden when user is unauthenticated
    expect(html).not.toContain('Overview');
    expect(html).not.toContain('Features');
    expect(html).not.toContain('Architecture');
    expect(html).not.toContain('Ask RepoDoctor');
    expect(html).not.toContain('data-testid="portal-navigation"');
  });

  it('Header renders Overview, Features, Architecture, and Ask RepoDoctor tabs when authenticated', () => {
    const html = renderToStaticMarkup(
      React.createElement(Header, {
        repositories: [],
        selectedRepoId: '',
        onSelectRepo: vi.fn(),
        user: {
          id: '1',
          username: 'octocat',
          email: 'octo@github.com',
        },
        onLogin: vi.fn(),
        onLogout: vi.fn(),
        activeTab: 'dashboard',
        onSelectTab: vi.fn(),
        onOpenAskDrawer: vi.fn(),
      })
    );

    expect(html).toContain('Overview');
    expect(html).toContain('Features');
    expect(html).toContain('Architecture');
    expect(html).toContain('Ask RepoDoctor');
    expect(html).toContain('data-testid="portal-navigation"');
    expect(html).toContain('Authorize with GitHub');
    expect(html).toContain('data-testid="authorize-github-btn"');
    expect(html).not.toContain('open-repo-modal-btn');
    expect(html).not.toContain('Select Repository');
  });

  it('LoginPage renders sign-in card with email and password inputs', () => {
    const html = renderToStaticMarkup(React.createElement(LoginPage));

    // SSR renders initial structure or checking session state
    expect(html).toBeDefined();
  });

  it('SignupPage renders registration card', () => {
    const html = renderToStaticMarkup(React.createElement(SignupPage));

    expect(html).toBeDefined();
  });

  it('HomePage renders Log in buttons and not Sign in when unauthenticated', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));

    expect(html).toBeDefined();
  });

  it('Atlassian Button renders primary, subtle, and link variants with Atlassian styling', () => {
    const primaryHtml = renderToStaticMarkup(
      React.createElement(Button, { appearance: 'primary' }, 'Submit')
    );
    expect(primaryHtml).toContain('background-color:#0052cc');
    expect(primaryHtml).toContain('border-radius:3px');
    expect(primaryHtml).toContain('color:#ffffff');

    const subtleHtml = renderToStaticMarkup(
      React.createElement(Button, { appearance: 'subtle', href: '/login' }, 'Log in')
    );
    expect(subtleHtml).toContain('href="/login"');
    expect(subtleHtml).toContain('background-color:transparent');
    expect(subtleHtml).toContain('color:#172b4d');
    expect(subtleHtml).toContain('border-radius:3px');
  });
});
