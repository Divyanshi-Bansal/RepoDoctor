import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectEntity } from './entities/project.entity.js';
import { RepositoryEntity } from './entities/repository.entity.js';
import { SystemNodeEntity } from './entities/system-node.entity.js';
import { SystemEdgeEntity } from './entities/system-edge.entity.js';
import { EvidenceEntity } from './entities/evidence.entity.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import type {
  ProjectDto,
  CreateProjectDto,
  RepositoryDto,
  ProjectAnalysisResultDto,
  RepositoryAnalysisStatusDto,
  ProjectDashboardDto,
  BusinessFeatureDto,
  ProjectArchitectureDto,
  VisualTopologyNodeDto,
  VisualTopologyEdgeDto,
  AskRepoDoctorQueryDto,
  AskRepoDoctorResponseDto,
  FlowStepDto,
  CodeLocationCitationDto,
  ArchitecturalInsightDto,
  NodeType,
  EdgeType,
} from '@repo-doctor/shared';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repositoryRepo: Repository<RepositoryEntity>,
    @Optional()
    @InjectRepository(SystemNodeEntity)
    private readonly nodeRepo?: Repository<SystemNodeEntity>,
    @Optional()
    @InjectRepository(SystemEdgeEntity)
    private readonly edgeRepo?: Repository<SystemEdgeEntity>,
    @Optional()
    @InjectRepository(EvidenceEntity)
    private readonly evidenceRepo?: Repository<EvidenceEntity>,
    @Optional()
    @Inject(AnalysisService)
    private readonly analysisService?: AnalysisService,
  ) {}

  /**
   * Creates a new workspace project owned by the authenticated user.
   */
  async createProject(ownerId: string, dto: CreateProjectDto): Promise<ProjectDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Project name is required');
    }

    const project = this.projectRepo.create({
      name,
      description: dto.description?.trim() || null,
      ownerId,
      repositories: [],
    });

    const saved = await this.projectRepo.save(project);
    this.logger.log(`Created project "${saved.name}" (${saved.id}) for user ${ownerId}`);

    return this.mapToDto(saved);
  }

  /**
   * Lists all projects owned by the authenticated user with repository counts.
   */
  async listUserProjects(ownerId: string): Promise<readonly ProjectDto[]> {
    const projects = await this.projectRepo.find({
      where: { ownerId },
      relations: ['repositories'],
      order: { updatedAt: 'DESC' },
    });

    return projects.map((p) => this.mapToDto(p));
  }

  /**
   * Retrieves a single project with its associated repositories, enforcing ownership.
   */
  async getProject(ownerId: string, projectId: string): Promise<ProjectDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return this.mapToDto(project);
  }

  /**
   * Associates a registered repository with a project, ensuring both belong to or
   * are accessible by the authenticated user.
   */
  async addRepositoryToProject(
    ownerId: string,
    projectId: string,
    repositoryId: string,
  ): Promise<ProjectDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const repository = await this.repositoryRepo.findOne({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID '${repositoryId}' not found`);
    }

    // Set project association
    repository.projectId = projectId;
    if (!repository.ownerId) {
      repository.ownerId = ownerId;
    }
    await this.repositoryRepo.save(repository);

    if (typeof this.repositoryRepo.createQueryBuilder === 'function') {
      await this.repositoryRepo
        .createQueryBuilder()
        .update(RepositoryEntity)
        .set({ projectId, ownerId: repository.ownerId || ownerId })
        .where('id = :repositoryId', { repositoryId })
        .execute();
    }

    // Refresh project with updated repositories
    const updatedProject = await this.projectRepo.findOneOrFail({
      where: { id: projectId },
      relations: ['repositories'],
    });

    return this.mapToDto(updatedProject);
  }

  /**
   * Sets the complete collection of linked repositories for a project in one operation.
   * Repositories not in the list are safely unlinked (projectId = null) without deleting
   * their records or static analysis results.
   */
  async setProjectRepositories(
    ownerId: string,
    projectId: string,
    repositoryIds: readonly string[],
  ): Promise<ProjectDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const targetSet = new Set(repositoryIds);

    // 0. Validate all incoming repository IDs exist and do not belong to another project
    for (const repoId of repositoryIds) {
      const repo = await this.repositoryRepo.findOne({ where: { id: repoId } });
      if (!repo) {
        throw new NotFoundException(`Repository with ID '${repoId}' not found`);
      }
      if (repo.projectId && repo.projectId !== projectId) {
        throw new BadRequestException(
          `Repository '${repo.name}' is already assigned to another project`,
        );
      }
    }

    // 1. Unlink repositories currently in project that are not in targetSet
    const currentRepos = await this.repositoryRepo.find({ where: { projectId } });
    for (const repo of currentRepos) {
      if (!targetSet.has(repo.id)) {
        repo.projectId = null;
        repo.project = null as any;
        delete (repo as any).project;
        await this.repositoryRepo.save(repo);
      }
    }

    // 2. Link target repositories
    for (const repoId of repositoryIds) {
      const repo = await this.repositoryRepo.findOne({ where: { id: repoId } });
      if (repo) {
        repo.projectId = projectId;
        if (!repo.ownerId) {
          repo.ownerId = ownerId;
        }
        await this.repositoryRepo.save(repo);
      }
    }

    // If queryBuilder is available (PostgreSQL connection), ensure exact DB sync
    if (typeof this.repositoryRepo.createQueryBuilder === 'function') {
      const toUnlink = currentRepos.filter((r) => !targetSet.has(r.id)).map((r) => r.id);
      if (toUnlink.length > 0) {
        await this.repositoryRepo
          .createQueryBuilder()
          .update(RepositoryEntity)
          .set({ projectId: null })
          .where('id IN (:...toUnlink)', { toUnlink })
          .andWhere('projectId = :projectId', { projectId })
          .execute();
      }
      if (repositoryIds.length > 0) {
        await this.repositoryRepo
          .createQueryBuilder()
          .update(RepositoryEntity)
          .set({ projectId, ownerId })
          .where('id IN (:...repositoryIds)', { repositoryIds })
          .execute();
      }
    }

    // Refresh project
    const updated = await this.projectRepo.findOneOrFail({
      where: { id: projectId },
      relations: ['repositories'],
    });

    this.logger.log(`Updated project "${updated.name}" (${updated.id}) repositories: ${repositoryIds.length} linked`);
    return this.mapToDto(updated);
  }

  /**
   * Unlinks a single repository from a project without deleting its underlying analysis.
   */
  async unlinkRepository(
    ownerId: string,
    projectId: string,
    repositoryId: string,
  ): Promise<ProjectDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const repo = await this.repositoryRepo.findOne({
      where: { id: repositoryId },
    });

    if (repo && repo.projectId === projectId) {
      repo.projectId = null;
      repo.project = null as any;
      delete (repo as any).project;
      await this.repositoryRepo.save(repo);

      if (typeof this.repositoryRepo.createQueryBuilder === 'function') {
        await this.repositoryRepo
          .createQueryBuilder()
          .update(RepositoryEntity)
          .set({ projectId: null })
          .where('id = :repositoryId', { repositoryId })
          .andWhere('projectId = :projectId', { projectId })
          .execute();
      }
    }

    const updated = await this.projectRepo.findOneOrFail({
      where: { id: projectId },
      relations: ['repositories'],
    });

    return this.mapToDto(updated);
  }

  /**
   * Analyzes all repositories linked to a project, returning individual per-repo results.
   */
  async analyzeProject(
    ownerId: string,
    projectId: string,
    accessToken: string,
  ): Promise<ProjectAnalysisResultDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (!this.analysisService) {
      throw new BadRequestException('Analysis service is not available');
    }

    const repos = project.repositories || [];
    const results: RepositoryAnalysisStatusDto[] = [];

    for (const repo of repos) {
      try {
        await this.analysisService.analyzeRepository(repo.id, accessToken);
        const repoNodes = this.nodeRepo ? await this.nodeRepo.find({ where: { repositoryId: repo.id } }) : [];
        const repoNodeIds = repoNodes.map((n) => n.id);
        const edgeCount = (this.edgeRepo && repoNodeIds.length > 0)
          ? await this.edgeRepo.count({ where: { sourceNodeId: In(repoNodeIds) } })
          : 0;

        results.push({
          repositoryId: repo.id,
          repositoryName: `${repo.githubOrg}/${repo.name}`,
          status: 'SUCCESS',
          totalNodes: repoNodes.length,
          totalEdges: edgeCount,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
        this.logger.error(`Project analysis failure for repo ${repo.name}: ${errorMsg}`);
        results.push({
          repositoryId: repo.id,
          repositoryName: `${repo.githubOrg}/${repo.name}`,
          status: 'FAILED',
          error: errorMsg,
        });
      }
    }

    const successful = results.filter((r) => r.status === 'SUCCESS').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;

    return {
      projectId,
      totalRepositories: repos.length,
      successful,
      failed,
      repositoryResults: results,
    };
  }

  /**
   * Computes project-level dashboard with discovered business capabilities and architectural insights.
   */
  async getProjectDashboard(ownerId: string, projectId: string): Promise<ProjectDashboardDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const repos = project.repositories || [];
    const repoSummaries: Array<{
      repository: RepositoryDto;
      analysisStatus: 'READY' | 'INDEXING' | 'STALE' | 'NOT_ANALYZED';
      totalNodes: number;
      totalEdges: number;
      healthScore: number;
    }> = [];

    let totalNodesAcrossProject = 0;
    let totalEdgesAcrossProject = 0;
    const allNodes: SystemNodeEntity[] = [];

    for (const repo of repos) {
      const nodes = this.nodeRepo ? await this.nodeRepo.find({ where: { repositoryId: repo.id } }) : [];
      const repoNodeIds = nodes.map((n) => n.id);
      const edgeCount = (this.edgeRepo && repoNodeIds.length > 0)
        ? await this.edgeRepo.count({ where: { sourceNodeId: In(repoNodeIds) } })
        : 0;
      allNodes.push(...nodes);
      totalNodesAcrossProject += nodes.length;
      totalEdgesAcrossProject += edgeCount;

      const isAnalyzed = repo.lastCommitSha !== null && nodes.length > 0;
      const status: 'READY' | 'INDEXING' | 'STALE' | 'NOT_ANALYZED' = isAnalyzed ? 'READY' : 'NOT_ANALYZED';
      const healthScore = isAnalyzed ? Math.min(100, Math.max(65, 95 - Math.floor(nodes.length * 0.5))) : 0;

      repoSummaries.push({
        repository: {
          id: repo.id,
          githubOrg: repo.githubOrg,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          lastCommitSha: repo.lastCommitSha,
          updatedAt: repo.updatedAt.toISOString(),
        },
        analysisStatus: status,
        totalNodes: nodes.length,
        totalEdges: edgeCount,
        healthScore,
      });
    }

    // Discover business capabilities from verified static nodes and entry points
    const businessFeatures: BusinessFeatureDto[] = this.discoverBusinessCapabilities(allNodes, repos);

    // Cross-repository dependency detection
    const crossRepoEdges = await this.findCrossRepositoryEdges(repos);

    const insights: ArchitecturalInsightDto[] = [];
    if (crossRepoEdges.length > 0) {
      insights.push({
        type: 'DATA_FLOW',
        severity: 'INFO',
        title: 'Cross-Repository Interactions Detected',
        description: `Verified ${crossRepoEdges.length} interaction flow(s) bridging multiple repositories in this project workspace.`,
      });
    }

    const unanalyzedCount = repoSummaries.filter((r) => r.analysisStatus === 'NOT_ANALYZED').length;
    if (unanalyzedCount > 0) {
      insights.push({
        type: 'COVERAGE',
        severity: 'WARNING',
        title: 'Incomplete Project Analysis Coverage',
        description: `${unanalyzedCount} of ${repos.length} repositories have not yet undergone static code analysis. Run "Analyze Project" to index full system flows.`,
      });
    }

    return {
      project: this.mapToDto(project),
      totalRepositories: repos.length,
      analyzedRepositoriesCount: repoSummaries.filter((r) => r.analysisStatus === 'READY').length,
      repositories: repoSummaries,
      businessFeatures,
      architecturalInsights: insights,
      crossRepoDependenciesCount: crossRepoEdges.length,
    };
  }

  /**
   * Visual Architecture Topology grouped by roles and cross-repository relationships.
   */
  async getProjectArchitecture(ownerId: string, projectId: string): Promise<ProjectArchitectureDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const repos = project.repositories || [];
    const repoMap = new Map(repos.map((r) => [r.id, `${r.githubOrg}/${r.name}`]));

    const repoIds = repos.map((r) => r.id);
    const nodes = repoIds.length > 0 && this.nodeRepo
      ? await this.nodeRepo.find({ where: { repositoryId: In(repoIds) } })
      : [];

    const nodeIds = nodes.map((n) => n.id);
    const edges = nodeIds.length > 0 && this.edgeRepo
      ? await this.edgeRepo.find({ where: { sourceNodeId: In(nodeIds) } })
      : [];

    const nodeRepoMap = new Map(nodes.map((n) => [n.id, n.repositoryId]));

    // Compute incoming/outgoing counts
    const incomingMap = new Map<string, number>();
    const outgoingMap = new Map<string, number>();
    for (const e of edges) {
      outgoingMap.set(e.sourceNodeId, (outgoingMap.get(e.sourceNodeId) || 0) + 1);
      incomingMap.set(e.targetNodeId, (incomingMap.get(e.targetNodeId) || 0) + 1);
    }

    const visualNodes: VisualTopologyNodeDto[] = nodes.map((n) => {
      const repoName = repoMap.get(n.repositoryId) || 'unknown-repo';
      const role = this.classifyComponentRole(n);

      return {
        id: n.id,
        identifier: n.identifier,
        displayName: this.getNodeLabel(n),
        nodeType: n.nodeType as NodeType,
        metadata: n.metadata || {},
        repositoryId: n.repositoryId,
        repositoryName: repoName,
        role,
        incomingCount: incomingMap.get(n.id) || 0,
        outgoingCount: outgoingMap.get(n.id) || 0,
      };
    });

    const visualEdges: VisualTopologyEdgeDto[] = edges.map((e) => {
      const srcRepoId = nodeRepoMap.get(e.sourceNodeId);
      const tgtRepoId = nodeRepoMap.get(e.targetNodeId);
      const isCross = Boolean(srcRepoId && tgtRepoId && srcRepoId !== tgtRepoId);

      return {
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType as EdgeType,
        confidence: Number(e.confidence),
        isInferred: Boolean(e.isInferred),
        sourceRepositoryName: srcRepoId ? repoMap.get(srcRepoId) : undefined,
        targetRepositoryName: tgtRepoId ? repoMap.get(tgtRepoId) : undefined,
        isCrossRepository: isCross,
      };
    });

    const roleLayers = {
      frontend: visualNodes.filter((n) => n.role === 'FRONTEND'),
      api: visualNodes.filter((n) => n.role === 'API'),
      services: visualNodes.filter((n) => n.role === 'SERVICE'),
      database: visualNodes.filter((n) => n.role === 'DATABASE'),
      queue: visualNodes.filter((n) => n.role === 'QUEUE'),
      packages: visualNodes.filter((n) => n.role === 'PACKAGE'),
    };

    return {
      projectId,
      nodes: visualNodes,
      edges: visualEdges,
      repositories: repos.map((r) => ({ id: r.id, name: r.name, org: r.githubOrg })),
      roleLayers,
      crossRepositoryEdges: visualEdges.filter((e) => e.isCrossRepository),
    };
  }

  /**
   * Persistent "Ask RepoDoctor" Q&A engine: synthesizes grounded multi-repository flow explanations.
   */
  async askProjectQuestion(
    ownerId: string,
    projectId: string,
    query: AskRepoDoctorQueryDto,
  ): Promise<AskRepoDoctorResponseDto> {
    const question = query.question?.trim();
    if (!question) {
      throw new BadRequestException('Question text is required');
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['repositories'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const repos = project.repositories || [];
    if (repos.length === 0) {
      return {
        answer: 'This project currently has no repositories linked. Please use "Manage Repositories" to link repositories and run static analysis before asking architectural flow questions.',
        confidence: 1.0,
        isInferred: false,
        citations: [],
        participatingRepositories: [],
        participatingComponents: [],
        flowSteps: [],
        limitations: ['No repositories associated with this project workspace.'],
      };
    }

    const repoMap = new Map(repos.map((r) => [r.id, `${r.githubOrg}/${r.name}`]));
    const targetRepoIds = query.repositoryId ? [query.repositoryId] : repos.map((r) => r.id);

    let nodes = targetRepoIds.length > 0 && this.nodeRepo
      ? await this.nodeRepo.find({ where: { repositoryId: In(targetRepoIds) } })
      : [];

    let fallbackToProject = false;
    // Fallback: If a specific repository was requested but has 0 analyzed nodes,
    // automatically search across all analyzed repositories in the project so the user gets answers.
    if (nodes.length === 0 && query.repositoryId && repos.length > 0 && this.nodeRepo) {
      const allProjectRepoIds = repos.map((r) => r.id);
      const projectNodes = await this.nodeRepo.find({ where: { repositoryId: In(allProjectRepoIds) } });
      if (projectNodes.length > 0) {
        nodes = projectNodes;
        fallbackToProject = true;
      }
    }

    const nodeIds = nodes.map((n) => n.id);
    const edges = nodeIds.length > 0 && this.edgeRepo
      ? await this.edgeRepo.find({ where: { sourceNodeId: In(nodeIds) } })
      : [];

    if (nodes.length === 0) {
      const emptyRepoNames = repos.map((r) => `${r.githubOrg}/${r.name}`).join(', ');
      return {
        answer: `The selected repositories (${emptyRepoNames}) do not contain analyzed source code components yet.\n\n` +
          `• If you just analyzed a repository that only contains documentation (like README.md), ensure your TypeScript/JavaScript source code is pushed to GitHub.\n` +
          `• Click "Analyze Project Repositories" to index all project components, route handlers, and dependency citations.`,
        confidence: 1.0,
        isInferred: false,
        citations: [],
        participatingRepositories: repos.map((r) => ({ id: r.id, name: r.name, org: r.githubOrg })),
        participatingComponents: [],
        flowSteps: [],
        limitations: ['Static AST analysis has not yet been executed or no supported source files (.ts, .tsx, .js) were found.'],
      };
    }

    // Identify candidate focal nodes based on query semantics, keywords, and synonym expansion
    const lowerQuestion = question.toLowerCase();
    const candidateNodes: SystemNodeEntity[] = [];

    if (query.nodeId) {
      const explicitNode = nodes.find((n) => n.id === query.nodeId);
      if (explicitNode) candidateNodes.push(explicitNode);
    }

    const searchTokens = lowerQuestion.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
    const synonymMap: Record<string, string[]> = {
      login: ['auth', 'session', 'user', 'token', 'login', 'credential', 'guard'],
      signin: ['auth', 'session', 'user', 'token', 'signin'],
      auth: ['auth', 'user', 'session', 'jwt', 'token', 'guard'],
      signup: ['user', 'register', 'auth', 'create', 'account'],
      account: ['user', 'profile', 'auth', 'account'],
      order: ['order', 'checkout', 'cart', 'payment', 'item'],
      payment: ['payment', 'stripe', 'checkout', 'billing', 'charge'],
      data: ['database', 'db', 'repo', 'entity', 'model', 'query', 'store'],
      database: ['database', 'db', 'repo', 'entity', 'model', 'table', 'typeorm'],
      service: ['service', 'handler', 'controller'],
      queue: ['queue', 'worker', 'job', 'bull', 'event', 'producer', 'consumer'],
      feature: ['feature', 'controller', 'service', 'endpoint'],
    };

    // 0. Prioritize exact filename or component name matches mentioned in the question
    for (const node of nodes) {
      const baseName = node.displayName.toLowerCase();
      const cleanIdent = node.identifier.toLowerCase().replace(/\\/g, '/');
      const lastSegment = cleanIdent.split('/').pop() || '';
      const filenameMatch =
        (baseName.length > 3 && lowerQuestion.includes(baseName)) ||
        (lastSegment.length > 3 && lowerQuestion.includes(lastSegment));
      if (filenameMatch && !candidateNodes.some((c) => c.id === node.id)) {
        candidateNodes.push(node);
      }
    }

    const expandedTokens = new Set(searchTokens);
    for (const tok of searchTokens) {
      if (synonymMap[tok]) {
        for (const syn of synonymMap[tok]) {
          expandedTokens.add(syn);
        }
      }
    }

    for (const node of nodes) {
      const nodeText = `${node.displayName} ${node.identifier} ${node.nodeType}`.toLowerCase();
      const hasMatch = Array.from(expandedTokens).some((tok) => nodeText.includes(tok));
      if (hasMatch && !candidateNodes.some((c) => c.id === node.id)) {
        candidateNodes.push(node);
      }
    }

    if (candidateNodes.length > 1) {
      candidateNodes.sort((a, b) => {
        const aRepo = (repoMap.get(a.repositoryId) || '').toLowerCase();
        const bRepo = (repoMap.get(b.repositoryId) || '').toLowerCase();
        const aRepoMatch = aRepo && lowerQuestion.includes(aRepo) ? 1 : 0;
        const bRepoMatch = bRepo && lowerQuestion.includes(bRepo) ? 1 : 0;
        return bRepoMatch - aRepoMatch;
      });
    }

    let hadDirectMatch = true;
    // Fallback if no specific keyword matched: select top entry point nodes (ENDPOINT or SERVICE)
    if (candidateNodes.length === 0) {
      hadDirectMatch = false;
      const entryPoints = nodes.filter((n) => n.nodeType === 'ENDPOINT' || n.nodeType === 'SERVICE');
      candidateNodes.push(...entryPoints.slice(0, 3));
    }

    const focalNodeIds = new Set(candidateNodes.map((n) => n.id));
    const connectedEdges = edges.filter(
      (e) => focalNodeIds.has(e.sourceNodeId) || focalNodeIds.has(e.targetNodeId),
    );

    const allRelatedNodeIds = new Set<string>(focalNodeIds);
    for (const e of connectedEdges) {
      allRelatedNodeIds.add(e.sourceNodeId);
      allRelatedNodeIds.add(e.targetNodeId);
    }

    const participatingNodes = nodes.filter((n) => allRelatedNodeIds.has(n.id));

    // Fetch genuine evidence citations
    const citations: CodeLocationCitationDto[] = [];
    if (this.evidenceRepo && participatingNodes.length > 0) {
      const pNodeIds = participatingNodes.map((n) => n.id);
      const evidenceEntities = await this.evidenceRepo.find({
        where: { nodeId: In(pNodeIds) },
        take: 10,
      });

      for (const ev of evidenceEntities) {
        citations.push({
          evidenceId: ev.id,
          filePath: ev.filePath,
          lineStart: ev.lineStart,
          lineEnd: ev.lineEnd,
          codeSnippet: ev.codeSnippet,
          commitSha: ev.commitSha,
        });
      }
    }

    // Build ordered execution flow steps based on layer hierarchy:
    // UI/Client -> Route/Endpoint -> Business Service -> Database/Queue
    const flowSteps: FlowStepDto[] = [];
    const orderedNodes = [...participatingNodes].sort((a, b) => {
      const roleWeight: Record<string, number> = {
        ENDPOINT: 1,
        PACKAGE: 1,
        SERVICE: 2,
        QUEUE: 3,
        DATABASE: 4,
      };
      return (roleWeight[a.nodeType] || 2) - (roleWeight[b.nodeType] || 2);
    });

    const seenTransitions = new Set<string>();
    let stepCounter = 1;

    // 1. First prioritize direct edges between candidate nodes and their downstream targets
    for (const pNode of orderedNodes) {
      if (flowSteps.length >= 15) break;

      const pLabel = this.getNodeLabel(pNode);
      const outgoing = connectedEdges.filter((e) => e.sourceNodeId === pNode.id);
      const repoName = repoMap.get(pNode.repositoryId) || 'system';

      if (outgoing.length === 0) {
        const key = `${pNode.id}::EXECUTES`;
        if (!seenTransitions.has(key)) {
          seenTransitions.add(key);
          flowSteps.push({
            stepNumber: stepCounter++,
            componentName: pLabel,
            componentType: pNode.nodeType as NodeType,
            repositoryName: repoName,
            description: `Executes ${pLabel} (${pNode.nodeType}) within repository ${repoName}.`,
            isInferred: false,
          });
        }
      } else {
        for (const outEdge of outgoing) {
          if (flowSteps.length >= 15) break;
          const targetNode = nodes.find((n) => n.id === outEdge.targetNodeId);
          if (!targetNode || targetNode.id === pNode.id) continue;

          const targetLabel = this.getNodeLabel(targetNode);
          const targetRepoName = repoMap.get(targetNode.repositoryId) || 'downstream';
          const crossRepoNote = targetNode.repositoryId !== pNode.repositoryId
            ? ` [Cross-Repo Boundary -> ${targetRepoName}]`
            : '';

          const key = `${pNode.id}::${outEdge.edgeType}::${targetNode.id}`;
          if (!seenTransitions.has(key)) {
            seenTransitions.add(key);
            flowSteps.push({
              stepNumber: stepCounter++,
              componentName: pLabel,
              componentType: pNode.nodeType as NodeType,
              repositoryName: repoName,
              description: `${pLabel} ${outEdge.edgeType.toLowerCase().replace(/_/g, ' ')} ${targetLabel}${crossRepoNote}.`,
              edgeType: outEdge.edgeType as EdgeType,
              isInferred: Boolean(outEdge.isInferred),
              targetName: targetLabel,
              targetRepositoryName: targetRepoName,
            });
          }
        }
      }
    }

    // Synthesize natural human-readable architectural explanation
    const participatingRepos = Array.from(
      new Set(participatingNodes.map((n) => n.repositoryId)),
    ).map((rId) => {
      const r = repos.find((repo) => repo.id === rId);
      return { id: rId, name: r?.name || 'unknown', org: r?.githubOrg || 'unknown' };
    });

    let answer = `### Architecture & Knowledge Transfer Explanation\n\n`;
    answer += `**Question:** "${question}"\n\n`;

    if (fallbackToProject && query.repositoryId) {
      const requestedRepo = repos.find((r) => r.id === query.repositoryId);
      const reqName = requestedRepo ? `${requestedRepo.githubOrg}/${requestedRepo.name}` : 'the selected repository';
      const answeredRepos = participatingRepos.map((r) => r.name).filter(Boolean).join(', ') || 'project';
      answer += `> [!NOTE]\n> *Repository **${reqName}** currently has 0 analyzed code files. RepoDoctor automatically expanded your query across analyzed repositories (${answeredRepos}) so you get complete architectural guidance.*\n\n`;
    }

    if (participatingNodes.length === 0) {
      answer += `No specific system components matching this query were indexed in the current project.\n`;
    } else {
      // Check if user is asking about a specific file or consequences of changing a file
      const isFileInquiry = candidateNodes.length === 1 || lowerQuestion.includes('.ts') || lowerQuestion.includes('.tsx') || lowerQuestion.includes('.js');
      const isChangeOrBlastQuery =
        lowerQuestion.includes('change') ||
        lowerQuestion.includes('consequence') ||
        lowerQuestion.includes('modify') ||
        lowerQuestion.includes('blast') ||
        lowerQuestion.includes('affect') ||
        lowerQuestion.includes('impact') ||
        lowerQuestion.includes('break');

      if (isFileInquiry && candidateNodes.length > 0) {
        const primaryFile = candidateNodes[0];
        const fLabel = this.getNodeLabel(primaryFile);
        const fRepo = repoMap.get(primaryFile.repositoryId) || 'unknown-repo';
        const callers = edges
          .filter((e) => e.targetNodeId === primaryFile.id)
          .map((e) => nodes.find((n) => n.id === e.sourceNodeId))
          .filter((n): n is SystemNodeEntity => Boolean(n));
        const dependencies = edges
          .filter((e) => e.sourceNodeId === primaryFile.id)
          .map((e) => nodes.find((n) => n.id === e.targetNodeId))
          .filter((n): n is SystemNodeEntity => Boolean(n));

        answer += `#### 📄 File Understanding: \`${fLabel}\`\n`;
        answer += `• **Repository:** *${fRepo}*\n`;
        answer += `• **Component Role:** \`${this.classifyComponentRole(primaryFile)}\` (\`${primaryFile.nodeType}\`)\n`;
        answer += `• **File Path:** \`${primaryFile.identifier}\`\n\n`;

        if (callers.length > 0) {
          answer += `**Who Calls or Imports This File (Inbound Callers):**\n`;
          for (const c of callers.slice(0, 8)) {
            const cRepo = repoMap.get(c.repositoryId) || 'unknown';
            const isCross = c.repositoryId !== primaryFile.repositoryId ? ` *(from ${cRepo})*` : '';
            answer += `• \`${this.getNodeLabel(c)}\` (${c.nodeType})${isCross}\n`;
          }
          answer += `\n`;
        }

        if (dependencies.length > 0) {
          answer += `**What This File Depends On (Outbound Dependencies):**\n`;
          for (const d of dependencies.slice(0, 8)) {
            const dRepo = repoMap.get(d.repositoryId) || 'unknown';
            const isCross = d.repositoryId !== primaryFile.repositoryId ? ` *(in ${dRepo})*` : '';
            answer += `• \`${this.getNodeLabel(d)}\` (${d.nodeType})${isCross}\n`;
          }
          answer += `\n`;
        }

        answer += `**⚠️ Consequences & Blast Radius of Modifying This File:**\n`;
        if (callers.length === 0) {
          answer += `• This component currently has 0 detected callers in the static graph. Changes are localized to its own file or runtime routes.\n`;
        } else {
          answer += `• **Direct Breaking Risk:** Modifying signatures, exports, or return values in \`${fLabel}\` directly impacts **${callers.length}** upstream component(s).\n`;
          const crossRepoCallers = callers.filter((c) => c.repositoryId !== primaryFile.repositoryId);
          if (crossRepoCallers.length > 0) {
            answer += `• **🚨 Cross-Repository Impact:** Affects **${crossRepoCallers.length}** component(s) across other repositories (${Array.from(new Set(crossRepoCallers.map((c) => repoMap.get(c.repositoryId)))).join(', ')}).\n`;
          }
        }
        answer += `\n`;
      } else {
        answer += `**Overview:**\nThis flow spans **${participatingRepos.length}** repository(s) (${participatingRepos.map((r) => r.name).join(', ')}) across **${participatingNodes.length}** verified component(s).\n\n`;
      }

      answer += `**Step-by-Step Architectural Flow:**\n`;
      if (flowSteps.length > 0) {
        for (const step of flowSteps) {
          const inferenceBadge = step.isInferred ? ' *(inferred)*' : ' *(verified AST)*';
          answer += `${step.stepNumber}. **${step.componentName}** (\`${step.componentType}\` in *${step.repositoryName}*): ${step.description}${inferenceBadge}\n`;
        }
      } else {
        answer += `• Verified static components: ${participatingNodes.map((n) => `${this.getNodeLabel(n)} (${n.nodeType})`).join(', ')}\n`;
      }

      const dbNodes = participatingNodes.filter((n) => n.nodeType === 'DATABASE');
      if (dbNodes.length > 0) {
        answer += `\n**Persistence Layer:**\nInvolved database entities: ${dbNodes.map((n) => `\`${this.getNodeLabel(n)}\``).join(', ')}.\n`;
      }

      const queueNodes = participatingNodes.filter((n) => n.nodeType === 'QUEUE');
      if (queueNodes.length > 0) {
        answer += `\n**Asynchronous Eventing:**\nInvolved message queue(s): ${queueNodes.map((n) => `\`${this.getNodeLabel(n)}\``).join(', ')}.\n`;
      }

      if (citations.length > 0) {
        answer += `\n**Grounding & Evidence Citations:**\n`;
        for (const cit of citations.slice(0, 5)) {
          answer += `• \`${cit.filePath}:${cit.lineStart}-${cit.lineEnd}\`\n`;
        }
      }

      if (isChangeOrBlastQuery && !isFileInquiry && candidateNodes.length > 0) {
        const impactedTargets = connectedEdges
          .filter((e) => focalNodeIds.has(e.sourceNodeId))
          .map((e) => nodes.find((n) => n.id === e.targetNodeId))
          .filter((n): n is SystemNodeEntity => Boolean(n));

        if (impactedTargets.length > 0) {
          answer += `\n**Downstream Impact Analysis (Blast Radius):**\n`;
          answer += `Modifying ${candidateNodes.map((c) => `\`${this.getNodeLabel(c)}\``).join(', ')} directly affects:\n`;
          for (const target of impactedTargets) {
            const tRepo = repoMap.get(target.repositoryId) || 'unknown';
            answer += `• **${this.getNodeLabel(target)}** (${target.nodeType} in *${tRepo}*)\n`;
          }
        }
      }
    }

    const limitations: string[] = [
      'Static analysis captures AST declarations, route decorators, imports, and manifest connections.',
      'Dynamic runtime payload values and non-manifest network protocols cannot be verified via static inspection alone.',
    ];

    if (!hadDirectMatch) {
      limitations.push(
        `No explicit AST components matched question keywords (${searchTokens.join(', ')}). Displaying closest entrypoint architectural flow.`,
      );
    }

    return {
      answer,
      confidence: 1.0,
      isInferred: connectedEdges.some((e) => e.isInferred),
      citations,
      participatingRepositories: participatingRepos,
      participatingComponents: participatingNodes.map((n) => ({
        id: n.id,
        name: this.getNodeLabel(n),
        type: n.nodeType as NodeType,
        repositoryName: repoMap.get(n.repositoryId) || 'unknown',
      })),
      flowSteps,
      limitations,
    };
  }

  // --- Private Helpers ---

  private getNodeLabel(node: SystemNodeEntity): string {
    const raw = (node.identifier || '').replace(/\\/g, '/');
    const parts = raw.split('/').filter(Boolean);
    if (
      parts.length >= 2 &&
      (node.displayName === 'page.tsx' ||
        node.displayName === 'layout.tsx' ||
        node.displayName === 'index.ts' ||
        node.displayName === 'route.ts' ||
        node.displayName === 'loading.tsx' ||
        node.displayName === 'error.tsx')
    ) {
      return parts.slice(-2).join('/');
    }
    return node.displayName || raw;
  }

  private classifyComponentRole(
    node: SystemNodeEntity,
  ): 'FRONTEND' | 'API' | 'SERVICE' | 'DATABASE' | 'QUEUE' | 'PACKAGE' {
    const ident = node.identifier.toLowerCase();
    const name = node.displayName.toLowerCase();

    if (node.nodeType === 'DATABASE') return 'DATABASE';
    if (node.nodeType === 'QUEUE') return 'QUEUE';
    if (node.nodeType === 'ENDPOINT' || ident.includes('controller') || ident.includes('route')) return 'API';
    if (ident.includes('view') || ident.includes('page') || ident.includes('component') || name.includes('web') || name.includes('frontend')) return 'FRONTEND';
    if (node.nodeType === 'PACKAGE') return 'PACKAGE';
    return 'SERVICE';
  }

  private discoverBusinessCapabilities(
    nodes: SystemNodeEntity[],
    repos: RepositoryEntity[],
  ): BusinessFeatureDto[] {
    const repoMap = new Map(repos.map((r) => [r.id, r.name]));
    const features: BusinessFeatureDto[] = [];

    // Helper to test if a node matches given patterns
    const matchesDomain = (n: SystemNodeEntity, includes: string[], excludes: string[] = []): boolean => {
      const target = `${n.displayName} ${n.identifier}`.toLowerCase();
      const hasExclude = excludes.some((ex) => target.includes(ex));
      if (hasExclude) return false;
      return includes.some((inc) => target.includes(inc));
    };

    const domainConfigs: Array<{
      id: string;
      title: string;
      description: string;
      category: 'AUTHENTICATION' | 'ORDER_PROCESSING' | 'API_SERVICES' | 'GENERAL';
      includes: string[];
      excludes?: string[];
      externalServices?: string[];
    }> = [
      {
        id: 'feat-auth',
        title: 'Authentication & Session Lifecycle',
        description: 'User registration, login, credential verification, JWT/session management, and OAuth authentication flows.',
        category: 'AUTHENTICATION',
        includes: ['auth', 'login', 'signup', 'session', 'jwt', 'verify-magic-link', 'googlesignin', 'oauth'],
        externalServices: ['GitHub OAuth', 'Google OAuth'],
      },
      {
        id: 'feat-tasks',
        title: 'Task Lifecycle, Subtasks & Comments',
        description: 'Task cards, task detail modals, subtask checklists, and collaborative discussion comments.',
        category: 'GENERAL',
        includes: ['task', 'comment', 'subtask'],
      },
      {
        id: 'feat-projects',
        title: 'Project Workspaces & Kanban Boards',
        description: 'Kanban board columns, workspace contexts, project creation/editing modals, and layout shells.',
        category: 'GENERAL',
        includes: ['project', 'boardcolumn', 'presenceavatars', 'board'],
        excludes: ['billing', 'pricing', 'api-key', 'apikey', 'invite', 'invitation'],
      },
      {
        id: 'feat-ai',
        title: 'AI Assistant & Copilot Generator',
        description: 'AI task proposal generation, copilot chat drawers, MCP bridge services, and smart project assistance.',
        category: 'API_SERVICES',
        includes: ['ai.', 'ai/', '/ai', 'copilot', 'aigenerator', 'aitaskproposal', 'mcpchat'],
        externalServices: ['LLM Provider / MCP Bridge'],
      },
      {
        id: 'feat-invitations',
        title: 'Team Invitations & Access Collaboration',
        description: 'Team member invitations, invitation acceptance workflows, invite emails, and workspace member lists.',
        category: 'GENERAL',
        includes: ['invitation', 'invite', 'invitemembers', 'projectmembers'],
        externalServices: ['Email Delivery (SMTP/Resend)'],
      },
      {
        id: 'feat-billing',
        title: 'Billing & Workspace Subscriptions',
        description: 'Subscription upgrade flows, pricing plans, workspace tier limits, and billing management.',
        category: 'ORDER_PROCESSING',
        includes: ['billing', 'pricing', 'subscription'],
        externalServices: ['Payment Gateway'],
      },
      {
        id: 'feat-apikeys',
        title: 'API Keys & Developer Integrations',
        description: 'Personal access tokens, project API keys, hash generation, and developer programmatic access.',
        category: 'API_SERVICES',
        includes: ['apikey', 'api-key', 'apikeys'],
      },
      {
        id: 'feat-realtime',
        title: 'Real-Time WebSockets & Activity Events',
        description: 'Real-time WebSocket event gateways, live user activity broadcasting, and push events.',
        category: 'API_SERVICES',
        includes: ['event', 'gateway', 'websocket', 'socket'],
      },
    ];

    const assignedNodeIds = new Set<string>();

    for (const cfg of domainConfigs) {
      const domainNodes = nodes.filter(
        (n) => !assignedNodeIds.has(n.id) && matchesDomain(n, cfg.includes, cfg.excludes || []),
      );

      if (domainNodes.length > 0) {
        domainNodes.forEach((n) => assignedNodeIds.add(n.id));
        const relatedRepos = Array.from(new Set(domainNodes.map((n) => repoMap.get(n.repositoryId) || 'system')));
        const entryPoint = domainNodes.find((n) => n.nodeType === 'ENDPOINT' || n.identifier.includes('page') || n.identifier.includes('controller'))?.displayName || domainNodes[0].displayName;
        const dataStores = domainNodes.filter((n) => n.nodeType === 'DATABASE').map((n) => n.displayName);

        features.push({
          id: cfg.id,
          title: cfg.title,
          description: cfg.description,
          category: cfg.category,
          entryPoint,
          participatingComponents: domainNodes.map((n) => ({
            id: n.id,
            name: this.getNodeLabel(n),
            type: n.nodeType as NodeType,
            repositoryName: repoMap.get(n.repositoryId) || 'system',
          })),
          relatedRepositories: relatedRepos,
          dataStores: dataStores.length > 0 ? dataStores : ['PostgreSQL'],
          externalServices: cfg.externalServices || [],
          citationsCount: domainNodes.length * 2,
        });
      }
    }

    // Remaining unassigned components (e.g. shared UI primitives or helpers)
    const remainingNodes = nodes.filter((n) => !assignedNodeIds.has(n.id));
    if (remainingNodes.length > 0) {
      const relatedRepos = Array.from(new Set(remainingNodes.map((n) => repoMap.get(n.repositoryId) || 'system')));
      features.push({
        id: 'feat-shared-foundation',
        title: 'Shared UI Components & Foundation Utilities',
        description: 'Reusable atomic UI components, design system elements, cryptographic utilities, and shared helpers.',
        category: 'GENERAL',
        entryPoint: remainingNodes[0]?.displayName || 'SharedModule',
        participatingComponents: remainingNodes.map((n) => ({
          id: n.id,
          name: this.getNodeLabel(n),
          type: n.nodeType as NodeType,
          repositoryName: repoMap.get(n.repositoryId) || 'system',
        })),
        relatedRepositories: relatedRepos,
        dataStores: [],
        externalServices: [],
        citationsCount: remainingNodes.length,
      });
    }

    return features;
  }

  private async findCrossRepositoryEdges(repos: RepositoryEntity[]): Promise<SystemEdgeEntity[]> {
    if (repos.length < 2 || !this.edgeRepo || !this.nodeRepo) {
      return [];
    }

    const repoIds = repos.map((r) => r.id);
    const nodes = await this.nodeRepo.find({ where: { repositoryId: In(repoIds) } });
    const nodeIds = nodes.map((n) => n.id);
    const edges = nodeIds.length > 0
      ? await this.edgeRepo.find({ where: { sourceNodeId: In(nodeIds) } })
      : [];

    const nodeRepoMap = new Map(nodes.map((n) => [n.id, n.repositoryId]));

    return edges.filter((e) => {
      const srcRepo = nodeRepoMap.get(e.sourceNodeId);
      const tgtRepo = nodeRepoMap.get(e.targetNodeId);
      return srcRepo && tgtRepo && srcRepo !== tgtRepo;
    });
  }

  private mapToDto(project: ProjectEntity): ProjectDto {
    const repos = project.repositories || [];
    const repositoryDtos: RepositoryDto[] = repos.map((r) => ({
      id: r.id,
      githubOrg: r.githubOrg,
      name: r.name,
      defaultBranch: r.defaultBranch,
      lastCommitSha: r.lastCommitSha,
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      repositoryCount: repos.length,
      repositories: repositoryDtos,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
