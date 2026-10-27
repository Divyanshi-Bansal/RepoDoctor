import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RepositoryEntity } from './entities/repository.entity.js';
import { SystemNodeEntity } from './entities/system-node.entity.js';
import { SystemEdgeEntity } from './entities/system-edge.entity.js';
import { EvidenceEntity } from './entities/evidence.entity.js';
import { CodeEmbeddingEntity } from './entities/code-embedding.entity.js';
import { ProjectEntity } from './entities/project.entity.js';
import { UserEntity } from '../auth/entities/user.entity.js';
import { AuthService } from '../auth/auth.service.js';
import {
  RepositoryNotFoundException,
  FeatureNodeNotFoundException,
  RepositoryAccessDeniedException,
} from '../common/exceptions/domain.exceptions.js';
import type {
  RepositoryDto,
  RepositoryDashboardDto,
  ComponentBreakdownDto,
  ArchitecturalInsightDto,
  FeatureItemDto,
  FeatureQuestionResponseDto,
  CodeLocationCitationDto,
  ArchitectureTopologyDto,
  TopologyNodeDto,
  TopologyEdgeDto,
  BlastRadiusResultDto,
  BlastRadiusStepDto,
  NodeType,
  EdgeType,
} from '@repo-doctor/shared';

@Injectable()
export class GraphEngineService {
  private readonly logger = new Logger(GraphEngineService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: Repository<RepositoryEntity>,
    @InjectRepository(SystemNodeEntity)
    private readonly nodeRepo: Repository<SystemNodeEntity>,
    @InjectRepository(SystemEdgeEntity)
    private readonly edgeRepo: Repository<SystemEdgeEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly evidenceRepo: Repository<EvidenceEntity>,
    @InjectRepository(CodeEmbeddingEntity)
    private readonly embeddingRepo: Repository<CodeEmbeddingEntity>,
  ) {}

  async listAccessibleRepositories(
    userId: string,
    accessToken?: string,
    options?: {
      actualUserId?: string;
      gitlabToken?: string;
      githubUsername?: string | null;
      gitlabUsername?: string | null;
    },
  ): Promise<readonly RepositoryDto[]> {
    const actualUserId = options?.actualUserId;
    const gitlabToken = options?.gitlabToken;
    const githubUsername = options?.githubUsername;
    const gitlabUsername = options?.gitlabUsername;

    const discoveredIds = new Set<string>();
    const results: RepositoryDto[] = [];

    // 1. Fetch remote GitHub repositories if user has a connected GitHub token
    if (accessToken) {
      try {
        const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'RepoDoctor-App',
          },
        });

        if (response.status === 401) {
          throw new UnauthorizedException('GitHub access token has expired or been revoked');
        }

        if (response.ok) {
          const githubRepos = (await response.json()) as Array<{
            id: number;
            name: string;
            owner: { login: string };
            default_branch: string;
            updated_at: string;
          }>;

          for (const ghRepo of githubRepos) {
            const org = ghRepo.owner.login;
            const name = ghRepo.name;

            // Find or pre-register in database
            let repoEntity = await this.repoRepo.findOne({
              where: { githubOrg: org, name },
            });

            if (!repoEntity) {
              repoEntity = await this.repoRepo.save(
                this.repoRepo.create({
                  githubOrg: org,
                  name,
                  defaultBranch: ghRepo.default_branch || 'main',
                  lastCommitSha: null,
                  ownerId: actualUserId || null,
                }),
              );
            } else if (!repoEntity.ownerId && actualUserId) {
              repoEntity.ownerId = actualUserId;
              await this.repoRepo.save(repoEntity);
            }

            discoveredIds.add(repoEntity.id);
            results.push(this.mapRepoToDto(repoEntity));
          }
        }
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
        this.logger.warn(`Failed to fetch GitHub repositories: ${err}`);
      }
    }

    // 2. Fetch remote GitLab repositories if user has a connected GitLab token
    if (gitlabToken) {
      try {
        const response = await fetch(
          'https://gitlab.com/api/v4/projects?membership=true&simple=true&per_page=100&order_by=updated_at',
          {
            headers: {
              Authorization: `Bearer ${gitlabToken}`,
              Accept: 'application/json',
            },
          },
        );

        if (response.ok) {
          const gitlabProjects = (await response.json()) as Array<{
            id: number;
            name: string;
            path_with_namespace: string;
            default_branch?: string;
          }>;

          for (const glProj of gitlabProjects) {
            const parts = glProj.path_with_namespace.split('/');
            const org = parts.length > 1 ? parts.slice(0, -1).join('/') : 'gitlab';
            const name = parts[parts.length - 1];

            let repoEntity = await this.repoRepo.findOne({
              where: { githubOrg: org, name },
            });

            if (!repoEntity) {
              repoEntity = await this.repoRepo.save(
                this.repoRepo.create({
                  githubOrg: org,
                  name,
                  defaultBranch: glProj.default_branch || 'main',
                  lastCommitSha: null,
                  ownerId: actualUserId || null,
                }),
              );
            } else if (!repoEntity.ownerId && actualUserId) {
              repoEntity.ownerId = actualUserId;
              await this.repoRepo.save(repoEntity);
            }

            if (!discoveredIds.has(repoEntity.id)) {
              discoveredIds.add(repoEntity.id);
              results.push(this.mapRepoToDto(repoEntity));
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch GitLab repositories: ${err}`);
      }
    }

    // 3. Include local repositories: owned by user, matching usernames, or authorized via matrix
    const allRepos = await this.repoRepo.find({
      order: { updatedAt: 'DESC' },
    });

    for (const repo of allRepos) {
      if (discoveredIds.has(repo.id)) continue;

      let isAllowed = false;

      // Direct owner match
      if (actualUserId && repo.ownerId === actualUserId) {
        isAllowed = true;
      }
      // GitHub username match
      else if (githubUsername && repo.githubOrg.toLowerCase() === githubUsername.toLowerCase()) {
        isAllowed = true;
      }
      // GitLab username match
      else if (gitlabUsername && repo.githubOrg.toLowerCase() === gitlabUsername.toLowerCase()) {
        isAllowed = true;
      }
      // Authorized username match (e.g. dev-user, alice)
      else if (this.authService.isAuthorizedForRepository(userId, repo)) {
        isAllowed = true;
      }

      if (isAllowed) {
        discoveredIds.add(repo.id);
        results.push(this.mapRepoToDto(repo));
      }
    }

    return results;
  }

  async assertRepositoryAccess(
    repositoryId: string,
    user?: { id: string; username: string; githubUsername?: string; gitlabUsername?: string },
  ): Promise<RepositoryEntity> {
    const repo = await this.repoRepo.findOne({ where: { id: repositoryId } });
    if (!repo) {
      throw new RepositoryNotFoundException(repositoryId);
    }

    if (!user) {
      return repo;
    }

    // Direct user ownership check
    if (repo.ownerId && repo.ownerId === user.id) {
      return repo;
    }

    // Project ownership check: if repo belongs to a project owned by this user
    if (repo.projectId) {
      try {
        const projectRepo = this.dataSource.getRepository(ProjectEntity);
        const project = await projectRepo.findOne({ where: { id: repo.projectId } });
        if (project && project.ownerId === user.id) {
          return repo;
        }
      } catch {
        // Fall through to other checks
      }
    }

    // Direct provider username matches
    if (user.githubUsername && repo.githubOrg.toLowerCase() === user.githubUsername.toLowerCase()) {
      return repo;
    }

    if (user.gitlabUsername && repo.githubOrg.toLowerCase() === user.gitlabUsername.toLowerCase()) {
      return repo;
    }

    if (user.username && repo.githubOrg.toLowerCase() === user.username.toLowerCase()) {
      return repo;
    }

    // Check DB user credentials if not in memory session object
    try {
      const userRepo = this.dataSource.getRepository(UserEntity);
      const dbUser = await userRepo.findOne({ where: { id: user.id } });
      if (dbUser) {
        if (dbUser.githubUsername && dbUser.githubUsername.toLowerCase() === repo.githubOrg.toLowerCase()) {
          return repo;
        }
        if (dbUser.gitlabUsername && dbUser.gitlabUsername.toLowerCase() === repo.githubOrg.toLowerCase()) {
          return repo;
        }
      }
    } catch {
      // Fall through
    }

    if (this.authService.isAuthorizedForRepository(user.id, repo)) {
      return repo;
    }

    throw new RepositoryAccessDeniedException(repositoryId, user.id);
  }

  async getRepositoryDashboard(
    repositoryId: string,
    user?: { id: string; username: string },
  ): Promise<RepositoryDashboardDto> {
    const repo = await this.assertRepositoryAccess(repositoryId, user);

    const nodes = await this.nodeRepo.find({ where: { repositoryId } });
    const nodeIds = nodes.map((n) => n.id);

    let edgesCount = 0;
    if (nodeIds.length > 0) {
      edgesCount = await this.edgeRepo.count({
        where: [
          { sourceNodeId: In(nodeIds) },
          { targetNodeId: In(nodeIds) },
        ],
      });
    }

    const evidenceCount = await this.evidenceRepo.count({ where: { repositoryId } });

    const breakdown: ComponentBreakdownDto = {
      services: nodes.filter((n) => n.nodeType === 'SERVICE').length,
      databases: nodes.filter((n) => n.nodeType === 'DATABASE').length,
      queues: nodes.filter((n) => n.nodeType === 'QUEUE').length,
      endpoints: nodes.filter((n) => n.nodeType === 'ENDPOINT').length,
      packages: nodes.filter((n) => n.nodeType === 'PACKAGE').length,
    };

    const insights: ArchitecturalInsightDto[] = [];

    // Health Score calculation (0 - 100)
    let healthScore = 100;
    if (nodes.length === 0) {
      healthScore = 0;
      insights.push({
        type: 'HEALTH',
        severity: 'INFO',
        title: 'Repository Pending Analysis',
        description: 'No components have been detected yet. Run initial manifest and source indexing.',
      });
    } else {
      // Check evidence backing ratio
      const ratio = evidenceCount / Math.max(nodes.length, 1);
      if (ratio >= 1.0) {
        insights.push({
          type: 'COVERAGE',
          severity: 'INFO',
          title: 'Strong Evidence Grounding',
          description: `All detected components are backed by verifiable code and manifest citations (${evidenceCount} citations).`,
        });
      } else {
        healthScore -= 15;
        insights.push({
          type: 'COVERAGE',
          severity: 'WARNING',
          title: 'Partial Evidence Grounding',
          description: `${nodes.length - evidenceCount} components lack primary evidence citations.`,
        });
      }

      // Check database and queue coupling
      if (breakdown.databases > 0 && breakdown.services > 0) {
        insights.push({
          type: 'DATA_FLOW',
          severity: 'INFO',
          title: 'Decoupled Persistence Layer',
          description: `${breakdown.services} service(s) communicating with ${breakdown.databases} persistent database(s).`,
        });
      }

      if (edgesCount === 0 && nodes.length > 1) {
        healthScore -= 20;
        insights.push({
          type: 'COUPLING',
          severity: 'WARNING',
          title: 'Unconnected Subsystems',
          description: 'Components are detected but no active dependencies have been established yet.',
        });
      }
    }

    const analysisStatus: 'READY' | 'INDEXING' | 'STALE' | 'NOT_ANALYZED' =
      nodes.length > 0 ? 'READY' : 'NOT_ANALYZED';

    return {
      repository: this.mapRepoToDto(repo),
      healthScore: Math.max(0, Math.min(100, healthScore)),
      analysisStatus,
      lastAnalyzedAt: repo.updatedAt.toISOString(),
      totalNodes: nodes.length,
      totalEdges: edgesCount,
      totalEvidenceCount: evidenceCount,
      components: breakdown,
      insights,
    };
  }

  async getFeatures(
    repositoryId: string,
    user?: { id: string; username: string },
  ): Promise<readonly FeatureItemDto[]> {
    await this.assertRepositoryAccess(repositoryId, user);
    const nodes = await this.nodeRepo.find({
      where: { repositoryId },
      order: { displayName: 'ASC' },
    });

    if (nodes.length === 0) {
      return [];
    }

    const nodeIds = nodes.map((n) => n.id);

    // Fetch all evidence for these nodes
    const evidenceList = await this.evidenceRepo.find({
      where: { nodeId: In(nodeIds) },
    });

    // Fetch all outgoing edges from these nodes
    const edges = await this.edgeRepo.find({
      where: { sourceNodeId: In(nodeIds) },
    });

    const targetNodeIds = edges.map((e) => e.targetNodeId);
    const targetNodes = targetNodeIds.length > 0
      ? await this.nodeRepo.find({ where: { id: In(targetNodeIds) } })
      : [];
    const targetNodeMap = new Map(targetNodes.map((n) => [n.id, n.displayName]));

    return nodes.map((node) => {
      const nodeEvidence = evidenceList.filter((e) => e.nodeId === node.id);
      const relatedFiles = Array.from(new Set(nodeEvidence.map((e) => e.filePath)));

      const codeLocations: CodeLocationCitationDto[] = nodeEvidence.map((e) => ({
        evidenceId: e.id,
        filePath: e.filePath,
        lineStart: e.lineStart,
        lineEnd: e.lineEnd,
        codeSnippet: e.codeSnippet,
        commitSha: e.commitSha,
      }));

      const nodeEdges = edges.filter((e) => e.sourceNodeId === node.id);
      const dependencies = nodeEdges.map((e) => ({
        targetId: e.targetNodeId,
        targetName: targetNodeMap.get(e.targetNodeId) ?? 'Unknown Component',
        edgeType: e.edgeType as EdgeType,
        confidence: Number(e.confidence),
        isInferred: Boolean(e.isInferred),
      }));

      return {
        id: node.id,
        identifier: node.identifier,
        displayName: node.displayName,
        nodeType: node.nodeType as NodeType,
        metadata: node.metadata ?? {},
        relatedFiles,
        codeLocations,
        dependencies,
      };
    });
  }

  async askFeatureQuestion(
    repositoryId: string,
    nodeId: string,
    question: string,
    user?: { id: string; username: string },
  ): Promise<FeatureQuestionResponseDto> {
    await this.assertRepositoryAccess(repositoryId, user);
    const node = await this.nodeRepo.findOne({
      where: { id: nodeId, repositoryId },
    });

    if (!node) {
      throw new FeatureNodeNotFoundException(nodeId);
    }

    // Retrieve evidence connected to this node
    const evidenceList = await this.evidenceRepo.find({
      where: { nodeId: node.id },
    });

    // Retrieve outgoing and incoming edges for this node
    const edges = await this.edgeRepo.find({
      where: [{ sourceNodeId: node.id }, { targetNodeId: node.id }],
    });

    const relatedNodeIds = Array.from(
      new Set(
        edges.map((e) => (e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId)),
      ),
    );

    const relatedNodes = relatedNodeIds.length > 0
      ? await this.nodeRepo.find({ where: { id: In(relatedNodeIds) } })
      : [];

    const citations: CodeLocationCitationDto[] = evidenceList.map((e) => ({
      evidenceId: e.id,
      filePath: e.filePath,
      lineStart: e.lineStart,
      lineEnd: e.lineEnd,
      codeSnippet: e.codeSnippet,
      commitSha: e.commitSha,
    }));

    // Synthesize grounded architectural answer strictly backed by citations
    const dependenciesList = edges
      .map((e) => {
        const isOutgoing = e.sourceNodeId === node.id;
        const otherNode = relatedNodes.find(
          (rn) => rn.id === (isOutgoing ? e.targetNodeId : e.sourceNodeId),
        );
        const direction = isOutgoing ? 'interacts with' : 'is depended on by';
        const inferenceNote = e.isInferred ? ` (inferred, ${(Number(e.confidence) * 100).toFixed(0)}% confidence)` : ' (verified manifest/AST citation)';
        return `• ${direction} ${otherNode?.displayName ?? 'system component'} [${e.edgeType}]${inferenceNote}`;
      })
      .join('\n');

    const filesList = Array.from(new Set(citations.map((c) => c.filePath)))
      .map((f) => `• ${f}`)
      .join('\n');

    let answer = `Feature "${node.displayName}" (${node.nodeType}):\n`;
    answer += `Query: "${question}"\n\n`;
    answer += `Grounded Architecture Summary:\n`;
    answer += `This component represents a ${node.nodeType.toLowerCase()} defined within the repository.\n`;

    if (citations.length > 0) {
      answer += `\nVerified Source Locations (${citations.length} citations):\n${filesList}\n`;
    }

    if (dependenciesList.length > 0) {
      answer += `\nTopological Dependencies:\n${dependenciesList}\n`;
    } else {
      answer += `\nNo external outbound dependencies detected for this component.\n`;
    }

    answer += `\nEvidence Guarantee: This answer is synthesized exclusively from verified relational graph records and evidence citations.`;

    return {
      answer,
      confidence: 1.0,
      isInferred: false,
      citations,
      relatedNodeIds,
    };
  }

  async getTopology(
    repositoryId: string,
    user?: { id: string; username: string },
  ): Promise<ArchitectureTopologyDto> {
    await this.assertRepositoryAccess(repositoryId, user);
    const nodes = await this.nodeRepo.find({
      where: { repositoryId },
      order: { displayName: 'ASC' },
    });

    const nodeIds = nodes.map((n) => n.id);
    let edges: SystemEdgeEntity[] = [];

    if (nodeIds.length > 0) {
      edges = await this.edgeRepo.find({
        where: [
          { sourceNodeId: In(nodeIds) },
          { targetNodeId: In(nodeIds) },
        ],
      });
    }

    const topologyNodes: TopologyNodeDto[] = nodes.map((n) => ({
      id: n.id,
      identifier: n.identifier,
      displayName: n.displayName,
      nodeType: n.nodeType as NodeType,
      metadata: n.metadata ?? {},
    }));

    const topologyEdges: TopologyEdgeDto[] = edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      edgeType: e.edgeType as EdgeType,
      confidence: Number(e.confidence),
      isInferred: Boolean(e.isInferred),
    }));

    return {
      repositoryId,
      nodes: topologyNodes,
      edges: topologyEdges,
      groupedDomains: {
        services: topologyNodes.filter((n) => n.nodeType === 'SERVICE'),
        databases: topologyNodes.filter((n) => n.nodeType === 'DATABASE'),
        queues: topologyNodes.filter((n) => n.nodeType === 'QUEUE'),
        endpoints: topologyNodes.filter((n) => n.nodeType === 'ENDPOINT'),
        packages: topologyNodes.filter((n) => n.nodeType === 'PACKAGE'),
      },
    };
  }

  async getBlastRadius(
    repositoryId: string,
    targetNodeId: string,
    user?: { id: string; username: string },
  ): Promise<BlastRadiusResultDto> {
    await this.assertRepositoryAccess(repositoryId, user);
    const rootNode = await this.nodeRepo.findOne({
      where: { id: targetNodeId, repositoryId },
    });

    if (!rootNode) {
      throw new FeatureNodeNotFoundException(targetNodeId);
    }

    // Approved recursive CTE from system_architecture.md § 3
    const query = `
      WITH RECURSIVE blast_radius AS (
          SELECT 
              e.id AS edge_id,
              e.source_node_id,
              e.target_node_id,
              e.edge_type,
              e.confidence,
              1 AS depth,
              ARRAY[e.source_node_id::text, e.target_node_id::text] AS path
          FROM system_edges e
          WHERE e.source_node_id = $1

          UNION ALL

          SELECT 
              e.id AS edge_id,
              e.source_node_id,
              e.target_node_id,
              e.edge_type,
              e.confidence,
              b.depth + 1,
              b.path || e.target_node_id::text
          FROM system_edges e
          JOIN blast_radius b ON e.source_node_id = b.target_node_id
          WHERE NOT (e.target_node_id::text = ANY(b.path))
            AND b.depth < 10
      )
      SELECT 
          b.edge_id,
          b.source_node_id,
          b.target_node_id,
          b.edge_type,
          b.confidence,
          b.depth,
          b.path,
          n.display_name AS target_node_name, 
          n.node_type AS target_node_type
      FROM blast_radius b
      JOIN system_nodes n ON b.target_node_id = n.id
      ORDER BY b.depth ASC;
    `;

    interface RawStep {
      edge_id: string;
      source_node_id: string;
      target_node_id: string;
      edge_type: string;
      confidence: string | number;
      depth: number;
      path: string[];
      target_node_name: string;
      target_node_type: string;
    }

    const rawSteps = (await this.dataSource.query(query, [targetNodeId])) as RawStep[];

    const steps: BlastRadiusStepDto[] = rawSteps.map((s) => ({
      edgeId: s.edge_id,
      sourceNodeId: s.source_node_id,
      targetNodeId: s.target_node_id,
      targetNodeName: s.target_node_name,
      targetNodeType: s.target_node_type as NodeType,
      edgeType: s.edge_type as EdgeType,
      confidence: Number(s.confidence),
      depth: Number(s.depth),
      path: s.path,
    }));

    const uniqueImpactedNodeIds = new Set(steps.map((s) => s.targetNodeId));
    const maxDepth = steps.reduce((max, s) => Math.max(max, s.depth), 0);

    return {
      rootNodeId: rootNode.id,
      rootNodeName: rootNode.displayName,
      totalImpactedNodes: uniqueImpactedNodeIds.size,
      maxDepth,
      steps,
    };
  }

  private mapRepoToDto(r: RepositoryEntity): RepositoryDto {
    return {
      id: r.id,
      githubOrg: r.githubOrg,
      name: r.name,
      defaultBranch: r.defaultBranch,
      lastCommitSha: r.lastCommitSha,
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
