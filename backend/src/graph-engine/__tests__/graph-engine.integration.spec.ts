/**
 * Integration tests for graph-engine database persistence.
 *
 * Uses Node.js built-in `node:test` runner (Node 18+, stable in Node 24).
 * This avoids the ESM/CJS conflict with Vitest in a CommonJS-compiled package.
 *
 * Run via ts-node (which correctly emits decorator metadata from tsconfig.json):
 *   pnpm --filter @repo-doctor/api test:integration
 *
 * These tests validate four acceptance criteria from MODULE.md §6 and §7:
 *
 *  1. pgvector column — vector(1536) insert and SELECT roundtrip succeeds.
 *  2. Evidence constraint — violating chk_evidence_single_target raises
 *     PostgreSQL error code 23514.
 *  3. Transaction rollback — a failed edge insert (FK violation) rolls back
 *     the entire batch; no orphaned node rows remain.
 *  4. Embedding similarity — cosine distance query (<=> operator) returns
 *     results ordered by ascending distance from the query vector.
 *
 * Environment:
 *  Requires DB_* env vars or the docker-compose defaults:
 *    DB_HOST=localhost DB_PORT=5432 DB_USER=repodoctor
 *    DB_PASSWORD=repodoctor_dev DB_NAME=repodoctor
 */
import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import {
  buildDataSourceOptions,
  GRAPH_ENGINE_ENTITIES,
} from '../../database/data-source';
import { InitialSchema1729000000000 } from '../../migrations/1729000000000-InitialSchema';
import { RepositoryEntity } from '../entities/repository.entity';
import { SystemNodeEntity } from '../entities/system-node.entity';
import { SystemEdgeEntity } from '../entities/system-edge.entity';
import { EvidenceEntity } from '../entities/evidence.entity';
import { CodeEmbeddingEntity, EMBEDDING_DIMENSION } from '../entities/code-embedding.entity';
import { NodeType, EdgeType } from '../entities/graph.enums';

// ── Test DataSource ────────────────────────────────────────────────────────────

let ds: DataSource;

before(async () => {
  ds = new DataSource(
    buildDataSourceOptions({
      entities: GRAPH_ENGINE_ENTITIES,
      migrations: [InitialSchema1729000000000],
      migrationsRun: true, // Run pending migrations before tests start.
      logging: false,
    }),
  );
  await ds.initialize();
}, { timeout: 30_000 });

after(async () => {
  if (ds?.isInitialized) {
    await ds.destroy();
  }
});

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Create a minimal repository row and return its id. */
async function seedRepository(suffix: string): Promise<string> {
  const result = await ds.getRepository(RepositoryEntity).save({
    githubOrg: 'acme',
    name: `repo-${suffix}`,
    defaultBranch: 'main',
    lastCommitSha: null,
  });
  return result.id;
}

/** Create a minimal system_node row and return its id. */
async function seedNode(repositoryId: string, suffix: string): Promise<string> {
  const result = await ds.getRepository(SystemNodeEntity).save({
    repositoryId,
    nodeType: NodeType.SERVICE,
    identifier: `svc-${suffix}`,
    displayName: `Service ${suffix}`,
    metadata: {},
  });
  return result.id;
}

/**
 * Build a normalised float32 vector of `EMBEDDING_DIMENSION` dimensions.
 * The `seed` value shifts all components so different seeds produce
 * meaningfully distinct vectors for similarity ordering tests.
 */
function makeEmbedding(seed: number): number[] {
  const vec = Array.from({ length: EMBEDDING_DIMENSION }, (_, i) =>
    Math.sin(seed + i * 0.001),
  );
  // L2-normalise so cosine distance equals angular distance.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

// ── Test suite 1: pgvector column roundtrip ────────────────────────────────────

describe('pgvector column', () => {
  it('inserts and retrieves a vector(1536) embedding without data loss', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('vec-roundtrip');
    const nodeId = await seedNode(repoId, 'vec-roundtrip');

    const original = makeEmbedding(42);

    const saved = await ds.getRepository(CodeEmbeddingEntity).save({
      nodeId,
      contentChunk: 'function authenticate(token: string): boolean { ... }',
      embedding: original,
      metadata: { model_provider: 'openai', model_name: 'text-embedding-ada-002' },
    });

    const fetched = await ds
      .getRepository(CodeEmbeddingEntity)
      .findOneOrFail({ where: { id: saved.id } });

    assert.equal(fetched.embedding.length, EMBEDDING_DIMENSION);
    // Allow small float rounding from PostgreSQL serialisation (5 decimal places).
    fetched.embedding.forEach((v, i) => {
      assert.ok(
        Math.abs(v - original[i]!) < 1e-5,
        `embedding[${i}] expected ≈ ${original[i]!.toFixed(7)}, got ${v.toFixed(7)}`,
      );
    });

    // Cleanup
    await ds.getRepository(CodeEmbeddingEntity).delete(saved.id);
    await ds.getRepository(SystemNodeEntity).delete(nodeId);
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });
});

// ── Test suite 2: evidence check constraint ────────────────────────────────────

describe('evidence check constraint (chk_evidence_single_target)', () => {
  it('accepts evidence linked to a node only (node_id set, edge_id null)', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('ev-node');
    const nodeId = await seedNode(repoId, 'ev-node');

    const ev = await ds.getRepository(EvidenceEntity).save({
      repositoryId: repoId,
      nodeId,
      edgeId: null,
      filePath: 'docker-compose.yml',
      lineStart: 12,
      lineEnd: 28,
      codeSnippet: 'auth-service:',
      commitSha: 'abc1234',
    });

    const fetched = await ds.getRepository(EvidenceEntity).findOneOrFail({ where: { id: ev.id } });
    assert.equal(fetched.nodeId, nodeId);
    assert.equal(fetched.edgeId, null);

    // Cleanup
    await ds.getRepository(EvidenceEntity).delete(ev.id);
    await ds.getRepository(SystemNodeEntity).delete(nodeId);
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });

  it('rejects evidence with both node_id and edge_id set — PostgreSQL error 23514', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('ev-both');
    const nodeId = await seedNode(repoId, 'ev-both-src');
    const targetId = await seedNode(repoId, 'ev-both-tgt');

    const edge = await ds.getRepository(SystemEdgeEntity).save({
      sourceNodeId: nodeId,
      targetNodeId: targetId,
      edgeType: EdgeType.CALLS,
      confidence: 1.0,
      isInferred: false,
    });

    await assert.rejects(
      () => ds.getRepository(EvidenceEntity).save({
        repositoryId: repoId,
        nodeId,        // both set → violates constraint
        edgeId: edge.id,
        filePath: 'src/client.ts',
        lineStart: 1,
        lineEnd: 5,
        codeSnippet: 'callAuthService()',
        commitSha: 'abc1234',
      }),
      (err: unknown) => {
        assert.ok(
          typeof err === 'object' && err !== null && 'code' in err,
          'Expected a database error object with a code property',
        );
        assert.equal((err as { code: string }).code, '23514',
          `Expected PostgreSQL check constraint violation (23514), got: ${(err as { code?: string }).code}`);
        return true;
      },
    );

    // Cleanup
    await ds.getRepository(SystemEdgeEntity).delete(edge.id);
    await ds.getRepository(SystemNodeEntity).delete(nodeId);
    await ds.getRepository(SystemNodeEntity).delete(targetId);
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });

  it('rejects evidence with both node_id and edge_id null — PostgreSQL error 23514', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('ev-neither');

    await assert.rejects(
      () => ds.getRepository(EvidenceEntity).save({
        repositoryId: repoId,
        nodeId: null,   // both null → violates constraint
        edgeId: null,
        filePath: 'src/unknown.ts',
        lineStart: 1,
        lineEnd: 1,
        codeSnippet: '// ?',
        commitSha: 'abc1234',
      }),
      (err: unknown) => {
        assert.ok(
          typeof err === 'object' && err !== null && 'code' in err,
          'Expected a database error object with a code property',
        );
        assert.equal((err as { code: string }).code, '23514',
          `Expected PostgreSQL check constraint violation (23514), got: ${(err as { code?: string }).code}`);
        return true;
      },
    );

    // Cleanup
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });
});

// ── Test suite 3: transaction rollback ────────────────────────────────────────

describe('transaction rollback', () => {
  it('rolls back the entire transaction when an edge insert fails due to FK violation', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('tx-rollback');
    const nodeId = await seedNode(repoId, 'tx-rollback');

    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const phantomNodeId = '00000000-0000-0000-0000-000000000099';

    try {
      // Step 1: Insert a second node inside the transaction.
      await qr.manager.save(SystemNodeEntity, {
        repositoryId: repoId,
        nodeType: NodeType.DATABASE,
        identifier: 'pg-users',
        displayName: 'Users DB',
        metadata: {},
      });

      // Step 2: Insert an edge referencing a non-existent target — this must fail.
      await qr.manager.save(SystemEdgeEntity, {
        sourceNodeId: nodeId,
        targetNodeId: phantomNodeId, // FK violation — does not exist
        edgeType: EdgeType.WRITES_TO,
        confidence: 1.0,
        isInferred: false,
      });

      await qr.commitTransaction();
    } catch {
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }

    // Assert: the node inserted inside the rolled-back transaction is gone.
    const survivors = await ds
      .getRepository(SystemNodeEntity)
      .findBy({ repositoryId: repoId });

    // Only the seeded node (created outside the transaction) should remain.
    assert.equal(survivors.length, 1, `Expected 1 surviving node, got ${survivors.length}`);
    assert.equal(survivors[0]!.id, nodeId);

    // Cleanup
    await ds.getRepository(SystemNodeEntity).delete(nodeId);
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });
});

// ── Test suite 4: embedding similarity query ──────────────────────────────────

describe('embedding similarity query', () => {
  it('returns embeddings ordered by ascending cosine distance from query vector', { timeout: 60_000 }, async () => {
    const repoId = await seedRepository('sim-search');
    const nodeId = await seedNode(repoId, 'sim-search');

    const embeddings = [
      makeEmbedding(0),   // most similar to query (seed 0)
      makeEmbedding(10),
      makeEmbedding(100), // least similar to query
    ];

    const saved = await ds.getRepository(CodeEmbeddingEntity).save(
      embeddings.map((emb, i) => ({
        nodeId,
        contentChunk: `chunk-${i}`,
        embedding: emb,
        metadata: {},
      })),
    );

    // Security invariant: top-k is bounded to <= 50 per MODULE.md §5.
    const topK = 3;
    const queryVector = makeEmbedding(0);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    type SimilarityRow = { id: string; content_chunk: string; distance: string };

    // All DataSource.query() calls use parameterised form ($1, $2, $3).
    // Raw string interpolation is strictly forbidden (Level 1 security rule).
    const rows = await ds.query<SimilarityRow[]>(
      `SELECT id, content_chunk, (embedding <=> $1::vector) AS distance
         FROM code_embeddings
        WHERE node_id = $2
        ORDER BY distance ASC
        LIMIT $3`,
      [vectorLiteral, nodeId, topK],
    );

    assert.equal(rows.length, topK, `Expected ${topK} rows, got ${rows.length}`);

    // Row 0 must be nearest (seed 0 == query vector → distance ≈ 0).
    const nearestId = saved.find((e) => e.contentChunk === 'chunk-0')!.id;
    assert.equal(rows[0]!.id, nearestId, 'First result must be the embedding with seed 0');
    assert.ok(
      parseFloat(rows[0]!.distance) < 1e-4,
      `Expected near-zero cosine distance for identical vector, got ${rows[0]!.distance}`,
    );

    // Distances must be in ascending order.
    const distances = rows.map((r) => parseFloat(r.distance));
    assert.ok(distances[1]! >= distances[0]!, `Distance ordering violated: d[1]=${distances[1]} < d[0]=${distances[0]}`);
    assert.ok(distances[2]! >= distances[1]!, `Distance ordering violated: d[2]=${distances[2]} < d[1]=${distances[1]}`);

    // Cleanup
    await ds.getRepository(CodeEmbeddingEntity).delete(saved.map((e) => e.id));
    await ds.getRepository(SystemNodeEntity).delete(nodeId);
    await ds.getRepository(RepositoryEntity).delete(repoId);
  });
});
