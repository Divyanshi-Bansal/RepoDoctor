'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { UserDto } from '@repo-doctor/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getCsrfTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : '';
}

export default function ProfilePage(): React.JSX.Element {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as UserDto;
        setUser(data);
      } else {
        // Fallback to /auth/me
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (meRes.ok) {
          const meData = (await meRes.json()) as any;
          setUser({
            id: meData.id,
            email: meData.email || '',
            name: meData.name || meData.username || '',
            githubUsername: meData.githubUsername || null,
            gitlabUsername: meData.gitlabUsername || null,
            createdAt: meData.createdAt || new Date().toISOString(),
          });
        } else {
          // Unauthenticated -> redirect to login
          window.location.href = '/login';
        }
      }
    } catch {
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleGitHubConnect = (): void => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

  const handleGitLabConnect = (): void => {
    window.location.href = `${API_BASE_URL}/auth/gitlab/login`;
  };

  const handleLogout = async (): Promise<void> => {
    try {
      const csrfToken = getCsrfTokenFromCookie();
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
    } finally {
      window.location.href = '/';
    }
  };

  if (isLoading) {
    return (
      <div className="portal-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card-section" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading user profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="portal-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card-section" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active Session';

  return (
    <div className="portal-container" data-testid="profile-page-container">
      {/* Top Navigation */}
      <header className="portal-header">
        <div className="portal-header-main">
          <div className="header-left">
            <Link href="/" className="header-brand">
              <div className="brand-icon">R</div>
              <span className="brand-title">RepoDoctor</span>
            </Link>
          </div>

          <div>
            <Link href="/" className="secondary-btn" style={{ textDecoration: 'none' }}>
              <span>← Back to Overview</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Profile Content */}
      <main className="portal-content" style={{ maxWidth: '840px', padding: '2.5rem 1.5rem' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
            }}
          >
            My Profile
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.35rem' }}>
            Manage your personal credentials, identity, and connected code hosting providers.
          </p>
        </div>

        {/* Section 1: Personal Information */}
        <section className="card-section" data-testid="personal-info-section">
          <h2 className="section-title">Personal Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Full Name
              </label>
              <input
                type="text"
                className="select-input"
                style={{ width: '100%', backgroundColor: '#f8fafc', cursor: 'default' }}
                value={user.name || 'Not provided'}
                readOnly
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                className="select-input"
                style={{ width: '100%', backgroundColor: '#f8fafc', cursor: 'default' }}
                value={user.email || 'Not provided'}
                readOnly
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Account Created
              </label>
              <input
                type="text"
                className="select-input"
                style={{ width: '100%', backgroundColor: '#f8fafc', cursor: 'default' }}
                value={formattedDate}
                readOnly
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                User Identifier
              </label>
              <input
                type="text"
                className="select-input"
                style={{ width: '100%', backgroundColor: '#f8fafc', cursor: 'default', fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={user.id}
                readOnly
              />
            </div>
          </div>
        </section>

        {/* Section 2: Connected Code Hosting Providers */}
        <section className="card-section" data-testid="connected-providers-section">
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>
              Connected Code Providers
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Connecting a code provider enables RepoDoctor to discover and inspect repositories you have permission to access.
              Provider tokens remain securely stored on the server and are never exposed to client-side code.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* GitHub Provider Card */}
            <div
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                backgroundColor: user.githubUsername ? 'var(--accent-green-subtle)' : '#ffffff',
              }}
              data-testid="github-provider-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    backgroundColor: '#24292f',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    fontWeight: 800,
                  }}
                >
                  GH
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      GitHub
                    </h3>
                    {user.githubUsername ? (
                      <span className="badge-success">Connected</span>
                    ) : (
                      <span className="badge-warning">Disconnected</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {user.githubUsername ? (
                      <>
                        Connected as <strong style={{ color: 'var(--text-primary)' }}>@{user.githubUsername}</strong>
                      </>
                    ) : (
                      'Authorize GitHub to discover your repositories and run AST architecture analysis.'
                    )}
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className={user.githubUsername ? 'secondary-btn' : 'primary-btn'}
                  data-testid="profile-connect-github-btn"
                  onClick={handleGitHubConnect}
                >
                  {user.githubUsername ? 'Reconnect GitHub' : 'Connect GitHub'}
                </button>
              </div>
            </div>

            {/* GitLab Provider Card */}
            <div
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                backgroundColor: user.gitlabUsername ? 'var(--accent-purple-subtle)' : '#ffffff',
              }}
              data-testid="gitlab-provider-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    backgroundColor: '#e24329',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    fontWeight: 800,
                  }}
                >
                  GL
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      GitLab
                    </h3>
                    {user.gitlabUsername ? (
                      <span className="badge-info">Connected</span>
                    ) : (
                      <span className="badge-warning">Disconnected</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {user.gitlabUsername ? (
                      <>
                        Connected as <strong style={{ color: 'var(--text-primary)' }}>@{user.gitlabUsername}</strong>
                      </>
                    ) : (
                      'Authorize GitLab to discover and index your GitLab hosted projects.'
                    )}
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className={user.gitlabUsername ? 'secondary-btn' : 'primary-btn'}
                  data-testid="profile-connect-gitlab-btn"
                  onClick={handleGitLabConnect}
                >
                  {user.gitlabUsername ? 'Reconnect GitLab' : 'Connect GitLab'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Session & Security */}
        <section className="card-section" data-testid="session-section">
          <h2 className="section-title">Session &amp; Security</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Sessions are protected by HttpOnly cryptographic session cookies with Double Submit CSRF protection.
            Signing out will invalidate your session on the server and remove cookies from your browser.
          </p>

          <button
            type="button"
            className="secondary-btn"
            data-testid="profile-sign-out-btn"
            onClick={() => void handleLogout()}
            style={{ color: 'var(--accent-red)', borderColor: '#fecaca' }}
          >
            <span>🚪</span>
            <span>Sign Out from RepoDoctor</span>
          </button>
        </section>
      </main>
    </div>
  );
}
