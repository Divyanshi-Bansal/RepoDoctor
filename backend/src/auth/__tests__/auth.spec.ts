import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GitHubOAuthService } from '../github-oauth.service.js';
import { SessionStore } from '../session.store.js';
import { SessionGuard } from '../session.guard.js';
import { CsrfGuard } from '../csrf.guard.js';
import { AuthController } from '../auth.controller.js';

describe('Milestone 1 — Authentication & Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'test-client-id',
      GITHUB_APP_CLIENT_SECRET: 'test-client-secret',
      BASE_URL: 'http://localhost:3001',
      FRONTEND_URL: 'http://localhost:3000',
      TRUSTED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
      SESSION_MAX_AGE: '3600',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ── 1. OAuth State & GitHubOAuthService ────────────────────────────────────
  describe('1. GitHubOAuthService', () => {
    it('generates a cryptographically random 32-byte hex state', () => {
      const service = new GitHubOAuthService();
      const state1 = service.generateState();
      const state2 = service.generateState();

      expect(state1).toHaveLength(64);
      expect(state2).toHaveLength(64);
      expect(state1).not.toBe(state2);
    });

    it('builds the correct GitHub authorization URL with required parameters', () => {
      const service = new GitHubOAuthService();
      const state = service.generateState();
      const url = service.getAuthorizationUrl(state);

      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://github.com');
      expect(parsed.pathname).toBe('/login/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3001/auth/callback');
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('scope')).toBe('read:user repo');
    });

    it('validates and immediately consumes state to prevent replay attacks', () => {
      const service = new GitHubOAuthService();
      const state = service.generateState();

      // First validation must succeed
      const validFirstTime = service.validateAndConsumeState(state);
      expect(validFirstTime).toBe(true);

      // Replay attempt must be rejected
      const replayed = service.validateAndConsumeState(state);
      expect(replayed).toBe(false);
    });

    it('rejects unknown or undefined states', () => {
      const service = new GitHubOAuthService();
      expect(service.validateAndConsumeState('unknown-state-value')).toBe(false);
      expect(service.validateAndConsumeState(undefined)).toBe(false);
    });

    it('exchanges code for access token using global fetch', async () => {
      const service = new GitHubOAuthService();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'ghu_mock_token_12345',
          token_type: 'bearer',
          scope: 'read:user,repo',
        }),
      } as any);

      const token = await service.exchangeCodeForToken('mock_auth_code');
      expect(token).toBe('ghu_mock_token_12345');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('rejects invalid code exchange if GitHub returns an error', async () => {
      const service = new GitHubOAuthService();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
        }),
      } as any);

      await expect(service.exchangeCodeForToken('bad_code')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('fetches GitHub user details correctly', async () => {
      const service = new GitHubOAuthService();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 123456,
          login: 'octocat',
          name: 'The Octocat',
        }),
      } as any);

      const user = await service.fetchGitHubUser('valid_token');
      expect(user.id).toBe(123456);
      expect(user.login).toBe('octocat');
    });
  });

  // ── 2. Server-side In-memory SessionStore ──────────────────────────────────
  describe('2. SessionStore', () => {
    it('creates an opaque 32-byte hex session ID and stores user details server-side', () => {
      const store = new SessionStore();
      const session = store.create({
        githubUserId: 999,
        githubUsername: 'alice',
        githubAccessToken: 'ghu_super_secret_token',
      });

      expect(session.id).toHaveLength(64);
      expect(session.csrfToken).toHaveLength(64);
      expect(session.githubUserId).toBe(999);
      expect(session.githubUsername).toBe('alice');
      expect(session.githubAccessToken).toBe('ghu_super_secret_token');

      // Verify retrieval
      const retrieved = store.get(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.githubUsername).toBe('alice');
    });

    it('expires sessions after max age', () => {
      process.env['SESSION_MAX_AGE'] = '1'; // 1 second
      const store = new SessionStore();
      const session = store.create({
        githubUserId: 100,
        githubUsername: 'bob',
        githubAccessToken: 'token',
      });

      expect(store.get(session.id)).toBeDefined();

      // Mock time advancing past expiration
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
      expect(store.get(session.id)).toBeUndefined();
    });

    it('deletes session upon logout', () => {
      const store = new SessionStore();
      const session = store.create({
        githubUserId: 101,
        githubUsername: 'charlie',
        githubAccessToken: 'token',
      });

      expect(store.delete(session.id)).toBe(true);
      expect(store.get(session.id)).toBeUndefined();
    });
  });

  // ── 3. SessionGuard ────────────────────────────────────────────────────────
  describe('3. SessionGuard & x-user-id Removal', () => {
    function createMockContext(headers: Record<string, string>, cookies: Record<string, string>) {
      const req: any = {
        headers,
        cookies,
        user: undefined,
      };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;
    }

    it('rejects unauthenticated requests missing session cookie', () => {
      const store = new SessionStore();
      const guard = new SessionGuard(store);
      const ctx = createMockContext({}, {});

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('strictly rejects requests that supply an x-user-id header without a valid session', () => {
      const store = new SessionStore();
      const guard = new SessionGuard(store);

      // Attempting to bypass auth with x-user-id header
      const ctx = createMockContext({ 'x-user-id': 'dev-user' }, {});

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('rejects requests with invalid or expired session ID in cookie', () => {
      const store = new SessionStore();
      const guard = new SessionGuard(store);
      const ctx = createMockContext({}, { session: 'invalid_or_expired_session_id' });

      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('authenticates valid session and attaches user without exposing access token to client', () => {
      const store = new SessionStore();
      const session = store.create({
        githubUserId: 42,
        githubUsername: 'dave',
        githubAccessToken: 'ghu_secret_token_never_sent_to_browser',
      });

      const guard = new SessionGuard(store);
      const ctx = createMockContext({}, { session: session.id });

      const allowed = guard.canActivate(ctx);
      expect(allowed).toBe(true);

      const req = ctx.switchToHttp().getRequest() as any;
      expect(req.user).toEqual({
        id: '42',
        username: 'dave',
      });
      // The session is attached internally on req for server-side services
      expect(req.session.githubAccessToken).toBe('ghu_secret_token_never_sent_to_browser');
    });
  });

  // ── 4. CsrfGuard ───────────────────────────────────────────────────────────
  describe('4. CsrfGuard & Origin Validation', () => {
    function createMockContext(
      method: string,
      headers: Record<string, string>,
      cookies: Record<string, string>,
    ) {
      const req: any = {
        method,
        headers,
        cookies,
      };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;
    }

    it('allows safe methods (GET, HEAD, OPTIONS) without CSRF headers', () => {
      const guard = new CsrfGuard();
      const ctxGet = createMockContext('GET', {}, {});
      const ctxOptions = createMockContext('OPTIONS', {}, {});

      expect(guard.canActivate(ctxGet)).toBe(true);
      expect(guard.canActivate(ctxOptions)).toBe(true);
    });

    it('rejects state-changing requests (POST) from untrusted origins', () => {
      const guard = new CsrfGuard();
      const ctx = createMockContext(
        'POST',
        { origin: 'https://evil-attacker.com' },
        { csrf_token: 'valid_token' },
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects state-changing requests missing X-CSRF-Token header', () => {
      const guard = new CsrfGuard();
      const ctx = createMockContext(
        'POST',
        { origin: 'http://localhost:3000' },
        { csrf_token: 'valid_token' },
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects state-changing requests missing csrf_token cookie', () => {
      const guard = new CsrfGuard();
      const ctx = createMockContext(
        'POST',
        { origin: 'http://localhost:3000', 'x-csrf-token': 'token123' },
        {},
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects token mismatch between header and cookie', () => {
      const guard = new CsrfGuard();
      const ctx = createMockContext(
        'POST',
        { origin: 'http://localhost:3000', 'x-csrf-token': 'tokenA' },
        { csrf_token: 'tokenB' },
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('allows state-changing request when origin is trusted and header matches cookie', () => {
      const guard = new CsrfGuard();
      const ctx = createMockContext(
        'POST',
        { origin: 'http://localhost:3000', 'x-csrf-token': 'correct_token' },
        { csrf_token: 'correct_token' },
      );

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // ── 5. AuthController Flow ────────────────────────────────────────────────
  describe('5. AuthController endpoints', () => {
    it('login sets oauth_state cookie (HttpOnly) and redirects to GitHub', () => {
      const oauthService = new GitHubOAuthService();
      const sessionStore = new SessionStore();
      const controller = new AuthController(oauthService, sessionStore);

      const cookiesSet: Record<string, { val: string; opts: any }> = {};
      const res: any = {
        cookie: (name: string, val: string, opts: any) => {
          cookiesSet[name] = { val, opts };
        },
        redirect: vi.fn(),
      };

      controller.login(res);

      expect(cookiesSet['oauth_state']).toBeDefined();
      expect(cookiesSet['oauth_state'].opts.httpOnly).toBe(true);
      expect(cookiesSet['oauth_state'].opts.sameSite).toBe('lax');
      expect(cookiesSet['oauth_state'].opts.path).toBe('/auth');
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/login/oauth/authorize'),
      );
    });

    it('callback rejects state mismatch or missing state and clears oauth_state cookie', async () => {
      const oauthService = new GitHubOAuthService();
      const sessionStore = new SessionStore();
      const controller = new AuthController(oauthService, sessionStore);

      const cookiesCleared: string[] = [];
      const res: any = {
        clearCookie: (name: string) => cookiesCleared.push(name),
        cookie: vi.fn(),
        redirect: vi.fn(),
      };

      const req: any = {
        cookies: { oauth_state: 'state_in_cookie' },
      };

      // Mismatch
      await expect(
        controller.callback('code123', 'wrong_state', req, res),
      ).rejects.toThrow(BadRequestException);

      expect(cookiesCleared).toContain('oauth_state');
    });

    it('callback creates session and sets HttpOnly session cookie and readable csrf cookie', async () => {
      const oauthService = new GitHubOAuthService();
      const sessionStore = new SessionStore();
      const controller = new AuthController(oauthService, sessionStore);

      const state = oauthService.generateState();

      vi.spyOn(oauthService, 'exchangeCodeForToken').mockResolvedValue('mock_access_token');
      vi.spyOn(oauthService, 'fetchGitHubUser').mockResolvedValue({
        id: 777,
        login: 'github_coder',
      });

      const cookiesSet: Record<string, { val: string; opts: any }> = {};
      const cookiesCleared: string[] = [];
      const res: any = {
        clearCookie: (name: string) => cookiesCleared.push(name),
        cookie: (name: string, val: string, opts: any) => {
          cookiesSet[name] = { val, opts };
        },
        redirect: vi.fn(),
      };

      const req: any = {
        cookies: { oauth_state: state },
      };

      await controller.callback('valid_code', state, req, res);

      // Verify oauth_state cookie cleared
      expect(cookiesCleared).toContain('oauth_state');

      // Verify session cookie: HttpOnly = true, SameSite = lax, Path = /
      expect(cookiesSet['session']).toBeDefined();
      expect(cookiesSet['session'].opts.httpOnly).toBe(true);
      expect(cookiesSet['session'].opts.sameSite).toBe('lax');
      expect(cookiesSet['session'].opts.path).toBe('/');

      // Verify csrf_token cookie: HttpOnly = false (accessible by frontend JS)
      expect(cookiesSet['csrf_token']).toBeDefined();
      expect(cookiesSet['csrf_token'].opts.httpOnly).toBe(false);
      expect(cookiesSet['csrf_token'].opts.sameSite).toBe('lax');
      expect(cookiesSet['csrf_token'].opts.path).toBe('/');

      // Verify redirect to frontend
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000');

      // Verify access token is NEVER present in cookie values
      expect(cookiesSet['session'].val).not.toContain('mock_access_token');
      expect(cookiesSet['csrf_token'].val).not.toContain('mock_access_token');
    });

    it('getMe returns user identity without token', () => {
      const oauthService = new GitHubOAuthService();
      const sessionStore = new SessionStore();
      const controller = new AuthController(oauthService, sessionStore);

      const req: any = {
        user: { id: '777', username: 'github_coder' },
        session: { githubAccessToken: 'sensitive_token' },
      };

      const me = controller.getMe(req);
      expect(me).toEqual({ id: '777', username: 'github_coder' });
      expect((me as any).githubAccessToken).toBeUndefined();
    });

    it('logout deletes session from store and clears both cookies', () => {
      const oauthService = new GitHubOAuthService();
      const sessionStore = new SessionStore();
      const session = sessionStore.create({
        githubUserId: 123,
        githubUsername: 'user1',
        githubAccessToken: 'token',
      });

      const controller = new AuthController(oauthService, sessionStore);

      const cookiesCleared: string[] = [];
      const res: any = {
        clearCookie: (name: string) => cookiesCleared.push(name),
        json: vi.fn(),
      };

      const req: any = {
        cookies: { session: session.id },
      };

      controller.logout(req, res);

      expect(sessionStore.get(session.id)).toBeUndefined();
      expect(cookiesCleared).toContain('session');
      expect(cookiesCleared).toContain('csrf_token');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
