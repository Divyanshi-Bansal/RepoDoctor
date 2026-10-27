import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionStore, type Session } from './session.store.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  name?: string;
  email?: string;
  authProvider?: 'local' | 'github';
  githubUsername?: string;
  gitlabUsername?: string;
}

export interface AuthenticatedSessionRequest extends Request {
  cookies: Record<string, string>;
  user: AuthenticatedUser;
  session: Session;
}

/**
 * Guard that verifies the opaque session ID stored in the HttpOnly `session` cookie
 * against the server-side in-memory SessionStore.
 *
 * Rejects requests without a valid session. Never uses or checks `x-user-id`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionStore: SessionStore) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedSessionRequest>();
    const sessionId = request.cookies?.session;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new UnauthorizedException('Missing or invalid session cookie');
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    request.user = {
      id: session.userId,
      username: session.username,
    };
    request.session = session;

    return true;
  }
}
