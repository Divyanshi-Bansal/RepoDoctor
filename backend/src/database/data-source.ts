/**
 * TypeORM DataSource configuration.
 *
 * Dual-purpose:
 *  1. Runtime import: used by DatabaseModule (TypeOrmModule.forRootAsync) and
 *     integration tests to obtain a live DataSource.
 *  2. CLI reference: the `typeorm` CLI `--dataSource` flag points at this file
 *     compiled to `dist/database/data-source.js` for migration:generate / migration:run.
 *
 * Environment variables (all required in non-test environments):
 *   DB_HOST       — PostgreSQL host          (default: localhost)
 *   DB_PORT       — PostgreSQL port          (default: 5432)
 *   DB_USER       — PostgreSQL username      (default: repodoctor)
 *   DB_PASSWORD   — PostgreSQL password      (default: repodoctor_dev)
 *   DB_NAME       — PostgreSQL database name (default: repodoctor)
 *
 * Security: Connection credentials are read from environment variables —
 * never from hardcoded literals in source code (Level 1 security rule).
 * The defaults here are ONLY for local Docker Compose development.
 */
import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';

/**
 * Loads .env environment variables using Node's built-in process.loadEnvFile.
 * Resolves both when running from workspace root or backend directory.
 */
function loadEnvironment(): void {
  if (typeof process.loadEnvFile !== 'function') return;
  const candidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
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
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';
import { SystemNodeEntity } from '../graph-engine/entities/system-node.entity.js';
import { SystemEdgeEntity } from '../graph-engine/entities/system-edge.entity.js';
import { EvidenceEntity } from '../graph-engine/entities/evidence.entity.js';
import { CodeEmbeddingEntity } from '../graph-engine/entities/code-embedding.entity.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { ProjectEntity } from '../graph-engine/entities/project.entity.js';

/** All TypeORM entities registered in the application. */
export const GRAPH_ENGINE_ENTITIES = [
  RepositoryEntity,
  SystemNodeEntity,
  SystemEdgeEntity,
  EvidenceEntity,
  CodeEmbeddingEntity,
  UserEntity,
  ProjectEntity,
];

/** Build a strongly-typed Postgres DataSourceOptions from environment variables.
 * Accepts partial overrides for tests (e.g. migrationsRun, logging).
 * Supports both individual DB_* parameters and a complete DATABASE_URL (e.g. Neon, Supabase).
 */
export function buildDataSourceOptions(
  overrides: Partial<PostgresConnectionOptions> = {},
): PostgresConnectionOptions {
  const databaseUrl = process.env['DATABASE_URL'];
  const isNeonOrSsl = Boolean(
    databaseUrl?.includes('sslmode=require') ||
    databaseUrl?.includes('neon.tech') ||
    databaseUrl?.includes('render.com') ||
    databaseUrl?.includes('dpg-') ||
    process.env['DB_SSL'] === 'true',
  );

  const baseOptions: PostgresConnectionOptions = databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        ssl: isNeonOrSsl ? { rejectUnauthorized: false } : false,
        entities: GRAPH_ENGINE_ENTITIES,
        migrations: ['dist/migrations/*.js'],
        migrationsTableName: 'typeorm_migrations',
        synchronize: false,
        logging: process.env['DB_LOGGING'] === 'true',
      }
    : {
        type: 'postgres',
        host: process.env['DB_HOST'] ?? 'localhost',
        port: Number(process.env['DB_PORT'] ?? 5432),
        username: process.env['DB_USER'] ?? 'repodoctor',
        password: process.env['DB_PASSWORD'] ?? 'repodoctor_dev',
        database: process.env['DB_NAME'] ?? 'repodoctor',
        ssl: isNeonOrSsl ? { rejectUnauthorized: false } : false,
        entities: GRAPH_ENGINE_ENTITIES,
        migrations: ['dist/migrations/*.js'],
        migrationsTableName: 'typeorm_migrations',
        synchronize: false,
        logging: process.env['DB_LOGGING'] === 'true',
      };

  return {
    ...baseOptions,
    ...overrides,
  };
}

/**
 * Singleton DataSource used by the TypeORM CLI (migration:generate, migration:run).
 * Must be the default export for `typeorm` CLI discovery.
 */
const AppDataSource = new DataSource(buildDataSourceOptions());
export default AppDataSource;
