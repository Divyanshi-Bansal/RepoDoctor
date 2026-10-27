import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IngestionService, INGESTION_LIMITS } from '../ingestion.service.js';
import { AnalyzerService } from '../analyzer.service.js';
import { AnalysisService } from '../analysis.service.js';
import { NodeType, EdgeType } from '../../graph-engine/entities/graph.enums.js';
import { RepositoryEntity } from '../../graph-engine/entities/repository.entity.js';
import { SystemNodeEntity } from '../../graph-engine/entities/system-node.entity.js';
import { SystemEdgeEntity } from '../../graph-engine/entities/system-edge.entity.js';
import { EvidenceEntity } from '../../graph-engine/entities/evidence.entity.js';

describe('Milestones 2 & 3 — Repository Analysis & Persistence', () => {
  const fixtureDir = path.resolve(__dirname, '../../../test/fixtures/sample-repo');

  // ── 1. IngestionService: Path Traversal & Limits ───────────────────────────
  describe('1. IngestionService', () => {
    let ingestionService: IngestionService;

    beforeEach(() => {
      ingestionService = new IngestionService();
    });

    describe('isSafeRelativePath', () => {
      it('accepts safe relative file paths', () => {
        expect(ingestionService.isSafeRelativePath('src/index.ts')).toBe(true);
        expect(ingestionService.isSafeRelativePath('components/ui/button.tsx')).toBe(true);
        expect(ingestionService.isSafeRelativePath('utils.js')).toBe(true);
      });

      it('rejects path traversal attempts with ".."', () => {
        expect(ingestionService.isSafeRelativePath('../etc/passwd')).toBe(false);
        expect(ingestionService.isSafeRelativePath('src/../../secret.key')).toBe(false);
        expect(ingestionService.isSafeRelativePath('..\\windows\\system32')).toBe(false);
      });

      it('rejects absolute paths', () => {
        expect(ingestionService.isSafeRelativePath('/etc/passwd')).toBe(false);
        expect(ingestionService.isSafeRelativePath('\\Windows\\System32')).toBe(false);
      });

      it('rejects null byte injection and invalid types', () => {
        expect(ingestionService.isSafeRelativePath('src/\0index.ts')).toBe(false);
        expect(ingestionService.isSafeRelativePath('')).toBe(false);
        expect(ingestionService.isSafeRelativePath(null as any)).toBe(false);
        expect(ingestionService.isSafeRelativePath(undefined as any)).toBe(false);
      });
    });

    describe('isSupportedSourceFile', () => {
      it('accepts TypeScript and JavaScript source files', () => {
        expect(ingestionService.isSupportedSourceFile('src/main.ts')).toBe(true);
        expect(ingestionService.isSupportedSourceFile('components/App.tsx')).toBe(true);
        expect(ingestionService.isSupportedSourceFile('server.js')).toBe(true);
        expect(ingestionService.isSupportedSourceFile('utils.cjs')).toBe(true);
        expect(ingestionService.isSupportedSourceFile('lib.mjs')).toBe(true);
      });

      it('rejects declaration files (.d.ts)', () => {
        expect(ingestionService.isSupportedSourceFile('types/global.d.ts')).toBe(false);
      });

      it('rejects non-code files', () => {
        expect(ingestionService.isSupportedSourceFile('README.md')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('logo.png')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('package.json')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('styles.css')).toBe(false);
      });

      it('rejects files in ignored directories (node_modules, dist, .git, etc.)', () => {
        expect(ingestionService.isSupportedSourceFile('node_modules/pkg/index.js')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('.git/config')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('dist/bundle.js')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('.next/server.js')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('build/main.js')).toBe(false);
        expect(ingestionService.isSupportedSourceFile('coverage/index.js')).toBe(false);
      });
    });

    describe('verifyRepositoryAccess', () => {
      it('returns default branch on 200 OK', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ default_branch: 'main' }),
        } as any);

        const result = await ingestionService.verifyRepositoryAccess('owner', 'repo', 'gho_token');
        expect(result.defaultBranch).toBe('main');
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer gho_token',
            }),
          }),
        );
      });

      it('throws UnauthorizedException on 401', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
        } as any);

        await expect(
          ingestionService.verifyRepositoryAccess('owner', 'repo', 'bad_token'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws ForbiddenException on 403', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
        } as any);

        await expect(
          ingestionService.verifyRepositoryAccess('owner', 'repo', 'token'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('throws NotFoundException on 404', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
        } as any);

        await expect(
          ingestionService.verifyRepositoryAccess('owner', 'missing-repo', 'token'),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('fetchRepositoryFiles limits & safety', () => {
      it('caps candidate files to MAX_FILES (100) when tree is large', async () => {
        vi.spyOn(ingestionService, 'verifyRepositoryAccess').mockResolvedValue({
          defaultBranch: 'main',
        });

        // Mock 120 files in tree
        const fakeTree = Array.from({ length: 120 }, (_, i) => ({
          path: `file_${i}.ts`,
          mode: '100644',
          type: 'blob' as const,
          sha: `sha_${i}`,
          size: 100,
        }));

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/git/trees/')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                sha: 'commit_sha',
                tree: fakeTree,
                truncated: false,
              }),
            });
          }
          // Raw file download
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => 'export const x = 1;',
          });
        });

        const result = await ingestionService.fetchRepositoryFiles('owner', 'repo', 'token');
        try {
          expect(result.relativeFiles.length).toBe(INGESTION_LIMITS.MAX_FILES);
        } finally {
          await ingestionService.cleanupWorkspace(result.workspaceDir);
        }
      });

      it('safely skips files exceeding MAX_FILE_SIZE_BYTES (1MB)', async () => {
        vi.spyOn(ingestionService, 'verifyRepositoryAccess').mockResolvedValue({
          defaultBranch: 'main',
        });

        const fakeTree = [
          {
            path: 'normal.ts',
            mode: '100644',
            type: 'blob' as const,
            sha: 'sha_normal',
            size: 500,
          },
          {
            path: 'huge_file.ts',
            mode: '100644',
            type: 'blob' as const,
            sha: 'sha_huge',
            size: 2 * 1024 * 1024, // 2MB > 1MB limit
          },
        ];

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/git/trees/')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                sha: 'commit_sha',
                tree: fakeTree,
                truncated: false,
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => 'export const normal = true;',
          });
        });

        const result = await ingestionService.fetchRepositoryFiles('owner', 'repo', 'token');
        try {
          expect(result.relativeFiles).toContain('normal.ts');
          expect(result.relativeFiles).not.toContain('huge_file.ts');
        } finally {
          await ingestionService.cleanupWorkspace(result.workspaceDir);
        }
      });

      it('safely limits total downloaded bytes up to MAX_TOTAL_BYTES', async () => {
        vi.spyOn(ingestionService, 'verifyRepositoryAccess').mockResolvedValue({
          defaultBranch: 'main',
        });

        const fakeTree = [
          {
            path: 'file_1.ts',
            mode: '100644',
            type: 'blob' as const,
            sha: 'sha_1',
            size: 500,
          },
        ];

        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/git/trees/')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                sha: 'commit_sha',
                tree: fakeTree,
                truncated: false,
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => 'export const a = 1;',
          });
        });

        const result = await ingestionService.fetchRepositoryFiles('owner', 'repo', 'token');
        try {
          expect(result.totalBytes).toBeLessThanOrEqual(INGESTION_LIMITS.MAX_TOTAL_BYTES);
          expect(result.totalBytes).toBeGreaterThan(0);
        } finally {
          await ingestionService.cleanupWorkspace(result.workspaceDir);
        }
      });

      it('cleans up temporary workspace directory completely', async () => {
        const tempDir = path.join(os.tmpdir(), `test-cleanup-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'dummy.txt'), 'hello');

        expect(fs.existsSync(tempDir)).toBe(true);
        await ingestionService.cleanupWorkspace(tempDir);
        expect(fs.existsSync(tempDir)).toBe(false);
      });
    });
  });

  // ── 2. AnalyzerService: AST & Dependency Extraction ─────────────────────────
  describe('2. AnalyzerService', () => {
    let analyzerService: AnalyzerService;

    beforeEach(() => {
      analyzerService = new AnalyzerService();
    });

    describe('resolveImportTarget', () => {
      const knownFiles = new Set([
        'src/index.ts',
        'src/db/database.ts',
        'src/services/user.service.ts',
        'src/utils/index.ts',
      ]);

      it('ignores third-party npm and built-in imports', () => {
        expect(analyzerService.resolveImportTarget('src/index.ts', '@nestjs/common', knownFiles)).toBeNull();
        expect(analyzerService.resolveImportTarget('src/index.ts', 'react', knownFiles)).toBeNull();
        expect(analyzerService.resolveImportTarget('src/index.ts', 'path', knownFiles)).toBeNull();
      });

      it('resolves relative imports with .js extension to .ts target', () => {
        const resolved = analyzerService.resolveImportTarget(
          'src/index.ts',
          './db/database.js',
          knownFiles,
        );
        expect(resolved).toBe('src/db/database.ts');
      });

      it('resolves relative imports without extension', () => {
        const resolved = analyzerService.resolveImportTarget(
          'src/index.ts',
          './services/user.service',
          knownFiles,
        );
        expect(resolved).toBe('src/services/user.service.ts');
      });

      it('resolves relative imports to directory index file', () => {
        const resolved = analyzerService.resolveImportTarget(
          'src/index.ts',
          './utils',
          knownFiles,
        );
        expect(resolved).toBe('src/utils/index.ts');
      });

      it('resolves parent relative navigation (..)', () => {
        const resolved = analyzerService.resolveImportTarget(
          'src/services/user.service.ts',
          '../db/database.js',
          knownFiles,
        );
        expect(resolved).toBe('src/db/database.ts');
      });

      it('returns null when import target does not exist in knownFiles', () => {
        const resolved = analyzerService.resolveImportTarget(
          'src/index.ts',
          './missing/file.js',
          knownFiles,
        );
        expect(resolved).toBeNull();
      });
    });

    describe('classifyNodeType', () => {
      it('classifies database-related paths and symbols as DATABASE', () => {
        expect(analyzerService.classifyNodeType('src/db/database.ts', ['createDatabaseClient'])).toBe(
          NodeType.DATABASE,
        );
        expect(analyzerService.classifyNodeType('src/entities/user.entity.ts', ['UserEntity'])).toBe(
          NodeType.DATABASE,
        );
      });

      it('classifies queue files as QUEUE', () => {
        expect(analyzerService.classifyNodeType('src/jobs/analysis.queue.ts', ['AnalysisQueue'])).toBe(
          NodeType.QUEUE,
        );
      });

      it('classifies controller and route files as SERVICE', () => {
        expect(
          analyzerService.classifyNodeType('src/controllers/api.controller.ts', ['ApiController']),
        ).toBe(NodeType.SERVICE);
      });

      it('classifies general utility components as PACKAGE', () => {
        expect(
          analyzerService.classifyNodeType('src/utils/helpers.ts', ['formatDate']),
        ).toBe(NodeType.PACKAGE);
      });

      it('defaults service components to SERVICE', () => {
        expect(
          analyzerService.classifyNodeType('src/services/user.service.ts', ['UserService']),
        ).toBe(NodeType.SERVICE);
      });
    });

    describe('analyzeWorkspace on Sample Fixture', () => {
      it('extracts real AST nodes and dependency edges from multi-file fixture', async () => {
        const files = ['index.ts', 'services/user.service.ts', 'db/database.ts'];

        const output = await analyzerService.analyzeWorkspace(fixtureDir, files);

        // 1. Verify Nodes
        expect(output.nodes).toHaveLength(3);
        const nodeIdentifiers = output.nodes.map((n) => n.identifier);
        expect(nodeIdentifiers).toContain('index.ts');
        expect(nodeIdentifiers).toContain('services/user.service.ts');
        expect(nodeIdentifiers).toContain('db/database.ts');

        // Node type classification
        const dbNode = output.nodes.find((n) => n.identifier === 'db/database.ts')!;
        expect(dbNode.nodeType).toBe(NodeType.DATABASE);
        expect(dbNode.metadata.exports).toContain('DatabaseClient');

        const serviceNode = output.nodes.find((n) => n.identifier === 'services/user.service.ts')!;
        expect(serviceNode.nodeType).toBe(NodeType.SERVICE);
        expect(serviceNode.metadata.exports).toContain('UserService');

        // Evidence on node
        expect(dbNode.evidence.filePath).toBe('db/database.ts');
        expect(dbNode.evidence.lineStart).toBeGreaterThanOrEqual(1);
        expect(dbNode.evidence.codeSnippet).toContain('class DatabaseClient');

        // 2. Verify Dependency Edges
        expect(output.edges.length).toBeGreaterThanOrEqual(3);

        // index.ts -> db/database.ts
        const indexToDb = output.edges.find(
          (e) => e.sourceIdentifier === 'index.ts' && e.targetIdentifier === 'db/database.ts',
        );
        expect(indexToDb).toBeDefined();
        expect(indexToDb!.confidence).toBe(1.0);
        expect(indexToDb!.isInferred).toBe(false);
        expect(indexToDb!.edgeType).toBe(EdgeType.DEPENDS_ON);
        expect(indexToDb!.evidence.codeSnippet).toContain("from './db/database.js'");

        // index.ts -> services/user.service.ts
        const indexToService = output.edges.find(
          (e) =>
            e.sourceIdentifier === 'index.ts' &&
            e.targetIdentifier === 'services/user.service.ts',
        );
        expect(indexToService).toBeDefined();
        expect(indexToService!.confidence).toBe(1.0);

        // services/user.service.ts -> db/database.ts (import dependency)
        const serviceToDb = output.edges.find(
          (e) =>
            e.sourceIdentifier === 'services/user.service.ts' &&
            e.targetIdentifier === 'db/database.ts' &&
            e.edgeType === EdgeType.DEPENDS_ON,
        );
        expect(serviceToDb).toBeDefined();
        expect(serviceToDb!.evidence.codeSnippet).toContain("from '../db/database.js'");

        // services/user.service.ts -> db/database.ts (statically resolved database query operation: READS_FROM)
        const serviceReadsDb = output.edges.find(
          (e) =>
            e.sourceIdentifier === 'services/user.service.ts' &&
            e.targetIdentifier === 'db/database.ts' &&
            e.edgeType === EdgeType.READS_FROM,
        );
        expect(serviceReadsDb).toBeDefined();
        expect(serviceReadsDb!.confidence).toBe(1.0);
        expect(serviceReadsDb!.evidence.codeSnippet).toContain("this.db.query('SELECT 1')");

        // index.ts -> services/user.service.ts (instantiation call: CALLS)
        const indexCallsService = output.edges.find(
          (e) =>
            e.sourceIdentifier === 'index.ts' &&
            e.targetIdentifier === 'services/user.service.ts' &&
            e.edgeType === EdgeType.CALLS,
        );
        expect(indexCallsService).toBeDefined();
        expect(indexCallsService!.evidence.codeSnippet).toContain('new UserService(this.db)');
      });
    });
  });

  // ── 3. AnalysisService: Transactional Persistence & Invariants ─────────────
  describe('3. AnalysisService', () => {
    let analysisService: AnalysisService;
    let ingestionService: IngestionService;
    let analyzerService: AnalyzerService;
    let mockDataSource: any;
    let mockRepoRepo: any;
    let mockQueryRunner: any;

    const savedNodes: SystemNodeEntity[] = [];
    const savedEdges: SystemEdgeEntity[] = [];
    const savedEvidences: EvidenceEntity[] = [];
    let repositoryRecord: any;

    beforeEach(() => {
      savedNodes.length = 0;
      savedEdges.length = 0;
      savedEvidences.length = 0;

      repositoryRecord = {
        id: 'repo-uuid-1',
        githubOrg: 'testorg',
        name: 'testrepo',
        analysisStatus: 'NOT_ANALYZED',
        lastCommitSha: null,
      };

      mockRepoRepo = {
        findOne: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === repositoryRecord.id) return repositoryRecord;
          return null;
        }),
        findOneOrFail: vi.fn().mockImplementation(async ({ where }) => {
          if (where.id === repositoryRecord.id) return repositoryRecord;
          throw new NotFoundException();
        }),
      };

      mockQueryRunner = {
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        manager: {
          delete: vi.fn().mockResolvedValue(undefined),
          find: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation((entityClass, props) => ({
            id: `entity-${Math.random().toString(36).substring(2, 9)}`,
            ...props,
          })),
          save: vi.fn().mockImplementation(async (entityClass, entity) => {
            if (entityClass === SystemNodeEntity) {
              savedNodes.push(entity);
            } else if (entityClass === SystemEdgeEntity) {
              savedEdges.push(entity);
            } else if (entityClass === EvidenceEntity) {
              savedEvidences.push(entity);
            }
            return entity;
          }),
          update: vi.fn().mockImplementation(async (entityClass, criteria, partial) => {
            if (entityClass === RepositoryEntity && criteria.id === repositoryRecord.id) {
              Object.assign(repositoryRecord, partial);
            }
          }),
        },
      };

      mockDataSource = {
        createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      };

      ingestionService = new IngestionService();
      analyzerService = new AnalyzerService();
      analysisService = new AnalysisService(
        mockDataSource,
        ingestionService,
        analyzerService,
        mockRepoRepo,
      );
    });

    it('executes analyzeLocalDirectory against fixture and persists entities atomically', async () => {
      const result = await analysisService.analyzeLocalDirectory(
        'repo-uuid-1',
        fixtureDir,
        'sha-abc-123',
      );

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      // Check repository updated
      expect(repositoryRecord.lastCommitSha).toBe('sha-abc-123');

      // Check nodes persisted
      expect(savedNodes).toHaveLength(3);

      // Check edges persisted
      expect(savedEdges.length).toBeGreaterThanOrEqual(3);

      // Check evidence persisted
      expect(savedEvidences.length).toBeGreaterThanOrEqual(6); // 3 node evidences + 3+ edge evidences

      // CRITICAL Level 1 Constraint: chk_evidence_single_target
      // (node_id IS NOT NULL AND edge_id IS NULL) OR (node_id IS NULL AND edge_id IS NOT NULL)
      for (const ev of savedEvidences) {
        const hasNode = ev.nodeId !== null && ev.nodeId !== undefined;
        const hasEdge = ev.edgeId !== null && ev.edgeId !== undefined;
        expect((hasNode && !hasEdge) || (!hasNode && hasEdge)).toBe(true);
        expect(ev.repositoryId).toBe('repo-uuid-1');
        expect(ev.commitSha).toBe('sha-abc-123');
        expect(ev.filePath).toBeDefined();
        expect(ev.codeSnippet).toBeDefined();
      }
    });

    it('rolls back transaction on database error and releases runner', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('Simulated DB connection failure'));

      await expect(
        analysisService.analyzeLocalDirectory('repo-uuid-1', fixtureDir, 'sha-err'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('throws NotFoundException when repository ID is not found in database', async () => {
      await expect(
        analysisService.analyzeLocalDirectory('non-existent-id', fixtureDir),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });

    it('performs idempotent cleanup before inserting new records', async () => {
      // Simulate existing nodes and edges in DB
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        { id: 'old-node-1', repositoryId: 'repo-uuid-1' },
      ]);

      await analysisService.analyzeLocalDirectory('repo-uuid-1', fixtureDir, 'sha-2');

      // Check that existing evidence and nodes were deleted
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        EvidenceEntity,
        { repositoryId: 'repo-uuid-1' },
      );
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        SystemNodeEntity,
        { repositoryId: 'repo-uuid-1' },
      );
    });
  });
});
