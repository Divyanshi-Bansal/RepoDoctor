/**
 * @repo-doctor/shared
 *
 * Domain models and DTO contracts shared across backend and web client.
 */

export const REPO_DOCTOR_VERSION = '0.1.0';

export type NodeType = 'SERVICE' | 'DATABASE' | 'QUEUE' | 'ENDPOINT' | 'PACKAGE';
export type EdgeType = 'CALLS' | 'READS_FROM' | 'WRITES_TO' | 'CONSUMES' | 'PRODUCES' | 'DEPENDS_ON';

export interface RepositoryDto {
  readonly id: string;
  readonly githubOrg: string;
  readonly name: string;
  readonly defaultBranch: string;
  readonly lastCommitSha: string | null;
  readonly updatedAt: string;
}

export interface ComponentBreakdownDto {
  readonly services: number;
  readonly databases: number;
  readonly queues: number;
  readonly endpoints: number;
  readonly packages: number;
}

export interface ArchitecturalInsightDto {
  readonly type: 'HEALTH' | 'COUPLING' | 'DATA_FLOW' | 'COVERAGE';
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly title: string;
  readonly description: string;
}

export interface RepositoryDashboardDto {
  readonly repository: RepositoryDto;
  readonly healthScore: number;
  readonly analysisStatus: 'READY' | 'INDEXING' | 'STALE' | 'NOT_ANALYZED';
  readonly lastAnalyzedAt: string;
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly totalEvidenceCount: number;
  readonly components: ComponentBreakdownDto;
  readonly insights: readonly ArchitecturalInsightDto[];
}

export interface CodeLocationCitationDto {
  readonly evidenceId: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly codeSnippet: string;
  readonly commitSha: string;
}

export interface FeatureItemDto {
  readonly id: string;
  readonly identifier: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly metadata: Record<string, unknown>;
  readonly relatedFiles: readonly string[];
  readonly codeLocations: readonly CodeLocationCitationDto[];
  readonly dependencies: readonly {
    readonly targetId: string;
    readonly targetName: string;
    readonly edgeType: EdgeType;
    readonly confidence: number;
    readonly isInferred: boolean;
  }[];
}

export interface FeatureQuestionRequestDto {
  readonly question: string;
  readonly contextNodeId: string;
}

export interface FeatureQuestionResponseDto {
  readonly answer: string;
  readonly confidence: number;
  readonly isInferred: boolean;
  readonly citations: readonly CodeLocationCitationDto[];
  readonly relatedNodeIds: readonly string[];
}

export interface TopologyNodeDto {
  readonly id: string;
  readonly identifier: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly metadata: Record<string, unknown>;
}

export interface TopologyEdgeDto {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly edgeType: EdgeType;
  readonly confidence: number;
  readonly isInferred: boolean;
}

export interface ArchitectureTopologyDto {
  readonly repositoryId: string;
  readonly nodes: readonly TopologyNodeDto[];
  readonly edges: readonly TopologyEdgeDto[];
  readonly groupedDomains: {
    readonly services: readonly TopologyNodeDto[];
    readonly databases: readonly TopologyNodeDto[];
    readonly queues: readonly TopologyNodeDto[];
    readonly endpoints: readonly TopologyNodeDto[];
    readonly packages: readonly TopologyNodeDto[];
  };
}

export interface BlastRadiusStepDto {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly targetNodeName: string;
  readonly targetNodeType: NodeType;
  readonly edgeType: EdgeType;
  readonly confidence: number;
  readonly depth: number;
  readonly path: readonly string[];
}

export interface BlastRadiusResultDto {
  readonly rootNodeId: string;
  readonly rootNodeName: string;
  readonly totalImpactedNodes: number;
  readonly maxDepth: number;
  readonly steps: readonly BlastRadiusStepDto[];
}

export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly githubUsername: string | null;
  readonly gitlabUsername: string | null;
  readonly createdAt: string;
}

export interface ProjectDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly ownerId: string;
  readonly repositoryCount: number;
  readonly repositories?: readonly RepositoryDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProjectDto {
  readonly name: string;
  readonly description?: string;
}

export interface SetProjectRepositoriesDto {
  readonly repositoryIds: readonly string[];
}

export interface RepositoryAnalysisStatusDto {
  readonly repositoryId: string;
  readonly repositoryName: string;
  readonly status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  readonly error?: string;
  readonly totalNodes?: number;
  readonly totalEdges?: number;
}

export interface ProjectAnalysisResultDto {
  readonly projectId: string;
  readonly totalRepositories: number;
  readonly successful: number;
  readonly failed: number;
  readonly repositoryResults: readonly RepositoryAnalysisStatusDto[];
}

export interface BusinessFeatureDto {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly naturalLanguageExplanation?: string;
  readonly category: 'AUTHENTICATION' | 'ORDER_PROCESSING' | 'PAYMENTS' | 'NOTIFICATIONS' | 'DATA_STORAGE' | 'API_SERVICES' | 'GENERAL';
  readonly entryPoint?: string;
  readonly participatingComponents: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: NodeType;
    readonly repositoryName: string;
    readonly primaryMethod?: string;
    readonly methods?: readonly string[];
    readonly filePath?: string;
    readonly codeSnippet?: string;
    readonly lineStart?: number;
    readonly lineEnd?: number;
  }[];
  readonly relatedRepositories: readonly string[];
  readonly dataStores: readonly string[];
  readonly externalServices: readonly string[];
  readonly citationsCount: number;
  readonly sequenceSteps?: readonly {
    readonly stepNumber: number;
    readonly title: string;
    readonly lane: 'CLIENT' | 'API' | 'SERVICE' | 'DATABASE';
    readonly componentName: string;
    readonly repositoryName: string;
    readonly primaryMethod?: string;
    readonly description: string;
    readonly networkCall?: string;
  }[];
  readonly consequencesOfChange?: string;
  readonly whereToStartGuide?: string;
}

export interface ProjectDashboardDto {
  readonly project: ProjectDto;
  readonly totalRepositories: number;
  readonly analyzedRepositoriesCount: number;
  readonly repositories: readonly {
    readonly repository: RepositoryDto;
    readonly analysisStatus: 'READY' | 'INDEXING' | 'STALE' | 'NOT_ANALYZED';
    readonly totalNodes: number;
    readonly totalEdges: number;
    readonly healthScore: number;
  }[];
  readonly businessFeatures: readonly BusinessFeatureDto[];
  readonly architecturalInsights: readonly ArchitecturalInsightDto[];
  readonly crossRepoDependenciesCount: number;
}

export interface FlowStepDto {
  readonly stepNumber: number;
  readonly componentName: string;
  readonly componentType: NodeType;
  readonly repositoryName: string;
  readonly description: string;
  readonly edgeType?: EdgeType;
  readonly isInferred: boolean;
  readonly targetName?: string;
  readonly targetRepositoryName?: string;
  readonly methodName?: string;
  readonly targetMethodName?: string;
  readonly filePath?: string;
  readonly codeSnippet?: string;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly plainEnglishRole?: string;
  readonly consequencesOfChange?: string;
}

export interface AskRepoDoctorQueryDto {
  readonly question: string;
  readonly repositoryId?: string;
  readonly nodeId?: string;
}

export interface AskRepoDoctorResponseDto {
  readonly answer: string;
  readonly confidence: number;
  readonly isInferred: boolean;
  readonly citations: readonly CodeLocationCitationDto[];
  readonly participatingRepositories: readonly {
    readonly id: string;
    readonly name: string;
    readonly org: string;
  }[];
  readonly participatingComponents: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: NodeType;
    readonly repositoryName: string;
  }[];
  readonly flowSteps: readonly FlowStepDto[];
  readonly limitations: readonly string[];
}

export interface VisualTopologyNodeDto extends TopologyNodeDto {
  readonly repositoryId: string;
  readonly repositoryName: string;
  readonly role: 'FRONTEND' | 'API' | 'SERVICE' | 'DATABASE' | 'QUEUE' | 'PACKAGE';
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly filePath?: string;
  readonly primaryMethod?: string;
  readonly methods?: readonly string[];
  readonly codeSnippet?: string;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly plainEnglishRole?: string;
  readonly consequencesOfChange?: string;
}

export interface VisualTopologyEdgeDto extends TopologyEdgeDto {
  readonly sourceRepositoryName?: string;
  readonly targetRepositoryName?: string;
  readonly isCrossRepository: boolean;
  readonly friendlyDescription?: string;
  readonly codeSnippet?: string;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly filePath?: string;
}

export interface ProjectArchitectureDto {
  readonly projectId: string;
  readonly nodes: readonly VisualTopologyNodeDto[];
  readonly edges: readonly VisualTopologyEdgeDto[];
  readonly repositories: readonly {
    readonly id: string;
    readonly name: string;
    readonly org: string;
  }[];
  readonly roleLayers: {
    readonly frontend: readonly VisualTopologyNodeDto[];
    readonly api: readonly VisualTopologyNodeDto[];
    readonly services: readonly VisualTopologyNodeDto[];
    readonly database: readonly VisualTopologyNodeDto[];
    readonly queue: readonly VisualTopologyNodeDto[];
    readonly packages: readonly VisualTopologyNodeDto[];
  };
  readonly crossRepositoryEdges: readonly VisualTopologyEdgeDto[];
}

export interface AuthStatusDto {
  readonly githubConfigured: boolean;
  readonly gitlabConfigured: boolean;
  readonly githubCallbackUrl: string;
  readonly gitlabCallbackUrl: string;
}
