'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check if user is already authenticated
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (res.ok && isMounted) {
          router.push('/');
          return;
        }
      } catch {
        // Continue to show login form
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handlePasswordLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Invalid email or password.');
      }

      // Successful login -> navigate to home workspace
      window.location.href = '/';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsSubmitting(false);
    }
  };

  const handleGitHubAuth = (): void => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

  const handleGitLabAuth = (): void => {
    window.location.href = `${API_BASE_URL}/auth/gitlab/login`;
  };

  if (isCheckingSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f4f5f7',
          color: '#6b778c',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <p>Checking session...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f4f5f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <span
            style={{
              backgroundColor: '#0052cc',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontWeight: 800,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
            }}
          >
            RD
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#172b4d' }}>RepoDoctor</span>
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#172b4d', margin: 0 }}>
          Sign in to your account
        </h1>
        <p style={{ color: '#6b778c', fontSize: '0.9rem', marginTop: '0.35rem' }}>
          Principal Software Architecture Intelligence
        </p>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px 1px rgba(9, 30, 66, 0.13)',
          padding: '2rem',
        }}
        data-testid="login-card"
      >
        {error && (
          <div
            data-testid="login-error"
            style={{
              backgroundColor: '#ffebe6',
              border: '1px solid #ffbdad',
              color: '#de350b',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* GitHub OAuth Primary Action */}
        <button
          type="button"
          data-testid="github-login-btn"
          onClick={handleGitHubAuth}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            padding: '0.65rem 1rem',
            backgroundColor: '#172b4d',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#091e42')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#172b4d')}
        >
          <span>Continue with GitHub</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#dfe1e6' }} />
          <span style={{ color: '#6b778c', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            or with email
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#dfe1e6' }} />
        </div>

        <form onSubmit={(e) => void handlePasswordLogin(e)} data-testid="login-form">
          <div style={{ marginBottom: '1.1rem' }}>
            <label
              htmlFor="login-email"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#172b4d', marginBottom: '0.35rem' }}
            >
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              data-testid="login-email-input"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                border: '2px solid #dfe1e6',
                borderRadius: '4px',
                fontSize: '0.95rem',
                color: '#172b4d',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="login-password"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#172b4d', marginBottom: '0.35rem' }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              data-testid="login-password-input"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                border: '2px solid #dfe1e6',
                borderRadius: '4px',
                fontSize: '0.95rem',
                color: '#172b4d',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.7rem 1rem',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'background-color 0.15s ease',
            }}
            onMouseOver={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#0065ff'; }}
            onMouseOut={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#0052cc'; }}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: '#6b778c' }}>Don&apos;t have an account? </span>
          <Link
            href="/signup"
            data-testid="link-to-signup"
            style={{ color: '#0052cc', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign up
          </Link>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Link
          href="/"
          style={{ color: '#6b778c', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}
        >
          ← Back to RepoDoctor
        </Link>
      </div>
    </div>
  );
}
