import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

/**
 * Represents an authenticated user session stored server-side.
 *
 * The provider access tokens are NEVER exposed to the browser —
 * only the opaque session ID is sent as an HttpOnly cookie.
 */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly username: string;
  readonly authProvider: 'local' | 'github';
  readonly githubUserId?: number;
  readonly githubUsername?: string;
  readonly githubAccessToken?: string;
  readonly gitlabUsername?: string;
  readonly gitlabAccessToken?: string;
  readonly csrfToken: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface CreateSessionInput {
  userId?: string;
  email?: string;
  username?: string;
  authProvider?: 'local' | 'github';
  githubUserId?: number;
  githubUsername?: string;
  githubAccessToken?: string;
  gitlabUsername?: string;
  gitlabAccessToken?: string;
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly maxAgeMs: number;

  constructor() {
    const maxAgeSec = parseInt(process.env['SESSION_MAX_AGE'] ?? '28800', 10);
    this.maxAgeMs = maxAgeSec * 1000;
  }

  /**
   * Create a new session and return it. The session ID is a
   * cryptographically secure 32-byte hex string (256 bits of entropy).
   */
  create(data: CreateSessionInput): Session {
    this.evictExpired();
    const id = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const now = Date.now();

    const userId = data.userId || (data.githubUserId ? data.githubUserId.toString() : randomUUID());
    const username = data.username || data.githubUsername || 'User';
    const email = data.email || (data.githubUsername ? `${data.githubUsername.toLowerCase()}@github.local` : 'user@repodoctor.local');
    const authProvider = data.authProvider || (data.githubAccessToken ? 'github' : 'local');

    const session: Session = {
      id,
      userId,
      email,
      username,
      authProvider,
      githubUserId: data.githubUserId,
      githubUsername: data.githubUsername,
      githubAccessToken: data.githubAccessToken,
      gitlabUsername: data.gitlabUsername,
      gitlabAccessToken: data.gitlabAccessToken,
      csrfToken,
      createdAt: now,
      expiresAt: now + this.maxAgeMs,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Attaches GitHub credentials to an existing session.
   */
  linkGitHub(
    sessionId: string,
    github: { githubUserId: number; githubUsername: string; githubAccessToken: string },
  ): Session | undefined {
    const session = this.get(sessionId);
    if (!session) return undefined;

    const updated: Session = {
      ...session,
      githubUserId: github.githubUserId,
      githubUsername: github.githubUsername,
      githubAccessToken: github.githubAccessToken,
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /**
   * Attaches GitLab credentials to an existing session.
   */
  linkGitLab(
    sessionId: string,
    gitlab: { gitlabUsername: string; gitlabAccessToken: string },
  ): Session | undefined {
    const session = this.get(sessionId);
    if (!session) return undefined;

    const updated: Session = {
      ...session,
      gitlabUsername: gitlab.gitlabUsername,
      gitlabAccessToken: gitlab.gitlabAccessToken,
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /**
   * Retrieve a session by its ID. Returns undefined if the session
   * does not exist or has expired (lazy eviction).
   */
  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  /** Destroy a session (logout). Returns true if a session was deleted. */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /** Return the max-age in seconds (for Set-Cookie). */
  get maxAgeSeconds(): number {
    return Math.floor(this.maxAgeMs / 1000);
  }

  /** Remove all expired sessions. Called lazily during create(). */
  private evictExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }
}
