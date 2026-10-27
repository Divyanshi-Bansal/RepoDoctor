import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

interface StoredState {
  readonly state: string;
  readonly expiresAt: number;
}

@Injectable()
export class GitLabOAuthService {
  private readonly logger = new Logger(GitLabOAuthService.name);
  private readonly states = new Map<string, StoredState>();
  private readonly stateTtlMs = 10 * 60 * 1000; // 10 minutes

  get clientId(): string {
    const raw = process.env['GITLAB_CLIENT_ID'] || process.env['GITLAB_APP_CLIENT_ID'] || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  get clientSecret(): string {
    const raw = process.env['GITLAB_CLIENT_SECRET'] || process.env['GITLAB_APP_CLIENT_SECRET'] || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  get redirectUri(): string {
    const baseUrl = process.env['BASE_URL'] || 'http://localhost:3001';
    return process.env['GITLAB_OAUTH_REDIRECT_URI'] || `${baseUrl}/auth/gitlab/callback`;
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  generateState(): string {
    this.evictExpiredStates();
    const state = randomBytes(32).toString('hex');
    this.states.set(state, {
      state,
      expiresAt: Date.now() + this.stateTtlMs,
    });
    return state;
  }

  validateAndConsumeState(state: string | undefined): boolean {
    if (!state) return false;
    const record = this.states.get(state);
    if (!record) return false;

    this.states.delete(state);
    return Date.now() <= record.expiresAt;
  }

  getAuthorizationUrl(state: string): string {
    if (!this.clientId) {
      throw new InternalServerErrorException('GITLAB_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      scope: 'read_user read_api read_repository',
    });
    return `https://gitlab.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new InternalServerErrorException('GitLab OAuth credentials are not configured');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      this.logger.error(`GitLab token exchange failed (HTTP ${response.status}): ${errText}`);
      throw new UnauthorizedException('Failed to exchange authorization code with GitLab');
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      throw new UnauthorizedException(data.error || 'No access token received from GitLab');
    }

    return data.access_token;
  }

  async fetchGitLabUser(accessToken: string): Promise<GitLabUser> {
    const response = await fetch('https://gitlab.com/api/v4/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch user identity from GitLab');
    }

    return (await response.json()) as GitLabUser;
  }

  private evictExpiredStates(): void {
    const now = Date.now();
    for (const [state, record] of this.states) {
      if (now > record.expiresAt) {
        this.states.delete(state);
      }
    }
  }
}
