import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly trustedOrigins: Set<string>;

  constructor() {
    const rawOrigins =
      process.env['TRUSTED_ORIGINS'] ||
      'http://localhost:3000,http://127.0.0.1:3000';
    this.trustedOrigins = new Set(
      rawOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method?.toUpperCase();

    // Safe idempotent methods do not require CSRF token validation
    if (SAFE_METHODS.has(method)) {
      return true;
    }

    // Origin header validation when present
    const origin = request.headers['origin'] as string | undefined;
    if (origin) {
      if (!this.trustedOrigins.has(origin)) {
        throw new ForbiddenException(`Untrusted Origin: ${origin}`);
      }
    }

    // Double-submit cookie verification
    const headerToken = request.headers['x-csrf-token'];
    const cookieToken = (request as any).cookies?.csrf_token;

    if (!headerToken || typeof headerToken !== 'string') {
      throw new ForbiddenException('Missing X-CSRF-Token header');
    }

    if (!cookieToken || typeof cookieToken !== 'string') {
      throw new ForbiddenException('Missing csrf_token cookie');
    }

    if (headerToken !== cookieToken) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return true;
  }
}
