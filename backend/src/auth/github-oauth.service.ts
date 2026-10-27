import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

interface StoredState {
  readonly state: string;
  readonly expiresAt: number;
}

@Injectable()
export class GitHubOAuthService {
  private readonly states = new Map<string, StoredState>();
  private readonly stateTtlMs = 10 * 60 * 1000; // 10 minutes

  get clientId(): string {
    const raw = process.env['GITHUB_APP_CLIENT_ID'] || process.env['GITHUB_CLIENT_ID'] || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  get clientSecret(): string {
    const raw = process.env['GITHUB_APP_CLIENT_SECRET'] || process.env['GITHUB_CLIENT_SECRET'] || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  get redirectUri(): string {
    const baseUrl = process.env['BASE_URL'] || 'http://localhost:3001';
    return process.env['GITHUB_OAUTH_REDIRECT_URI'] || `${baseUrl}/auth/callback`;
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generates a cryptographically random 32-byte hex state, stores it
   * with a 10-minute expiry for anti-replay, and returns it.
   */
  generateState(): string {
    this.evictExpiredStates();
    const state = randomBytes(32).toString('hex');
    this.states.set(state, {
      state,
      expiresAt: Date.now() + this.stateTtlMs,
    });
    return state;
  }

  /**
   * Validates and immediately consumes (deletes) the state to prevent replay attacks.
   * Returns true if the state was valid and unexpired; false otherwise.
   */
  validateAndConsumeState(state: string | undefined): boolean {
    if (!state) return false;
    const record = this.states.get(state);
    if (!record) return false;

    // Immediately remove from map to prevent replay
    this.states.delete(state);

    return Date.now() <= record.expiresAt;
  }

  /**
   * Builds the GitHub OAuth authorization URL with required scopes.
   */
  getAuthorizationUrl(state: string): string {
    if (!this.clientId) {
      throw new InternalServerErrorException('GITHUB_APP_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'read:user repo',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Server-side authorization code exchange using Node.js built-in fetch.
   * Returns the OAuth access token.
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new InternalServerErrorException('GitHub OAuth credentials are not configured');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'RepoDoctor-Auth',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `GitHub token exchange failed with HTTP status ${response.status}`,
      );
    }

    const data = (await response.json()) as GitHubAccessTokenResponse;
    if (data.error || !data.access_token) {
      throw new BadRequestException(
        data.error_description || data.error || 'Invalid authorization code or state',
      );
    }

    return data.access_token;
  }

  /**
   * Retrieves authenticated user details from GitHub API using the user access token.
   */
  async fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'RepoDoctor-Auth',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to fetch user from GitHub with status ${response.status}`,
      );
    }

    const user = (await response.json()) as GitHubUser;
    if (!user || typeof user.id !== 'number' || !user.login) {
      throw new InternalServerErrorException('Invalid user payload received from GitHub');
    }

    return user;
  }

  private evictExpiredStates(): void {
    const now = Date.now();
    for (const [key, record] of this.states) {
      if (now > record.expiresAt) {
        this.states.delete(key);
      }
    }
  }
}
