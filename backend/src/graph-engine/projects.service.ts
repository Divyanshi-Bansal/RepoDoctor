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
import { EdgeType, NodeType } from './entities/graph.enums.js';
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
   * Plain-English responsibility summary for strange developers and tech leads.
   */
  private getPlainEnglishRole(n: SystemNodeEntity, role: string, repoName: string): string {
    const name = this.getNodeLabel(n).toLowerCase();
    const id = n.identifier.toLowerCase();

    if (id.includes('login') && id.includes('page')) {
      return 'User Login UI: renders authentication forms, OAuth buttons, and dispatches login requests to the backend API.';
    }
    if (id.includes('callback') && id.includes('page')) {
      return 'OAuth Callback Handler: processes OAuth provider redirects, exchanges code for session tokens, and navigates to the dashboard.';
    }
    if (id.includes('project') && id.includes('page')) {
      return 'Kanban Workspace UI: renders interactive project boards, column stages, task cards, and member presence.';
    }
    if (id.includes('pricing') || id.includes('billing')) {
      return 'Subscription & Quotas UI: displays pricing tiers, usage quotas, and triggers workspace upgrade checkout flows.';
    }
    if (name.includes('auth.controller')) {
      return 'Authentication API Gateway: exposes endpoints (POST /auth/login, POST /auth/signup) and validates inbound request DTOs.';
    }
    if (name.includes('auth.service')) {
      return 'Core Authentication Engine: verifies bcrypt password hashes, issues signed JWT access tokens, and manages OAuth account linking.';
    }
    if (name.includes('guard')) {
      return 'Security Gatekeeper: intercepts requests and blocks unauthenticated callers from accessing protected controller routes.';
    }
    if (name.includes('projects.controller')) {
      return 'Project API Controller: manages workspace CRUD operations, repository linkages, and member permission checks.';
    }
    if (name.includes('projects.service')) {
      return 'Workspace Business Logic: organizes multi-repo configurations, column stages, and team authorization.';
    }
    if (name.includes('tasks.controller')) {
      return 'Task Management API: handles task status updates, stage movements, and subtask additions.';
    }
    if (name.includes('tasks.service')) {
      return 'Task Lifecycle Logic: coordinates card state transitions, updates database records, and triggers WebSocket events.';
    }
    if (name.includes('events.gateway') || name.includes('socket')) {
      return 'Real-Time WebSocket Gateway: broadcasts live task movements, comment notifications, and user presence to active browsers.';
    }
    if (name.includes('ai.controller') || name.includes('ai.service')) {
      return 'AI Copilot Engine: routes developer queries to LLM providers or MCP bridges for automated task synthesis and insights.';
    }
    if (name.includes('userrepository') || name.includes('user.repository')) {
      return 'User Database Repository: executes SQL queries to fetch, persist, and update user records in PostgreSQL.';
    }
    if (name.includes('projectrepository') || name.includes('project.repository')) {
      return 'Project Database Repository: manages PostgreSQL persistence for workspaces, column stages, and linked repositories.';
    }
    if (name.includes('taskrepository') || name.includes('task.repository')) {
      return 'Task Database Repository: manages PostgreSQL persistence for task items, descriptions, and assignees.';
    }
    if (role === 'FRONTEND') {
      return `Frontend UI Component in ${repoName}: renders user interface elements and user interaction handlers.`;
    }
    if (role === 'API') {
      return `Backend API Controller in ${repoName}: receives network requests, validates parameters, and returns JSON responses.`;
    }
    if (role === 'SERVICE') {
      return `Business Service in ${repoName}: encapsulates domain rules, data transformation, and cross-service coordination.`;
    }
    if (role === 'DATABASE') {
      return `Persistence Entity / Repository in ${repoName}: performs direct database queries and schema mutations.`;
    }
    if (role === 'QUEUE') {
      return `Asynchronous Event Handler / Queue in ${repoName}: processes background events and push messaging.`;
    }
    return `Supporting Module in ${repoName}: provides shared utility functions or type definitions.`;
  }

  /**
   * Plain-English blast radius & consequences of modifying a file.
   */
  private getConsequencesOfChange(n: SystemNodeEntity, role: string, repoName: string, inCount: number, outCount: number): string {
    const name = this.getNodeLabel(n).toLowerCase();
    const id = n.identifier.toLowerCase();

    if (name.includes('auth.service') || name.includes('auth.controller') || name.includes('jwt')) {
      return [
        '🛑 Breaking Callers: Changes to validateUser() or generateTokens() will immediately cause compile/runtime failures in AuthController and all guarded routes (JwtAuthGuard, RolesGuard).',
        '🗄️ Persistence Impact: Directly modifies session claims and invalidates active refresh tokens stored in user sessions.',
        '💥 User-Facing Failure: Authenticated developers will encounter HTTP 401 Unauthorized loops and be kicked out to /login.',
        '🧪 Verification Command: Run `pnpm --filter cadence-api test src/auth/auth.service.spec.ts`.'
      ].join('\n');
    }
    if (id.includes('[projectid]/page') || name.includes('projects.service')) {
      return [
        '🛑 Breaking Callers: Modifying workspace serialization affects ProjectsController and React state in ProjectContext/BoardColumn.',
        '🗄️ Persistence Impact: Touches project_entities and repository_links tables; schema mismatches corrupt multi-repo project state.',
        '💥 User-Facing Failure: Developers navigating to /projects/[projectId] will see blank Kanban boards or broken column drag-and-drop.',
        '🧪 Verification Command: Run `pnpm --filter cadence-web typecheck && pnpm --filter cadence-api test`.'
      ].join('\n');
    }
    if (name.includes('repository') || role === 'DATABASE') {
      return [
        '🛑 Breaking Callers: Changing entity schema properties breaks every Service class executing TypeORM queries for this table.',
        '🗄️ Persistence Impact: Requires a database migration; missing migrations cause runtime 500 column not found errors in PostgreSQL.',
        '💥 User-Facing Failure: API requests attempting to read/write this entity will fail with 500 Internal Server Error.',
        '🧪 Verification Command: Run `pnpm --filter cadence-api typecheck`.'
      ].join('\n');
    }
    if (name.includes('events.gateway')) {
      return [
        '🛑 Breaking Callers: Changing WebSocket event signatures breaks socket subscribers in cadence-web PresenceAvatars and TaskCard.',
        '🗄️ Persistence Impact: Does not persist state, but decouples live Redis socket channels.',
        '💥 User-Facing Failure: Real-time board sync goes silent; updates require manual browser refresh.',
        '🧪 Verification Command: Run `pnpm --filter cadence-api test:e2e`.'
      ].join('\n');
    }
    if (inCount > 5) {
      return [
        `🛑 High Fan-In Blast Radius: This core component is imported by ${inCount} separate files across ${repoName}.`,
        `🗄️ Interface Contract: Any signature change requires refactoring all ${inCount} callers.`,
        '💥 Risk Factor: High probability of cascading regression bugs in secondary workflows.',
        '🧪 Verification Command: Run full workspace typecheck: `pnpm run typecheck`.'
      ].join('\n');
    }
    if (outCount > 5) {
      return [
        `🛑 High Orchestration Dependency: This component calls ${outCount} downstream dependencies.`,
        '🗄️ Service Coupling: Tightly coupled to external services and repositories.',
        '💥 Risk Factor: Failures in downstream services will cascade into this component.',
        '🧪 Verification Command: Verify mock test fixtures: `pnpm test`.'
      ].join('\n');
    }
    return [
      `🛑 Local Scope: Isolated within ${repoName} with ${inCount} inbound caller(s) and ${outCount} outbound dependenc(ies).`,
      '🗄️ Low Blast Radius: Interface modifications are contained to adjacent files.',
      `🧪 Verification Command: Run \`pnpm --filter ${repoName} test\`.`
    ].join('\n');
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
    const nodeNameMap = new Map(nodes.map((n) => [n.id, this.getNodeLabel(n)]));

    // Fetch evidence records for nodes to populate method code snippets and line ranges
    const evidenceRecords = this.evidenceRepo && nodeIds.length > 0
      ? await this.evidenceRepo.find({ where: { nodeId: In(nodeIds) } })
      : [];
    const evidenceByNodeId = new Map(evidenceRecords.map((ev) => [ev.nodeId as string, ev]));

    const edgeIds = edges.map((e) => e.id);
    const edgeEvidenceRecords = this.evidenceRepo && edgeIds.length > 0
      ? await this.evidenceRepo.find({ where: { edgeId: In(edgeIds) } })
      : [];
    const evidenceByEdgeId = new Map(edgeEvidenceRecords.map((ev) => [ev.edgeId as string, ev]));

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
      const ev = evidenceByNodeId.get(n.id);
      const exports = Array.isArray(n.metadata?.exports) ? (n.metadata.exports as string[]) : [];
      const primaryMethod = this.determinePrimaryMethod(n, exports);

      const inCount = incomingMap.get(n.id) || 0;
      const outCount = outgoingMap.get(n.id) || 0;
      const plainEnglishRole = this.getPlainEnglishRole(n, role, repoName);
      const consequencesOfChange = this.getConsequencesOfChange(n, role, repoName, inCount, outCount);

      return {
        id: n.id,
        identifier: n.identifier,
        displayName: this.getNodeLabel(n),
        nodeType: n.nodeType as NodeType,
        metadata: n.metadata || {},
        repositoryId: n.repositoryId,
        repositoryName: repoName,
        role,
        incomingCount: inCount,
        outgoingCount: outCount,
        filePath: n.identifier,
        primaryMethod,
        methods: exports,
        codeSnippet: ev?.codeSnippet,
        lineStart: ev?.lineStart,
        lineEnd: ev?.lineEnd,
        plainEnglishRole,
        consequencesOfChange,
      };
    });

    const visualEdges: VisualTopologyEdgeDto[] = edges.map((e) => {
      const srcRepoId = nodeRepoMap.get(e.sourceNodeId);
      const tgtRepoId = nodeRepoMap.get(e.targetNodeId);
      const isCross = Boolean(srcRepoId && tgtRepoId && srcRepoId !== tgtRepoId);
      const edgeEv = evidenceByEdgeId.get(e.id);
      const srcName = nodeNameMap.get(e.sourceNodeId) || e.sourceNodeId;
      const tgtName = nodeNameMap.get(e.targetNodeId) || e.targetNodeId;
      const srcRepo = srcRepoId ? repoMap.get(srcRepoId) : undefined;
      const tgtRepo = tgtRepoId ? repoMap.get(tgtRepoId) : undefined;
      const friendlyDescription = this.formatFriendlyDependency(
        srcName,
        tgtName,
        e.edgeType as EdgeType,
        isCross,
        srcRepo,
        tgtRepo,
      );

      return {
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType as EdgeType,
        confidence: Number(e.confidence),
        isInferred: Boolean(e.isInferred),
        sourceRepositoryName: srcRepo,
        targetRepositoryName: tgtRepo,
        isCrossRepository: isCross,
        friendlyDescription,
        codeSnippet: edgeEv?.codeSnippet,
        lineStart: edgeEv?.lineStart,
        lineEnd: edgeEv?.lineEnd,
        filePath: edgeEv?.filePath,
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

    const STOP_WORDS = new Set([
      'explain', 'flow', 'across', 'frontend', 'backend', 'system', 'component',
      'code', 'file', 'files', 'tell', 'show', 'give', 'what', 'where', 'when',
      'which', 'does', 'work', 'working', 'with', 'from', 'into', 'that', 'this',
      'there', 'here', 'have', 'been', 'about', 'between', 'user', 'developer',
      'please', 'help', 'understand', 'project', 'application', 'happening',
      'could', 'would', 'should', 'make', 'made', 'like'
    ]);

    const allTokens = lowerQuestion.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
    const meaningfulTokens = allTokens.filter((t) => !STOP_WORDS.has(t));
    const queryTokens = meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;

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
      task: ['task', 'board', 'column', 'card', 'comment'],
      board: ['project', 'board', 'column', 'stage', 'kanban'],
      ai: ['ai', 'copilot', 'assistant', 'prompt'],
    };

    // Check if query targets any of our core business domain configurations
    const domainConfigs = this.getDomainConfigurations();
    const matchedDomain = domainConfigs.find((cfg) => {
      const keywords = [...cfg.includes, cfg.id.replace('feat-', '')];
      return (
        queryTokens.some((tok) => keywords.some((k) => k.includes(tok) || tok.includes(k))) ||
        cfg.title.toLowerCase().split(/\s+/).some((w) => queryTokens.includes(w))
      );
    });

    if (matchedDomain) {
      // Find all domain components
      const domainNodes = nodes.filter((n) => {
        const target = `${n.displayName} ${n.identifier}`.toLowerCase();
        const hasEx = (matchedDomain.excludes || []).some((ex) => target.includes(ex));
        if (hasEx) return false;
        return matchedDomain.includes.some((inc) => target.includes(inc));
      });

      // Sort domainNodes: FRONTEND first, API next, SERVICE next, DATABASE last
      domainNodes.sort((a, b) => {
        const order: Record<string, number> = { FRONTEND: 1, API: 2, SERVICE: 3, QUEUE: 4, DATABASE: 5, PACKAGE: 6 };
        return (order[this.classifyComponentRole(a)] || 9) - (order[this.classifyComponentRole(b)] || 9);
      });

      for (const dn of domainNodes) {
        if (!candidateNodes.some((c) => c.id === dn.id)) {
          candidateNodes.push(dn);
        }
      }
    }

    // Prioritize exact filename or component name matches mentioned in the question
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

    const expandedTokens = new Set(queryTokens);
    for (const tok of queryTokens) {
      if (synonymMap[tok]) {
        for (const syn of synonymMap[tok]) {
          expandedTokens.add(syn);
        }
      }
    }

    for (const node of nodes) {
      const nodeText = `${node.displayName} ${node.identifier}`.toLowerCase();
      const hasMatch = Array.from(expandedTokens).some((tok) => nodeText.includes(tok));
      if (hasMatch && !candidateNodes.some((c) => c.id === node.id)) {
        candidateNodes.push(node);
      }
    }

    if (candidateNodes.length > 1 && !matchedDomain) {
      candidateNodes.sort((a, b) => {
        const aRepo = (repoMap.get(a.repositoryId) || '').toLowerCase();
        const bRepo = (repoMap.get(b.repositoryId) || '').toLowerCase();
        const aRepoMatch = aRepo && lowerQuestion.includes(aRepo) ? 1 : 0;
        const bRepoMatch = bRepo && lowerQuestion.includes(bRepo) ? 1 : 0;
        return bRepoMatch - aRepoMatch;
      });
    }

    let hadDirectMatch = true;
    // Fallback if no specific keyword matched: select top entry point nodes
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

    // Build ordered execution flow steps based on layer hierarchy or sequence steps
    const flowSteps: FlowStepDto[] = [];

    if (matchedDomain && matchedDomain.sequenceSteps.length > 0) {
      matchedDomain.sequenceSteps.forEach((s) => {
        flowSteps.push({
          stepNumber: s.stepNumber,
          componentName: s.componentName,
          componentType: s.lane === 'DATABASE' ? ('DATABASE' as NodeType) : ('ENDPOINT' as NodeType),
          repositoryName: s.repositoryName,
          description: s.description,
          methodName: s.primaryMethod,
          filePath: s.componentName,
          isInferred: false,
        });
      });
    } else {
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

      for (const pNode of orderedNodes) {
        if (flowSteps.length >= 15) break;

        const pLabel = this.getNodeLabel(pNode);
        const outgoing = connectedEdges.filter((e) => e.sourceNodeId === pNode.id);
        const repoName = repoMap.get(pNode.repositoryId) || 'system';
        const pMethod = this.determinePrimaryMethod(pNode, (pNode.metadata?.exports as string[]) || []);

        if (outgoing.length === 0) {
          const key = `${pNode.id}::EXECUTES`;
          if (!seenTransitions.has(key)) {
            seenTransitions.add(key);
            flowSteps.push({
              stepNumber: stepCounter++,
              componentName: pLabel,
              componentType: pNode.nodeType as NodeType,
              repositoryName: repoName,
              description: `Executes ${pLabel} [${pMethod}] within repository ${repoName}.`,
              isInferred: false,
              methodName: pMethod,
              filePath: pNode.identifier,
            });
          }
        } else {
          for (const outEdge of outgoing) {
            if (flowSteps.length >= 15) break;
            const targetNode = nodes.find((n) => n.id === outEdge.targetNodeId);
            if (!targetNode || targetNode.id === pNode.id) continue;

            const targetLabel = this.getNodeLabel(targetNode);
            const targetRepoName = repoMap.get(targetNode.repositoryId) || 'downstream';
            const targetMethod = this.determinePrimaryMethod(targetNode, (targetNode.metadata?.exports as string[]) || []);

            const key = `${pNode.id}::${outEdge.edgeType}::${targetNode.id}`;
            if (!seenTransitions.has(key)) {
              seenTransitions.add(key);
              flowSteps.push({
                stepNumber: stepCounter++,
                componentName: pLabel,
                componentType: pNode.nodeType as NodeType,
                repositoryName: repoName,
                description: this.formatFriendlyDependency(
                  `${pLabel} [${pMethod}]`,
                  `${targetLabel} [${targetMethod}]`,
                  outEdge.edgeType as EdgeType,
                  targetNode.repositoryId !== pNode.repositoryId,
                  repoName,
                  targetRepoName,
                ),
                edgeType: outEdge.edgeType as EdgeType,
                isInferred: Boolean(outEdge.isInferred),
                targetName: targetLabel,
                targetRepositoryName: targetRepoName,
                methodName: pMethod,
                targetMethodName: targetMethod,
                filePath: pNode.identifier,
              });
            }
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

    let answer = `### 🎓 Senior Engineer Technical Briefing: ${matchedDomain ? matchedDomain.title : 'System Architecture Flow'}\n\n`;
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
      // Check if user explicitly mentioned a file or component in the question
      const explicitlyMentionedNode = nodes
        .filter((n) => {
          const baseName = n.displayName.toLowerCase();
          const cleanIdent = n.identifier.toLowerCase().replace(/\\/g, '/');
          const lastSegment = cleanIdent.split('/').pop() || '';
          return (
            (baseName.length > 3 && lowerQuestion.includes(baseName)) ||
            (lastSegment.length > 3 && lowerQuestion.includes(lastSegment))
          );
        })
        .sort((a, b) => {
          const aIsSpec = a.displayName.includes('.spec.') ? 1 : 0;
          const bIsSpec = b.displayName.includes('.spec.') ? 1 : 0;
          if (aIsSpec !== bIsSpec) return aIsSpec - bIsSpec;
          return b.displayName.length - a.displayName.length;
        })[0];

      // Check if user is asking about a specific file or consequences of changing a file
      const isFileInquiry = Boolean(explicitlyMentionedNode) || lowerQuestion.includes('.ts') || lowerQuestion.includes('.tsx') || lowerQuestion.includes('.js');
      const isChangeOrBlastQuery =
        lowerQuestion.includes('change') ||
        lowerQuestion.includes('consequence') ||
        lowerQuestion.includes('modify') ||
        lowerQuestion.includes('blast') ||
        lowerQuestion.includes('affect') ||
        lowerQuestion.includes('impact') ||
        lowerQuestion.includes('break');

      const primaryFile = (isFileInquiry && (explicitlyMentionedNode || candidateNodes.length > 0))
        ? (explicitlyMentionedNode || candidateNodes[0])
        : null;

      if (primaryFile) {
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
        answer += `• **File Path:** \`${primaryFile.identifier}\`\n`;
        answer += `• **Plain-English Role:** ${this.getPlainEnglishRole(primaryFile, this.classifyComponentRole(primaryFile), fRepo)}\n\n`;

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
        const consequences = this.getConsequencesOfChange(primaryFile, this.classifyComponentRole(primaryFile), fRepo, callers.length, dependencies.length);
        for (const line of consequences.split('\n')) {
          if (line.trim()) answer += `• ${line.trim()}\n`;
        }
        answer += `\n`;
      } else if (matchedDomain) {
        answer += `**Executive Architecture Overview:**\n${matchedDomain.naturalLanguageExplanation}\n\n`;

        answer += `**Step-by-Step Execution Journey (From User Action to Database):**\n`;
        for (const s of matchedDomain.sequenceSteps) {
          const netTag = s.networkCall ? ` ➔ \`${s.networkCall}\`` : '';
          const methodTag = s.primaryMethod ? ` ➔ \`${s.primaryMethod}\`` : '';
          answer += `${s.stepNumber}. **${s.title}** (\`${s.lane}\` in *${s.repositoryName}*):\n`;
          answer += `   ↳ Component: \`${s.componentName}\`${methodTag}${netTag}\n`;
          answer += `   ↳ Action: ${s.description}\n\n`;
        }

        answer += `**⚠️ Consequences of Modifying This Flow (Blast Radius):**\n`;
        for (const line of matchedDomain.consequencesOfChange.split('\n')) {
          if (line.trim()) answer += `• ${line.trim()}\n`;
        }
        answer += `\n`;

        answer += `**🚀 Where to Start Guide:**\n`;
        answer += `• ${matchedDomain.whereToStartGuide}\n\n`;
      } else {
        answer += `**Overview:**\nThis flow spans **${participatingRepos.length}** repository(s) (${participatingRepos.map((r) => r.name).join(', ')}) across **${participatingNodes.length}** verified component(s).\n\n`;
      }

      // Only show generic step-by-step if neither matchedDomain nor primaryFile already provided steps (prevents duplication)
      if (!matchedDomain && !primaryFile) {
        answer += `**Step-by-Step Architectural Flow & Methods:**\n`;
        if (flowSteps.length > 0) {
          for (const step of flowSteps) {
            const inferenceBadge = step.isInferred ? ' *(inferred)*' : ' *(verified AST)*';
            const methodStr = step.methodName ? ` ➔ \`${step.methodName}\`` : '';
            answer += `${step.stepNumber}. **${step.componentName}**${methodStr} (\`${step.componentType}\` in *${step.repositoryName}*): ${step.description}${inferenceBadge}\n`;
          }
        } else {
          answer += `• Verified static components: ${participatingNodes.map((n) => `${this.getNodeLabel(n)} (${n.nodeType})`).join(', ')}\n`;
        }
        answer += `\n`;
      }

      // Render Tree Structure with files and methods
      if (flowSteps.length > 0) {
        answer += `\n**🌳 Visual Call & Method Tree:**\n\`\`\`text\n`;
        const rootSteps = flowSteps.filter((s) => s.componentType === 'PACKAGE' || s.componentType === 'ENDPOINT' || s.stepNumber === 1);
        const displayedRoots = rootSteps.length > 0 ? rootSteps.slice(0, 3) : flowSteps.slice(0, 2);

        for (const root of displayedRoots) {
          answer += `🖥️ ${root.componentName} ➔ ${root.methodName || 'render()'} [${root.repositoryName}]\n`;
          const children = flowSteps.filter((s) => s.componentName === root.componentName && s.targetName);
          if (children.length > 0) {
            children.forEach((child, idx) => {
              const isLast = idx === children.length - 1;
              const branch = isLast ? '└──' : '├──';
              const crossTag = child.targetRepositoryName && child.targetRepositoryName !== root.repositoryName ? ` [Cross-Repo: ${child.targetRepositoryName}]` : '';
              answer += `  ${branch} ⚡ ${child.targetName} ➔ ${child.targetMethodName || 'execute()'}${crossTag}\n`;
            });
          } else {
            const nextStep = flowSteps.find((s) => s.stepNumber === root.stepNumber + 1);
            if (nextStep) {
              answer += `  └── ⚡ ${nextStep.componentName} ➔ ${nextStep.methodName || 'execute()'} [${nextStep.repositoryName}]\n`;
            }
          }
        }
        answer += `\`\`\`\n`;
      }

      // Friendly file dependencies breakdown
      if (connectedEdges.length > 0) {
        answer += `\n**📋 Friendly File Dependencies (Who depends on What):**\n`;
        const uniqueEdges = connectedEdges.slice(0, 8);
        for (const edge of uniqueEdges) {
          const sNode = nodes.find((n) => n.id === edge.sourceNodeId);
          const tNode = nodes.find((n) => n.id === edge.targetNodeId);
          if (sNode && tNode) {
            const sLabel = this.getNodeLabel(sNode);
            const tLabel = this.getNodeLabel(tNode);
            const sRepo = repoMap.get(sNode.repositoryId);
            const tRepo = repoMap.get(tNode.repositoryId);
            const isCross = sNode.repositoryId !== tNode.repositoryId;
            const desc = this.formatFriendlyDependency(
              `\`${sLabel}\``,
              `\`${tLabel}\``,
              edge.edgeType as EdgeType,
              isCross,
              sRepo,
              tRepo,
            );
            answer += `• ${desc}\n`;
          }
        }
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
        `No explicit AST components matched question keywords (${queryTokens.join(', ')}). Displaying closest entrypoint architectural flow.`,
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

  determinePrimaryMethod(node: SystemNodeEntity, exports: string[] = []): string {
    const cleanExports = exports.filter(
      (e) => !e.toLowerCase().includes('dto') && !e.toLowerCase().includes('interface'),
    );
    const ident = (node.identifier || '').toLowerCase();
    const name = (node.displayName || '').toLowerCase();

    // Controllers
    if (ident.includes('controller') || name.includes('controller')) {
      const cls = cleanExports.find((e) => e.toLowerCase().includes('controller')) || exports[0];
      if (ident.includes('auth')) return `${cls || 'AuthController'}.login()`;
      if (ident.includes('comment')) return `${cls || 'CommentsController'}.createComment()`;
      if (ident.includes('invitation')) return `${cls || 'InvitationsController'}.sendInvite()`;
      if (ident.includes('apikey')) return `${cls || 'ApikeysController'}.createApiKey()`;
      if (ident.includes('ai')) return `${cls || 'AiController'}.generateTask()`;
      return cls ? `${cls}.handleRequest()` : 'handleRequest()';
    }

    // Services
    if (ident.includes('service') || name.includes('service')) {
      const cls = cleanExports.find((e) => e.toLowerCase().includes('service')) || exports[0];
      if (ident.includes('auth')) return `${cls || 'AuthService'}.validateUser()`;
      if (ident.includes('comment')) return `${cls || 'CommentsService'}.addComment()`;
      if (ident.includes('invitation')) return `${cls || 'InvitationsService'}.createInvite()`;
      if (ident.includes('subscription')) return `${cls || 'SubscriptionService'}.upgradePlan()`;
      if (ident.includes('apikey')) return `${cls || 'ApikeysService'}.verifyToken()`;
      if (ident.includes('ai')) return `${cls || 'AiService'}.generateTaskProposal()`;
      if (ident.includes('mcpchat')) return `${cls || 'McpChatService'}.processChat()`;
      return cls ? `${cls}.execute()` : 'execute()';
    }

    // Gateways / Sockets
    if (ident.includes('gateway') || name.includes('gateway')) {
      const cls = cleanExports[0] || 'EventsGateway';
      return `${cls}.handleMessage()`;
    }

    // Database Entities / Repositories
    if (node.nodeType === 'DATABASE' || ident.includes('repo') || ident.includes('entity')) {
      const cls = cleanExports.find((e) => e.toLowerCase().includes('repo') || e.toLowerCase().includes('entity')) || exports[0];
      return cls ? `${cls}.find()` : 'find()';
    }

    // Next.js Pages
    if (ident.includes('page.tsx')) {
      const pageFunc = cleanExports.find((e) => e.toLowerCase().includes('page') || e.toLowerCase().includes('content')) || cleanExports[0];
      return pageFunc ? `${pageFunc}()` : 'renderPage()';
    }

    // React Components
    if (name.endsWith('.tsx')) {
      const compName = cleanExports[0] || node.displayName.replace(/\.tsx$/, '');
      return `${compName}()`;
    }

    return cleanExports[0] ? `${cleanExports[0]}()` : 'execute()';
  }

  formatFriendlyDependency(
    srcName: string,
    tgtName: string,
    edgeType: EdgeType,
    isCross: boolean,
    srcRepo?: string,
    tgtRepo?: string,
  ): string {
    let rel = '';
    switch (edgeType) {
      case EdgeType.CALLS:
        rel = 'calls and executes methods in';
        break;
      case EdgeType.READS_FROM:
        rel = 'queries records from database entity';
        break;
      case EdgeType.WRITES_TO:
        rel = 'persists changes to database entity';
        break;
      case EdgeType.PRODUCES:
        rel = 'dispatches real-time messages to';
        break;
      case EdgeType.CONSUMES:
        rel = 'receives and processes events from';
        break;
      case EdgeType.DEPENDS_ON:
      default:
        rel = 'imports and renders / delegates to';
        break;
    }

    let text = `${srcName} ${rel} ${tgtName}`;
    if (isCross) {
      text += ` (across repositories: ${srcRepo || 'web'} ➔ ${tgtRepo || 'api'})`;
    }
    return text;
  }

  private getDomainConfigurations(): Array<{
    id: string;
    title: string;
    description: string;
    naturalLanguageExplanation: string;
    consequencesOfChange: string;
    whereToStartGuide: string;
    category: 'AUTHENTICATION' | 'ORDER_PROCESSING' | 'API_SERVICES' | 'GENERAL';
    includes: string[];
    excludes?: string[];
    externalServices?: string[];
    sequenceSteps: Array<{
      stepNumber: number;
      title: string;
      lane: 'CLIENT' | 'API' | 'SERVICE' | 'DATABASE';
      componentName: string;
      repositoryName: string;
      primaryMethod?: string;
      description: string;
      networkCall?: string;
    }>;
  }> {
    return [
      {
        id: 'feat-auth',
        title: 'Authentication & Session Lifecycle',
        description: 'User registration, login, credential verification, JWT/session management, and OAuth authentication flows.',
        naturalLanguageExplanation: 'Handles the complete user identity lifecycle from the browser to the database. Users sign in via Google OAuth or credentials on the frontend (/login and /signup). The frontend passes tokens to the NestJS AuthController, where AuthService validates credentials, issues signed JWT sessions, and verifies user records in PostgreSQL.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Altering token validation or auth signatures breaks AuthController, JwtAuthGuard, and Next.js AuthContext.',
          '🗄️ Persistence Impact: Modifies User entity session claims and PostgreSQL token expiration records.',
          '💥 User-Facing Failure: Authenticated users will encounter 401 Unauthorized redirects and be forced to re-login.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test:e2e`.'
        ].join('\n'),
        whereToStartGuide: 'To customize login fields or OAuth UI, edit cadence-web/app/login/page.tsx. To modify session expiration, password hashing, or token verification, edit cadence-api/src/auth/auth.service.ts.',
        category: 'AUTHENTICATION',
        includes: ['auth', 'login', 'signup', 'session', 'jwt', 'verify-magic-link', 'googlesignin', 'oauth'],
        externalServices: ['GitHub OAuth', 'Google OAuth'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'User Form Submission',
            lane: 'CLIENT',
            componentName: 'login/page.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'LoginPageContent()',
            description: 'User enters credentials or clicks Google OAuth button; component dispatches POST /auth/login network request.',
            networkCall: 'POST /auth/login',
          },
          {
            stepNumber: 2,
            title: 'API Controller Entrypoint',
            lane: 'API',
            componentName: 'auth.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'AuthController.login()',
            description: 'Receives request body, validates DTO schema parameters, and forwards credentials to AuthService.',
          },
          {
            stepNumber: 3,
            title: 'Credential Verification',
            lane: 'SERVICE',
            componentName: 'auth.service.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'AuthService.validateUser()',
            description: 'Compares bcrypt password hash against stored user record or validates OAuth profile tokens.',
          },
          {
            stepNumber: 4,
            title: 'User Database Query',
            lane: 'DATABASE',
            componentName: 'userRepository.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'findOneBy(email)',
            description: 'Queries PostgreSQL users table to verify user identity, role assignments, and workspace memberships.',
          },
          {
            stepNumber: 5,
            title: 'Security Guard & Session Grant',
            lane: 'SERVICE',
            componentName: 'jwt-auth.guard.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'JwtAuthGuard()',
            description: 'Issues signed JWT session cookie to client browser for authenticating subsequent API requests.',
          },
        ],
      },
      {
        id: 'feat-projects',
        title: 'Project Workspaces & Kanban Boards',
        description: 'Kanban board columns, workspace contexts, project creation/editing modals, and layout shells.',
        naturalLanguageExplanation: 'Provides project workspace orchestration and board views. The Next.js frontend dynamic route (/projects/[projectId]) loads project configurations via ProjectContext and ProjectLayoutShell, allowing developers to organize multi-repository workspaces, switch views, and configure member roles.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Changing project models breaks ProjectsController, BoardColumn, and WorkspaceLayoutShell.',
          '🗄️ Persistence Impact: Alters projects and project_repositories records in PostgreSQL.',
          '💥 User-Facing Failure: Project workspaces fail to load, showing blank Kanban columns or 404 errors.',
          '🧪 Verification Command: Run `pnpm --filter cadence-web test`.'
        ].join('\n'),
        whereToStartGuide: 'To adjust board layouts or column drag-and-drop, edit cadence-web/app/projects/[projectId]/page.tsx. For backend workspace CRUD logic, inspect cadence-api/src/projects/projects.service.ts.',
        category: 'GENERAL',
        includes: ['project', 'boardcolumn', 'presenceavatars', 'board'],
        excludes: ['billing', 'pricing', 'api-key', 'apikey', 'invite', 'invitation'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Workspace Load',
            lane: 'CLIENT',
            componentName: '[projectId]/page.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'ProjectBoardContent()',
            description: 'Loads workspace shell and requests active board data from backend API.',
            networkCall: 'GET /projects/:projectId',
          },
          {
            stepNumber: 2,
            title: 'Project API Route',
            lane: 'API',
            componentName: 'projects.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'ProjectsController.getOne()',
            description: 'Validates session credentials and user workspace membership authorization.',
          },
          {
            stepNumber: 3,
            title: 'Workspace Orchestration',
            lane: 'SERVICE',
            componentName: 'projects.service.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'ProjectsService.findOne()',
            description: 'Aggregates workspace metadata, stage columns, and active repository connections.',
          },
          {
            stepNumber: 4,
            title: 'Database Persistence',
            lane: 'DATABASE',
            componentName: 'projectRepository.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'findProjectWithStages()',
            description: 'Fetches project and stage records from PostgreSQL projects table.',
          },
        ],
      },
      {
        id: 'feat-tasks',
        title: 'Task Lifecycle, Subtasks & Comments',
        description: 'Task cards, task detail modals, subtask checklists, and collaborative discussion comments.',
        naturalLanguageExplanation: 'Manages the real-time task lifecycle and discussion workflows. On the frontend, BoardColumn and TaskCard components render task details and emit stage updates. When a user creates or comments on a task, calls route to the CommentsController and TaskRepository in the backend API, syncing state to PostgreSQL and broadcasting updates via WebSockets.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Modifying task schemas breaks TasksService, CommentsController, and TaskCard drag handlers.',
          '🗄️ Persistence Impact: Alters tasks and comments tables in PostgreSQL.',
          '💥 User-Facing Failure: Task card movements fail to persist and collaborative comments disappear on refresh.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test src/tasks/tasks.service.spec.ts`.'
        ].join('\n'),
        whereToStartGuide: 'To adjust task UI cards, inspect cadence-web/components/board/TaskCard.tsx. For backend task status logic, edit cadence-api/src/tasks/tasks.service.ts.',
        category: 'GENERAL',
        includes: ['task', 'comment', 'subtask'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Task Stage Move / Comment',
            lane: 'CLIENT',
            componentName: 'BoardColumn.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'BoardColumnProps()',
            description: 'User drags card to new column stage or posts discussion comment; sends PATCH request to API.',
            networkCall: 'PATCH /tasks/:id/stage',
          },
          {
            stepNumber: 2,
            title: 'Task API Route',
            lane: 'API',
            componentName: 'tasks.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'TasksController.updateStage()',
            description: 'Validates task stage transition permissions and payload integrity.',
          },
          {
            stepNumber: 3,
            title: 'Business Validation',
            lane: 'SERVICE',
            componentName: 'tasks.service.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'TasksService.updateStage()',
            description: 'Applies lifecycle rules, stage limits, and generates event payload.',
          },
          {
            stepNumber: 4,
            title: 'Task Mutation',
            lane: 'DATABASE',
            componentName: 'taskRepository.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'save()',
            description: 'Persists updated stage, order index, and timestamp in PostgreSQL tasks table.',
          },
          {
            stepNumber: 5,
            title: 'WebSocket Broadcast',
            lane: 'SERVICE',
            componentName: 'events.gateway.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'EventsGateway.broadcastTaskUpdate()',
            description: 'Emits task:updated WebSocket event to all other connected team members viewing the workspace.',
          },
        ],
      },
      {
        id: 'feat-ai',
        title: 'AI Assistant & Copilot Generator',
        description: 'AI task proposal generation, copilot chat drawers, MCP bridge services, and smart project assistance.',
        naturalLanguageExplanation: 'Integrates AI copilot capabilities across workspaces. Components like AICopilotChatDrawer and AIGeneratorModal send developer prompts to the backend AiController and AiService. The system communicates via the McpChatService bridge to synthesize smart task proposals and project insights.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Modifying AiController breaks AICopilotChatDrawer and AIGeneratorModal payload contracts.',
          '🗄️ Persistence Impact: Alters AI cache embeddings and rate-limit counters in Redis.',
          '💥 User-Facing Failure: AI task proposal generation fails with timeout or schema parse errors.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test src/ai/ai.service.spec.ts`.'
        ].join('\n'),
        whereToStartGuide: 'To adjust AI prompt UI, inspect cadence-web/components/ai/AICopilotChatDrawer.tsx. For backend AI synthesis logic, edit cadence-api/src/ai/ai.service.ts.',
        category: 'API_SERVICES',
        includes: ['ai.', 'ai/', '/ai', 'copilot', 'aigenerator', 'aitaskproposal', 'mcpchat'],
        externalServices: ['LLM Provider / MCP Bridge'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Copilot Prompt Submission',
            lane: 'CLIENT',
            componentName: 'AICopilotChatDrawer.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'AICopilotChatDrawer()',
            description: 'Developer submits query requesting task breakdown or architecture guidance.',
            networkCall: 'POST /ai/chat',
          },
          {
            stepNumber: 2,
            title: 'AI API Controller',
            lane: 'API',
            componentName: 'ai.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'AiController.chat()',
            description: 'Authenticates request, applies prompt shielding, and routes to AI service.',
          },
          {
            stepNumber: 3,
            title: 'MCP Bridge & LLM Synthesis',
            lane: 'SERVICE',
            componentName: 'ai.service.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'AiService.generateTaskProposal()',
            description: 'Connects to MCP bridge / LLM service to synthesize structured task recommendations.',
          },
        ],
      },
      {
        id: 'feat-invitations',
        title: 'Team Invitations & Access Collaboration',
        description: 'Team member invitations, invitation acceptance workflows, invite emails, and workspace member lists.',
        naturalLanguageExplanation: 'Enables multi-user collaboration and workspace onboarding. Workspace owners dispatch invites using InviteMembersModal. InvitationsController creates secure invite tokens, triggers email notifications via InvitationAcceptedEmail, and manages membership acceptance on the frontend (/invite/accept).',
        consequencesOfChange: [
          '🛑 Breaking Callers: Changes to invite tokens or membership schemas break InvitationsController and member guards.',
          '🗄️ Persistence Impact: Alters project_members and invitation_tokens tables in PostgreSQL.',
          '💥 User-Facing Failure: Invited team members cannot join workspaces and receive expired token alerts.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test`.'
        ].join('\n'),
        whereToStartGuide: 'To inspect team invite modals, see cadence-web/components/team/InviteMembersModal.tsx. For backend token logic, see cadence-api/src/invitations/invitations.controller.ts.',
        category: 'GENERAL',
        includes: ['invitation', 'invite', 'invitemembers', 'projectmembers'],
        externalServices: ['Email Delivery (SMTP/Resend)'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Invite Dispatch',
            lane: 'CLIENT',
            componentName: 'InviteMembersModal.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'InviteMembersModalProps()',
            description: 'Workspace owner enters teammate email and selects role permissions.',
            networkCall: 'POST /invitations',
          },
          {
            stepNumber: 2,
            title: 'Invite Controller',
            lane: 'API',
            componentName: 'invitations.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'InvitationsController.create()',
            description: 'Generates secure cryptographic token and stores pending invite in PostgreSQL.',
          },
        ],
      },
      {
        id: 'feat-billing',
        title: 'Billing & Workspace Subscriptions',
        description: 'Subscription upgrade flows, pricing plans, workspace tier limits, and billing management.',
        naturalLanguageExplanation: 'Oversees tier plans and subscription lifecycle. The pricing page (/pricing) and SubscriptionUpgradeFlow components allow workspace administrators to inspect quotas and trigger upgrades via backend subscription services.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Modifying subscription quotas impacts SubscriptionService and plan middleware.',
          '🗄️ Persistence Impact: Touches workspace_subscriptions and customer_billing tables in PostgreSQL.',
          '💥 User-Facing Failure: Team workspaces get prematurely locked out with subscription exceeded messages.',
          '🧪 Verification Command: Run `pnpm --filter cadence-web test`.'
        ].join('\n'),
        whereToStartGuide: 'For pricing and quota UI, inspect cadence-web/app/(app)/pricing/page.tsx.',
        category: 'ORDER_PROCESSING',
        includes: ['billing', 'pricing', 'subscription'],
        externalServices: ['Payment Gateway'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Pricing Plan Selection',
            lane: 'CLIENT',
            componentName: 'pricing/page.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'PricingPage()',
            description: 'Admin selects subscription plan and initiates checkout session.',
          },
          {
            stepNumber: 2,
            title: 'Checkout Redirect',
            lane: 'CLIENT',
            componentName: 'billing/page.tsx',
            repositoryName: 'cadence-web',
            primaryMethod: 'BillingPage()',
            description: 'Processes payment confirmation and updates workspace quota state.',
          },
        ],
      },
      {
        id: 'feat-apikeys',
        title: 'API Keys & Developer Integrations',
        description: 'Personal access tokens, project API keys, hash generation, and developer programmatic access.',
        naturalLanguageExplanation: 'Provides developer access and machine-to-machine integrations. Administrators generate and revoke API keys via the ApiKeysPage. The backend ApikeysController hashes and stores secrets in PostgreSQL, enforcing authorization on external API calls.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Revoking or altering API key hashing breaks external CI/CD integrations and ApikeysGuard.',
          '🗄️ Persistence Impact: Alters api_keys table hashes and last_used timestamps in PostgreSQL.',
          '💥 User-Facing Failure: Third-party webhooks and automated CI builds receive HTTP 403 Forbidden.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test`.'
        ].join('\n'),
        whereToStartGuide: 'Inspect backend key controllers at cadence-api/src/apikeys/apikeys.controller.ts.',
        category: 'API_SERVICES',
        includes: ['apikey', 'api-key', 'apikeys'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'API Key Generation',
            lane: 'API',
            componentName: 'apikeys.controller.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'ApikeysController.create()',
            description: 'Hashes key secret with SHA-256 and persists authorization scope in database.',
          },
        ],
      },
      {
        id: 'feat-realtime',
        title: 'Real-Time WebSockets & Activity Events',
        description: 'Real-time WebSocket event gateways, live user activity broadcasting, and push events.',
        naturalLanguageExplanation: 'Drives real-time synchronization and user presence. The EventsGateway maintains live WebSocket connections, broadcasting task stage movements, collaborative comments, and user presence avatars across active developer browser sessions.',
        consequencesOfChange: [
          '🛑 Breaking Callers: Modifying EventsGateway event payloads breaks PresenceAvatars and live board update listeners.',
          '🗄️ Persistence Impact: Disrupts Redis pub/sub channels used for WebSocket fan-out.',
          '💥 User-Facing Failure: Board cards do not update in real time across team members without manual browser refresh.',
          '🧪 Verification Command: Run `pnpm --filter cadence-api test:e2e`.'
        ].join('\n'),
        whereToStartGuide: 'Inspect socket handlers at cadence-api/src/events/events.gateway.ts.',
        category: 'API_SERVICES',
        includes: ['event', 'gateway', 'websocket', 'socket'],
        sequenceSteps: [
          {
            stepNumber: 1,
            title: 'Socket Connection',
            lane: 'CLIENT',
            componentName: 'cadence-web Client',
            repositoryName: 'cadence-web',
            primaryMethod: 'connectSocket()',
            description: 'Browser establishes authenticated WebSocket handshake with backend server.',
          },
          {
            stepNumber: 2,
            title: 'WebSocket Gateway Handshake',
            lane: 'API',
            componentName: 'events.gateway.ts',
            repositoryName: 'cadence-api',
            primaryMethod: 'EventsGateway.handleConnection()',
            description: 'Authenticates connection token, joins workspace room, and broadcasts presence update.',
          },
        ],
      },
    ];
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

    const domainConfigs = this.getDomainConfigurations();

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
          naturalLanguageExplanation: cfg.naturalLanguageExplanation,
          consequencesOfChange: cfg.consequencesOfChange,
          whereToStartGuide: cfg.whereToStartGuide,
          sequenceSteps: cfg.sequenceSteps,
          category: cfg.category,
          entryPoint,
          participatingComponents: domainNodes.map((n) => {
            const exports = Array.isArray(n.metadata?.exports) ? (n.metadata.exports as string[]) : [];
            const primaryMethod = this.determinePrimaryMethod(n, exports);
            return {
              id: n.id,
              name: this.getNodeLabel(n),
              type: n.nodeType as NodeType,
              repositoryName: repoMap.get(n.repositoryId) || 'system',
              primaryMethod,
              methods: exports,
              filePath: n.identifier,
            };
          }),
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
        naturalLanguageExplanation: 'The foundational design system and shared utilities powering RepoDoctor, providing accessible UI primitives (buttons, modals, dialogs, badges) and cryptographic helpers.',
        category: 'GENERAL',
        entryPoint: remainingNodes[0]?.displayName || 'SharedModule',
        participatingComponents: remainingNodes.map((n) => {
          const exports = Array.isArray(n.metadata?.exports) ? (n.metadata.exports as string[]) : [];
          const primaryMethod = this.determinePrimaryMethod(n, exports);
          return {
            id: n.id,
            name: this.getNodeLabel(n),
            type: n.nodeType as NodeType,
            repositoryName: repoMap.get(n.repositoryId) || 'system',
            primaryMethod,
            methods: exports,
            filePath: n.identifier,
          };
        }),
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
