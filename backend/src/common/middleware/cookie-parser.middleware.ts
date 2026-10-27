import type { Request, Response, NextFunction } from 'express';

export interface RequestWithCookies extends Request {
  cookies: Record<string, string>;
}

/**
 * Lightweight, zero-dependency cookie parser middleware for Express.
 * Parses the raw `Cookie` header and populates `req.cookies`.
 */
export function cookieParserMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie;

  if (header) {
    const parts = header.split(';');
    for (const part of parts) {
      const equalIndex = part.indexOf('=');
      if (equalIndex > 0) {
        const key = part.slice(0, equalIndex).trim();
        const value = part.slice(equalIndex + 1).trim();
        try {
          cookies[key] = decodeURIComponent(value);
        } catch {
          cookies[key] = value;
        }
      }
    }
  }

  (req as RequestWithCookies).cookies = cookies;
  next();
}
