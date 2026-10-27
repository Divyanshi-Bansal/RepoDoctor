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
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'Missing required environment variables: GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET must be set in production.',
      );
    } else {
      logger.warn(
        'GITHUB_APP_CLIENT_ID or GITHUB_APP_CLIENT_SECRET is not configured. Real GitHub OAuth login will not succeed until these credentials are provided in .env.',
      );
    }
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

  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;
  await app.listen(port);
  new Logger('Bootstrap').log(`RepoDoctor API listening on port ${port}`);
}

void bootstrap();
