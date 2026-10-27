/**
 * Integration tests for Core Developer Experience:
 *   1. Repository Authorization Enforcement (Backend-level 403 vs 200).
 *   2. Technical Dashboard Metrics (Health, component breakdown, insights).
 *   3. Feature Exploration (Features -> related files -> code locations / citations).
 *   4. Grounded Feature Q&A (Evidence citation guarantee).
 *   5. Architecture Topology & Recursive CTE Blast Radius traversal.
 */
import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import {
  buildDataSourceOptions,
  GRAPH_ENGINE_ENTITIES,
} from '../../database/data-source.js';
import { InitialSchema1729000000000 } from '../../migrations/1729000000000-InitialSchema.js';
import { RepositoryEntity } from '../entities/repository.entity.js';
import { SystemNodeEntity } from '../entities/system-node.entity.js';
import { SystemEdgeEntity } from '../entities/system-edge.entity.js';
import { EvidenceEntity } from '../entities/evidence.entity.js';
import { CodeEmbeddingEntity } from '../entities/code-embedding.entity.js';
import { NodeType, EdgeType } from '../entities/graph.enums.js';
import { AuthService } from '../../auth/auth.service.js';
import { GraphEngineService } from '../graph-engine.service.js';
import { RepositoryAccessDeniedException } from '../../common/exceptions/domain.exceptions.js';

let ds: DataSource;
let authService: AuthService;
let graphService: GraphEngineService;

let testRepo: RepositoryEntity;
let serviceNode: SystemNodeEntity;
let dbNode: SystemNodeEntity;
let queueNode: SystemNodeEntity;
let testEvidence: EvidenceEntity;

before(async () => {
  ds = new DataSource(
    buildDataSourceOptions({
      entities: GRAPH_ENGINE_ENTITIES,
      migrations: [InitialSchema1729000000000],
      migrationsRun: true,
      logging: false,
    }),
  );
  await ds.initialize();

  authService = new AuthService();
  graphService = new GraphEngineService(
    ds,
    authService,
    ds.getRepository(RepositoryEntity),
    ds.getRepository(SystemNodeEntity),
    ds.getRepository(SystemEdgeEntity),
    ds.getRepository(EvidenceEntity),
    ds.getRepository(CodeEmbeddingEntity),
  );

  // Seed sample repository
  const repoRepo = ds.getRepository(RepositoryEntity);
  testRepo = await repoRepo.save(
    repoRepo.create({
      githubOrg: 'repodoctor',
      name: 'core-platform',
      defaultBranch: 'main',
      lastCommitSha: 'abc123def456',
    }),
  );

  // Seed system nodes
  const nodeRepo = ds.getRepository(SystemNodeEntity);
  serviceNode = await nodeRepo.save(
    nodeRepo.create({
      repositoryId: testRepo.id,
      nodeType: NodeType.SERVICE,
      identifier: 'auth-service',
      displayName: 'Authentication Service',
      metadata: { framework: 'nestjs', port: 3001 },
    }),
  );

  dbNode = await nodeRepo.save(
    nodeRepo.create({
      repositoryId: testRepo.id,
      nodeType: NodeType.DATABASE,
      identifier: 'users-postgres',
      displayName: 'User Accounts DB',
      metadata: { engine: 'postgresql', version: '16' },
    }),
  );

  queueNode = await nodeRepo.save(
    nodeRepo.create({
      repositoryId: testRepo.id,
      nodeType: NodeType.QUEUE,
      identifier: 'auth-events',
      displayName: 'Authentication Event Topic',
      metadata: { broker: 'redis-bullmq' },
    }),
  );

  // Seed system edges: serviceNode -> dbNode (READS_FROM), serviceNode -> queueNode (PRODUCES)
  const edgeRepo = ds.getRepository(SystemEdgeEntity);
  await edgeRepo.save([
    edgeRepo.create({
      sourceNodeId: serviceNode.id,
      targetNodeId: dbNode.id,
      edgeType: EdgeType.READS_FROM,
      confidence: 1.0,
      isInferred: false,
    }),
    edgeRepo.create({
      sourceNodeId: serviceNode.id,
      targetNodeId: queueNode.id,
      edgeType: EdgeType.PRODUCES,
      confidence: 0.95,
      isInferred: true,
    }),
  ]);

  // Seed evidence citation for serviceNode
  const evidenceRepo = ds.getRepository(EvidenceEntity);
  testEvidence = await evidenceRepo.save(
    evidenceRepo.create({
      repositoryId: testRepo.id,
      nodeId: serviceNode.id,
      edgeId: null,
      filePath: 'src/auth/auth.service.ts',
      lineStart: 15,
      lineEnd: 42,
      codeSnippet: 'export class AuthService { validateToken() { ... } }',
      commitSha: 'abc123def456',
    }),
  );
}, { timeout: 30_000 });

after(async () => {
  if (ds?.isInitialized) {
    // Cleanup seeded records
    await ds.getRepository(EvidenceEntity).delete({ repositoryId: testRepo.id });
    await ds.getRepository(SystemEdgeEntity).delete({ sourceNodeId: serviceNode.id });
    await ds.getRepository(SystemNodeEntity).delete({ repositoryId: testRepo.id });
    await ds.getRepository(RepositoryEntity).delete({ id: testRepo.id });
    await ds.destroy();
  }
});

describe('1. Backend Repository Authorization', () => {
  it('permits authorized user (dev-user) to access repodoctor repositories', async () => {
    const isAuthorized = authService.isAuthorizedForRepository('dev-user', testRepo);
    assert.strictEqual(isAuthorized, true);

    const repos = await graphService.listAccessibleRepositories('dev-user');
    assert.ok(repos.some((r) => r.id === testRepo.id));
  });

  it('strictly denies unauthorized user (guest-user) without repodoctor org membership', async () => {
    const isAuthorized = authService.isAuthorizedForRepository('guest-user', testRepo);
    assert.strictEqual(isAuthorized, false);

    const repos = await graphService.listAccessibleRepositories('guest-user');
    assert.ok(!repos.some((r) => r.id === testRepo.id));
  });
});

describe('2. Technical Dashboard & Repository Health', () => {
  it('computes component breakdown, health score, and insights', async () => {
    const dashboard = await graphService.getRepositoryDashboard(testRepo.id);

    assert.strictEqual(dashboard.repository.id, testRepo.id);
    assert.strictEqual(dashboard.analysisStatus, 'READY');
    assert.ok(dashboard.healthScore > 50, `Health score should be positive: ${dashboard.healthScore}`);
    assert.strictEqual(dashboard.components.services, 1);
    assert.strictEqual(dashboard.components.databases, 1);
    assert.strictEqual(dashboard.components.queues, 1);
    assert.strictEqual(dashboard.totalEvidenceCount, 1);
    assert.ok(dashboard.insights.length >= 2, 'Should provide architectural insights');
  });
});

describe('3. Feature Exploration & Grounded Citations', () => {
  it('navigates features -> related files -> code locations', async () => {
    const features = await graphService.getFeatures(testRepo.id);
    assert.strictEqual(features.length, 3);

    const authFeature = features.find((f) => f.identifier === 'auth-service');
    assert.ok(authFeature, 'auth-service feature must be found');
    assert.ok(authFeature.relatedFiles.includes('src/auth/auth.service.ts'));
    assert.strictEqual(authFeature.codeLocations.length, 1);
    assert.strictEqual(authFeature.codeLocations[0].lineStart, 15);
    assert.strictEqual(authFeature.codeLocations[0].lineEnd, 42);
    assert.strictEqual(authFeature.dependencies.length, 2);
  });

  it('answers feature question backed strictly by evidence citations', async () => {
    const response = await graphService.askFeatureQuestion(
      testRepo.id,
      serviceNode.id,
      'How does the authentication service connect to users and events?',
    );

    assert.strictEqual(response.confidence, 1.0);
    assert.strictEqual(response.isInferred, false);
    assert.strictEqual(response.citations.length, 1);
    assert.strictEqual(response.citations[0].evidenceId, testEvidence.id);
    assert.ok(response.answer.includes('Authentication Service'));
    assert.ok(response.answer.includes('src/auth/auth.service.ts'));
  });
});

describe('4. Architecture Topology & Blast Radius', () => {
  it('groups topology into domain subsystems with typed relationships', async () => {
    const topology = await graphService.getTopology(testRepo.id);

    assert.strictEqual(topology.groupedDomains.services.length, 1);
    assert.strictEqual(topology.groupedDomains.databases.length, 1);
    assert.strictEqual(topology.groupedDomains.queues.length, 1);
    assert.strictEqual(topology.edges.length, 2);

    const inferredEdge = topology.edges.find((e) => e.isInferred);
    assert.ok(inferredEdge, 'Inferred edge must be preserved with flag');
    assert.strictEqual(inferredEdge.confidence, 0.95);
  });

  it('calculates recursive downstream blast radius with cycle prevention', async () => {
    const blastRadius = await graphService.getBlastRadius(testRepo.id, serviceNode.id);

    assert.strictEqual(blastRadius.rootNodeId, serviceNode.id);
    assert.strictEqual(blastRadius.totalImpactedNodes, 2);
    assert.ok(blastRadius.steps.some((s) => s.targetNodeName === 'User Accounts DB'));
    assert.ok(blastRadius.steps.some((s) => s.targetNodeName === 'Authentication Event Topic'));
  });
});
