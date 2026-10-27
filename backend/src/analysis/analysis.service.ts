import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';
import { SystemNodeEntity } from '../graph-engine/entities/system-node.entity.js';
import { SystemEdgeEntity } from '../graph-engine/entities/system-edge.entity.js';
import { EvidenceEntity } from '../graph-engine/entities/evidence.entity.js';
import { IngestionService } from './ingestion.service.js';
import { AnalyzerService, AnalysisOutput } from './analyzer.service.js';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ingestionService: IngestionService,
    private readonly analyzerService: AnalyzerService,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: Repository<RepositoryEntity>,
  ) {}

  /**
   * Performs an atomic analysis of a remote GitHub repository:
   * 1. Verifies authorization
   * 2. Safely ingests files into a temporary sandbox
   * 3. Statically analyzes AST and import dependencies
   * 4. Persists nodes, edges, and evidence atomically inside a database transaction
   * 5. Cleans up workspace directory in a finally block
   */
  async analyzeRepository(
    repositoryId: string,
    accessToken: string,
  ): Promise<RepositoryEntity> {
    const repository = await this.repoRepo.findOne({ where: { id: repositoryId } });
    if (!repository) {
      throw new NotFoundException(`Repository with ID '${repositoryId}' not found`);
    }

    let workspaceDir = '';

    try {
      this.logger.log(
        `Starting ingestion for repository ${repository.githubOrg}/${repository.name}...`,
      );

      const ingestion = await this.ingestionService.fetchRepositoryFiles(
        repository.githubOrg,
        repository.name,
        accessToken,
      );
      workspaceDir = ingestion.workspaceDir;

      this.logger.log(
        `Ingested ${ingestion.relativeFiles.length} files (${ingestion.totalBytes} bytes). Running static analysis...`,
      );

      const analysis = await this.analyzerService.analyzeWorkspace(
        ingestion.workspaceDir,
        ingestion.relativeFiles,
      );

      this.logger.log(
        `Extracted ${analysis.nodes.length} nodes and ${analysis.edges.length} dependency edges. Persisting atomically...`,
      );

      return await this.persistAnalysisResults(
        repository.id,
        ingestion.commitSha,
        analysis,
      );
    } catch (err) {
      this.logger.error(`Analysis failed for ${repository.githubOrg}/${repository.name}: ${err}`);
      throw err;
    } finally {
      if (workspaceDir) {
        await this.ingestionService.cleanupWorkspace(workspaceDir);
      }
    }
  }

  /**
   * Analyzes a local directory on disk (used for testing and fixture verification).
   */
  async analyzeLocalDirectory(
    repositoryId: string,
    localDir: string,
    commitSha = 'fixture-commit-sha',
  ): Promise<RepositoryEntity> {
    const repository = await this.repoRepo.findOne({ where: { id: repositoryId } });
    if (!repository) {
      throw new NotFoundException(`Repository '${repositoryId}' not found`);
    }

    // Collect all supported JS/TS files in directory
    const files: string[] = [];
    const scanDir = (currentDir: string, relativeRoot: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(currentDir, entry.name);
        const rel = path.join(relativeRoot, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
            scanDir(full, rel);
          }
        } else if (entry.isFile() && this.ingestionService.isSupportedSourceFile(rel)) {
          files.push(rel);
        }
      }
    };

    scanDir(localDir, '');

    const analysis = await this.analyzerService.analyzeWorkspace(localDir, files);
    return await this.persistAnalysisResults(repository.id, commitSha, analysis);
  }

  /**
   * Persists analysis results atomically inside a database transaction.
   * Guarantees idempotency by replacing any previous analysis records for this repository.
   */
  private async persistAnalysisResults(
    repositoryId: string,
    commitSha: string,
    analysis: AnalysisOutput,
  ): Promise<RepositoryEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Clean existing records for this repository (idempotent re-analysis)
      await queryRunner.manager.delete(EvidenceEntity, { repositoryId });

      const existingNodes = await queryRunner.manager.find(SystemNodeEntity, {
        where: { repositoryId },
      });
      const existingNodeIds = existingNodes.map((n) => n.id);

      if (existingNodeIds.length > 0) {
        await queryRunner.manager.delete(SystemEdgeEntity, [
          { sourceNodeId: In(existingNodeIds) },
          { targetNodeId: In(existingNodeIds) },
        ]);
        await queryRunner.manager.delete(SystemNodeEntity, { repositoryId });
      }

      // 2. Insert new SystemNodeEntity records
      const nodeEntityMap = new Map<string, SystemNodeEntity>();

      for (const nodeDef of analysis.nodes) {
        const nodeEntity = queryRunner.manager.create(SystemNodeEntity, {
          repositoryId,
          nodeType: nodeDef.nodeType,
          identifier: nodeDef.identifier,
          displayName: nodeDef.displayName,
          metadata: nodeDef.metadata,
        });
        const savedNode = await queryRunner.manager.save(SystemNodeEntity, nodeEntity);
        nodeEntityMap.set(nodeDef.identifier, savedNode);

        // 3. Insert Node Evidence (nodeId IS NOT NULL, edgeId IS NULL)
        const nodeEvidence = queryRunner.manager.create(EvidenceEntity, {
          repositoryId,
          nodeId: savedNode.id,
          edgeId: null,
          filePath: nodeDef.evidence.filePath,
          lineStart: nodeDef.evidence.lineStart,
          lineEnd: nodeDef.evidence.lineEnd,
          codeSnippet: nodeDef.evidence.codeSnippet,
          commitSha,
        });
        await queryRunner.manager.save(EvidenceEntity, nodeEvidence);
      }

      // 4. Insert SystemEdgeEntity records & Edge Evidence
      for (const edgeDef of analysis.edges) {
        const sourceNode = nodeEntityMap.get(edgeDef.sourceIdentifier);
        const targetNode = nodeEntityMap.get(edgeDef.targetIdentifier);

        if (sourceNode && targetNode) {
          const edgeEntity = queryRunner.manager.create(SystemEdgeEntity, {
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            edgeType: edgeDef.edgeType,
            confidence: edgeDef.confidence,
            isInferred: edgeDef.isInferred,
          });
          const savedEdge = await queryRunner.manager.save(SystemEdgeEntity, edgeEntity);

          // 5. Insert Edge Evidence (nodeId IS NULL, edgeId IS NOT NULL)
          const edgeEvidence = queryRunner.manager.create(EvidenceEntity, {
            repositoryId,
            nodeId: null,
            edgeId: savedEdge.id,
            filePath: edgeDef.evidence.filePath,
            lineStart: edgeDef.evidence.lineStart,
            lineEnd: edgeDef.evidence.lineEnd,
            codeSnippet: edgeDef.evidence.codeSnippet,
            commitSha,
          });
          await queryRunner.manager.save(EvidenceEntity, edgeEvidence);
        }
      }

      // 6. Update repository last_commit_sha and updated_at
      await queryRunner.manager.update(
        RepositoryEntity,
        { id: repositoryId },
        {
          lastCommitSha: commitSha,
          updatedAt: new Date(),
        },
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully committed analysis results for repository ${repositoryId}`);

      const updated = await this.repoRepo.findOneOrFail({ where: { id: repositoryId } });
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Rolled back analysis transaction for repository ${repositoryId}: ${err}`);
      throw new InternalServerErrorException(
        `Failed to persist analysis results: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
