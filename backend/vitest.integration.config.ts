/**
 * Vitest configuration for graph-engine integration tests.
 *
 * WHY dist/ instead of src/:
 *   Vitest uses esbuild for its transform pipeline, which does NOT support
 *   TypeScript's `emitDecoratorMetadata: true` option. TypeORM requires that
 *   metadata for decorator-based column type inference.
 *
 *   `tsc --build` already compiles all sources (including this spec file) to
 *   dist/ with full decorator metadata. Running tests against the compiled JS
 *   avoids the esbuild limitation without adding new dependencies
 *   (@swc/core, unplugin-swc, etc.).
 *
 *   The trade-off: you must run `pnpm run build` before `test:integration`.
 *   The `test:integration` script in package.json handles this automatically.
 *
 * Usage:
 *   pnpm --filter @repo-doctor/api test:integration
 *
 * Prerequisites:
 *   docker compose up -d postgres   (postgres must be healthy before running)
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    // Point at compiled JS — tsc emits decorator metadata; esbuild does not.
    include: ['dist/graph-engine/__tests__/*.integration.spec.js'],
    // Explicitly override the global 'dist/**' exclusion.
    exclude: ['**/node_modules/**'],
    // Integration tests hit a real DB; allow up to 60 s per test.
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Run serially — parallel execution against a shared DB causes FK conflicts.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
