import * as path from 'path';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { cookieParserMiddleware } from './common/middleware/cookie-parser.middleware.js';

function loadEnvironment(): void {
  if (typeof process.loadEnvFile !== 'function') return;
  // Resolve both package-level and root-level .env files without early termination
  const candidates = [
    // Backend package directory candidates (highest priority for backend settings)
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    // Monorepo root directory candidates (fallback for shared settings)
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  const uniqueFiles = Array.from(new Set(candidates.map((p) => path.normalize(p))));
  for (const file of uniqueFiles) {
    if (fs.existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        // Continue loading remaining candidates
      }
    }
  }
}

loadEnvironment();

function validateEnvironment(): void {
  const logger = new Logger('EnvironmentValidator');
  const clientId = process.env['GITHUB_APP_CLIENT_ID'] || process.env['GITHUB_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_APP_CLIENT_SECRET'] || process.env['GITHUB_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    logger.warn(
      'GITHUB_APP_CLIENT_ID or GITHUB_APP_CLIENT_SECRET is not configured. GitHub OAuth features will be disabled until credentials are provided in environment variables.',
    );
  }

  logger.log('Startup environment validation complete.');
}

async function bootstrap(): Promise<void> {
  validateEnvironment();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParserMiddleware);

  const rawOrigins =
    process.env['TRUSTED_ORIGINS'] ||
    'http://localhost:3000,http://127.0.0.1:3000';
  const trustedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env['FRONTEND_URL']) {
    const feUrl = process.env['FRONTEND_URL'].trim();
    if (!trustedOrigins.includes(feUrl)) {
      trustedOrigins.push(feUrl);
    }
  }

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (
        trustedOrigins.includes(requestOrigin) ||
        requestOrigin.endsWith('.vercel.app') ||
        requestOrigin.includes('localhost') ||
        requestOrigin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token'],
  });

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;
  await app.listen(port);
  new Logger('Bootstrap').log(`RepoDoctor API listening on port ${port}`);
}

process.on('unhandledRejection', (reason) => {
  new Logger('Process').error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (err: any) => {
  new Logger('Process').error(`Uncaught Exception: ${err?.message || err}`);
});

void bootstrap();
