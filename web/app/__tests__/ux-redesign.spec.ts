import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverviewView } from '../components/OverviewView.js';
import { AskRepoDoctorDrawer } from '../components/AskRepoDoctorDrawer.js';
import { VisualArchitectureView } from '../components/VisualArchitectureView.js';
import { FeatureExplorerView } from '../components/FeatureExplorerView.js';
import type {
  ProjectDashboardDto,
  AskRepoDoctorResponseDto,
  ProjectArchitectureDto,
} from '@repo-doctor/shared';

describe('RepoDoctor Developer-Friendly UX Redesign', () => {
  const mockDashboard: ProjectDashboardDto = {
    project: {
      id: 'proj-1',
      name: 'E-Commerce Platform',
      description: 'Microservices and web store system',
      ownerId: 'user-1',
      repositoryCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    totalRepositories: 2,
    analyzedRepositoriesCount: 2,
    repositories: [
      {
        repository: {
          id: 'repo-1',
          githubOrg: 'org',
          name: 'store-web',
          defaultBranch: 'main',
          lastCommitSha: 'sha1',
          updatedAt: new Date().toISOString(),
        },
        analysisStatus: 'READY',
        totalNodes: 12,
        totalEdges: 18,
        healthScore: 92,
      },
      {
        repository: {
          id: 'repo-2',
          githubOrg: 'org',
          name: 'orders-api',
          defaultBranch: 'main',
          lastCommitSha: 'sha2',
          updatedAt: new Date().toISOString(),
        },
        analysisStatus: 'READY',
        totalNodes: 15,
        totalEdges: 22,
        healthScore: 88,
      },
    ],
    businessFeatures: [
      {
        id: 'feat-1',
        title: 'User Checkout Flow',
        description: 'Processes cart checkout from browser to database',
        category: 'ORDER_PROCESSING',
        participatingComponents: [
          { id: 'c-1', name: 'CheckoutPage', type: 'ENDPOINT', repositoryName: 'store-web' },
          { id: 'c-2', name: 'OrdersService', type: 'SERVICE', repositoryName: 'orders-api' },
        ],
        relatedRepositories: ['store-web', 'orders-api'],
        dataStores: ['orders_db'],
        externalServices: [],
        citationsCount: 2,
      },
    ],
    architecturalInsights: [
      {
        type: 'COUPLING',
        severity: 'INFO',
        title: 'Clean Cross-Repo Decoupling',
        description: 'Frontend calls Orders API strictly via REST contract.',
      },
    ],
    crossRepoDependenciesCount: 3,
  };

  it('OverviewView answers the 3 core questions and displays primary actions', () => {
    const onOpenManageRepos = vi.fn();
    const onAnalyzeProject = vi.fn();
    const onAskQuestion = vi.fn();
    const onSelectTab = vi.fn();
    const onUnlinkRepo = vi.fn();

    const html = renderToStaticMarkup(
      React.createElement(OverviewView, {
        dashboard: mockDashboard,
        isLoading: false,
        error: null,
        onOpenManageRepos,
        onAnalyzeProject,
        isAnalyzingProject: false,
        onAskQuestion,
        onSelectTab,
        onUnlinkRepo,
      }),
    );

    expect(html).toContain('E-Commerce Platform');
    expect(html).toContain('Analysis Ready (2/2 repos)');
    expect(html).toContain('Explore Project Features');
    expect(html).toContain('User Checkout Flow');
    expect(html).toContain('Ask RepoDoctor About This System');
    expect(html).toContain('Technical System Metrics &amp; Repository Details');
  });

  it('AskRepoDoctorDrawer renders conversational question composer and honest status', () => {
    const onQueryProject = vi.fn().mockResolvedValue({
      answer: 'User checkout flows from CheckoutPage to OrdersService.',
      confidence: 1.0,
      isInferred: false,
      citations: [
        {
          evidenceId: 'ev-1',
          filePath: 'src/orders.service.ts',
          lineStart: 10,
          lineEnd: 25,
          codeSnippet: 'async createOrder() { ... }',
          commitSha: 'sha1',
        },
      ],
      participatingRepositories: [{ id: 'r-1', name: 'orders-api', org: 'org' }],
      participatingComponents: [{ id: 'c-1', name: 'OrdersService', type: 'SERVICE', repositoryName: 'orders-api' }],
      flowSteps: [
        {
          stepNumber: 1,
          componentName: 'CheckoutPage',
          componentType: 'ENDPOINT',
          repositoryName: 'store-web',
          description: 'Submits checkout payload',
          isInferred: false,
        },
      ],
      limitations: ['Static AST analysis bounds.'],
    } satisfies AskRepoDoctorResponseDto);

    const html = renderToStaticMarkup(
      React.createElement(AskRepoDoctorDrawer, {
        isOpen: true,
        onClose: vi.fn(),
        projectId: 'proj-1',
        onQueryProject,
        onNavigateFlow: vi.fn(),
      }),
    );

    expect(html).toContain('Ask RepoDoctor');
    expect(html).toContain('SUGGESTED QUESTIONS:');
    expect(html).toContain('Ask Anything About This Project');
  });

  it('VisualArchitectureView provides execution flow tree and compact filter toggle', () => {
    const mockArchitecture: ProjectArchitectureDto = {
      projectId: 'proj-1',
      nodes: [
        {
          id: 'n-1',
          identifier: 'web/page.tsx',
          displayName: 'CheckoutPage',
          nodeType: 'ENDPOINT',
          repositoryId: 'r-1',
          repositoryName: 'store-web',
          role: 'FRONTEND',
          incomingCount: 0,
          outgoingCount: 1,
          metadata: {},
        },
        {
          id: 'n-2',
          identifier: 'src/orders.service.ts',
          displayName: 'OrdersService',
          nodeType: 'SERVICE',
          repositoryId: 'r-2',
          repositoryName: 'orders-api',
          role: 'SERVICE',
          incomingCount: 1,
          outgoingCount: 0,
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'e-1',
          sourceNodeId: 'n-1',
          targetNodeId: 'n-2',
          edgeType: 'CALLS',
          confidence: 1.0,
          isInferred: false,
          isCrossRepository: true,
          sourceRepositoryName: 'store-web',
          targetRepositoryName: 'orders-api',
        },
      ],
      repositories: [
        { id: 'r-1', name: 'store-web', org: 'org' },
        { id: 'r-2', name: 'orders-api', org: 'org' },
      ],
      roleLayers: {
        frontend: [],
        api: [],
        services: [],
        database: [],
        queue: [],
        packages: [],
      },
      crossRepositoryEdges: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(VisualArchitectureView, {
        architecture: mockArchitecture,
        isLoading: false,
        error: null,
        onOpenAskDoctor: vi.fn(),
      }),
    );

    expect(html).toContain('Architecture &amp; Execution Flows');
    expect(html).toContain('Execution Flow');
    expect(html).toContain('Layered Topology');
    expect(html).toContain('Relationships Table');
    expect(html).toContain('Filters');
  });

  it('FeatureExplorerView navigates Feature -> Flow -> Component -> Evidence hierarchy', () => {
    const html = renderToStaticMarkup(
      React.createElement(FeatureExplorerView, {
        features: [],
        projectFeatures: mockDashboard.businessFeatures,
        isLoading: false,
        error: null,
        onAskQuestion: vi.fn(),
        onOpenAskDoctor: vi.fn(),
        onNavigateArchitectureFlow: vi.fn(),
      }),
    );

    expect(html).toContain('Features &amp; Code Explorer');
    expect(html).toContain('User Checkout Flow');
    expect(html).toContain('Discovered Features');
    expect(html).toContain('Participating Components &amp; Architecture Roles');
  });
});
