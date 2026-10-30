'use client';

import React, { useState } from 'react';
import type {
  ProjectDashboardDto,
  BusinessFeatureDto,
  ArchitecturalInsightDto,
} from '@repo-doctor/shared';
import { EmptyState } from './atlassian/EmptyState';
import { Button } from './atlassian/Button';
import { Lozenge } from './atlassian/Lozenge';
import { Badge } from './atlassian/Badge';

interface OverviewViewProps {
  readonly dashboard: ProjectDashboardDto | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onOpenManageRepos: () => void;
  readonly onAnalyzeProject: () => void;
  readonly isAnalyzingProject: boolean;
  readonly onAskQuestion: (initialQuestion: string) => void;
  readonly onSelectTab: (tab: 'dashboard' | 'features' | 'architecture') => void;
  readonly onUnlinkRepo: (repoId: string) => Promise<void>;
  readonly onSelectRepoForInvestigation?: (repoId: string) => void;
  readonly onOpenFeatureKT?: (feature: BusinessFeatureDto) => void;
  readonly onNavigateToFeatureFlow?: (featureId: string) => void;
}

const POPULAR_QUESTIONS = [
  'Explain how user login works end to end across frontend and backend.',
  'What are the consequences of changing auth.service.ts?',
  'I am new to this project: give me KT on the main features.',
  'Which components participate in user authentication?',
  'What happens if I modify a service in cadence-api?',
];

export function OverviewView({
  dashboard,
  isLoading,
  error,
  onOpenManageRepos,
  onAnalyzeProject,
  isAnalyzingProject,
  onAskQuestion,
  onSelectTab,
  onUnlinkRepo,
  onSelectRepoForInvestigation,
  onOpenFeatureKT,
  onNavigateToFeatureFlow,
}: OverviewViewProps): React.JSX.Element {
  const [quickQuery, setQuickQuery] = useState('');
  const [unlinkingRepoId, setUnlinkingRepoId] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (isLoading) {
    return (
      <div
        className="card-section"
        data-testid="overview-loading"
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          backgroundColor: '#ffffff',
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        }}
      >
        <div style={{ display: 'inline-flex', marginBottom: '16px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0052cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.2s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', margin: '0 0 4px 0' }}>
          Loading Project Overview...
        </h3>
        <p style={{ color: '#6b778c', fontSize: '13px', margin: 0 }}>
          Correlating multi-repository architecture, business features, and evidence.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="alert-forbidden"
        data-testid="overview-error"
        style={{
          padding: '16px 20px',
          backgroundColor: '#ffebe6',
          border: '1px solid #ffbdad',
          borderRadius: '3px',
          color: '#de350b',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>Unable to Load Project</h3>
        <p style={{ fontSize: '13px', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!dashboard || dashboard.totalRepositories === 0) {
    return (
      <EmptyState
        testId="overview-empty"
        header="No Repositories Linked to this Project"
        description="Link repositories (such as your web frontend, backend API, or shared packages) to map cross-repository workflows, trace execution from browser to database, and ask architectural questions."
        primaryAction={
          <Button
            appearance="primary"
            data-testid="link-repositories-btn"
            onClick={onOpenManageRepos}
          >
            + Manage Project Repositories
          </Button>
        }
      />
    );
  }

  const isAnalysisReady =
    dashboard.analyzedRepositoriesCount === dashboard.totalRepositories &&
    dashboard.totalRepositories > 0 &&
    dashboard.repositories.every((r) => r.analysisStatus === 'READY');

  const handleQuickSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    onAskQuestion(quickQuery.trim());
    setQuickQuery('');
  };

  const handleUnlink = async (repoId: string): Promise<void> => {
    setUnlinkingRepoId(repoId);
    try {
      await onUnlinkRepo(repoId);
    } finally {
      setUnlinkingRepoId(null);
    }
  };

  return (
    <div data-testid="overview-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 1. Hero Summary: Answering Which Project, Status, & Next Action ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#ffffff',
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          padding: '20px 24px',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            {/* Project identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '3px',
                  backgroundColor: '#deebff',
                  color: '#0052cc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#172b4d', margin: 0, letterSpacing: '-0.01em' }}>
                {dashboard.project.name}
              </h1>

              {/* Analysis status badge */}
              {isAnalysisReady ? (
                <Lozenge appearance="success">
                  Analysis Ready ({dashboard.analyzedRepositoriesCount}/{dashboard.totalRepositories} repos)
                </Lozenge>
              ) : (
                <Lozenge appearance="moved">
                  Analysis Needed ({dashboard.analyzedRepositoriesCount}/{dashboard.totalRepositories} indexed)
                </Lozenge>
              )}
            </div>

            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b778c', lineHeight: 1.5 }}>
              {dashboard.project.description ||
                'Unified architecture, feature execution flows, and evidence-grounded Q&A engine across all linked repositories.'}
            </p>

            {/* Linked Repositories chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b778c' }}>Linked Repos:</span>
              {dashboard.repositories.map((item) => (
                <span
                  key={item.repository.id}
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    backgroundColor: '#fafbfc',
                    color: '#172b4d',
                    border: '1px solid #dfe1e6',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b778c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                  <span>{item.repository.githubOrg}/{item.repository.name}</span>
                </span>
              ))}
              <Button
                appearance="subtle"
                spacing="compact"
                onClick={onOpenManageRepos}
              >
                + Manage
              </Button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              appearance="default"
              data-testid="manage-repos-btn"
              onClick={onOpenManageRepos}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42526e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Manage Repositories</span>
            </Button>

            {!isAnalysisReady ? (
              <Button
                appearance="primary"
                data-testid="analyze-project-btn"
                onClick={onAnalyzeProject}
                disabled={isAnalyzingProject}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>{isAnalyzingProject ? 'Analyzing Repositories...' : 'Analyze Project'}</span>
              </Button>
            ) : (
              <Button
                appearance="primary"
                data-testid="explore-project-btn"
                onClick={() => onSelectTab('features')}
              >
                <span>Explore Project Features</span>
                <span style={{ marginLeft: '4px' }}>&rarr;</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Prominent Conversational "Ask RepoDoctor" Input ── */}
      <div
        style={{
          border: '1px solid #dfe1e6',
          backgroundColor: '#fafbfc',
          borderRadius: '3px',
          padding: '20px',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '3px',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#172b4d', margin: 0 }}>
              Ask RepoDoctor About This System
            </h2>
            <p style={{ fontSize: '13px', color: '#6b778c', margin: 0 }}>
              Ask how a feature works from the frontend to the database, trace dependencies, or identify blast radius.
            </p>
          </div>
        </div>

        <form onSubmit={handleQuickSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            data-testid="overview-ask-input"
            placeholder="e.g. How does user signup work from frontend to database?"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            style={{
              flex: 1,
              height: '36px',
              padding: '0 12px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              borderRadius: '3px',
              border: '1px solid #dfe1e6',
              color: '#172b4d',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#4c9aff';
              e.currentTarget.style.boxShadow = '0 0 0 1px #4c9aff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#dfe1e6';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <Button
            appearance="primary"
            data-testid="overview-ask-btn"
            type="submit"
            style={{ height: '36px' }}
          >
            Ask RepoDoctor
          </Button>
        </form>

        {/* Suggested Starter Questions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b778c' }}>Suggestions:</span>
          {POPULAR_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAskQuestion(q)}
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '3px',
                backgroundColor: 'rgba(9, 30, 66, 0.04)',
                border: 'none',
                color: '#0052cc',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontWeight: 500,
                transition: 'background-color 0.1s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.04)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2.5 New Developer Onboarding: System Architecture Blueprint ── */}
      <div
        style={{
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          padding: '20px',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  backgroundColor: '#eae6ff',
                  color: '#5243aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#172b4d', margin: 0 }}>
                New Developer Onboarding: System Architecture Blueprint
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b778c', lineHeight: 1.5 }}>
              Unfamiliar with this codebase? Here is how this multi-repository system connects client user interfaces, backend API routes, business logic, and databases.
            </p>
          </div>

          <Button
            appearance="default"
            onClick={() => onSelectTab('architecture')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42526e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span>Open Interactive Storyboard &rarr;</span>
          </Button>
        </div>

        {/* 3-Tier Multi-Repo Flow Visualization */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
            padding: '14px',
            backgroundColor: '#fafbfc',
            borderRadius: '3px',
            border: '1px solid #dfe1e6',
            marginBottom: '14px',
          }}
        >
          {/* Step 1: Client Web */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #dfe1e6', borderRadius: '3px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 1px rgba(9, 30, 66, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Lozenge appearance="inprogress">
                LAYER 1 &bull; CLIENT UI
              </Lozenge>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0052cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#172b4d' }}>
              cadence-web
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b778c', lineHeight: 1.45 }}>
              Next.js 14 App Router, React 18, Tailwind CSS. Renders views and issues REST HTTP API calls.
            </p>
          </div>

          {/* Step 2: Backend API */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #dfe1e6', borderRadius: '3px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 1px rgba(9, 30, 66, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Lozenge appearance="success">
                LAYER 2 &bull; API &amp; LOGIC
              </Lozenge>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00875a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#172b4d' }}>
              cadence-api
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b778c', lineHeight: 1.45 }}>
              NestJS backend. Contains REST Controllers, JwtAuthGuard, domain Services, and TypeORM entities.
            </p>
          </div>

          {/* Step 3: Database & Queue */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #dfe1e6', borderRadius: '3px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 1px rgba(9, 30, 66, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Lozenge appearance="new">
                LAYER 3 &bull; PERSISTENCE
              </Lozenge>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5243aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#172b4d' }}>
              PostgreSQL 16 &amp; Redis
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b778c', lineHeight: 1.45 }}>
              ACID relational tables (Users, Projects, Tasks) + pgvector semantic embeddings + BullMQ workers.
            </p>
          </div>
        </div>

        {/* Quick Knowledge Transfer Questions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', backgroundColor: '#fafbfc', padding: '10px 14px', borderRadius: '3px', border: '1px solid #dfe1e6' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#42526e', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="22" x2="14" y2="22" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
            <span>Quick KT for new team members:</span>
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Button
              appearance="default"
              spacing="compact"
              onClick={() => onAskQuestion('I am new to this project: give me an executive KT on the architecture and key features.')}
            >
              Executive Onboarding KT
            </Button>
            <Button
              appearance="default"
              spacing="compact"
              onClick={() => onAskQuestion('What happens if I modify a service in cadence-api? What are the breaking consequences?')}
            >
              Blast Radius &amp; Breaking Risks
            </Button>
            <Button
              appearance="default"
              spacing="compact"
              onClick={() => onAskQuestion('Explain how user login works end to end across frontend and backend.')}
            >
              Trace Auth Flow
            </Button>
          </div>
        </div>
      </div>

      {/* ── 3. Evidence-Backed Feature Capabilities ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', margin: 0 }}>
              System Features &amp; Capabilities
            </h2>
            <p style={{ fontSize: '13px', color: '#6b778c', margin: 0 }}>
              Verified end-to-end functionality mapped across frontend routes, services, and databases
            </p>
          </div>
          <Button
            appearance="default"
            onClick={() => onSelectTab('architecture')}
          >
            <span>View Visual Architecture</span>
            <span style={{ marginLeft: '4px' }}>&rarr;</span>
          </Button>
        </div>

        {dashboard.businessFeatures.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
            }}
          >
            <p style={{ color: '#6b778c', fontSize: '13px', margin: 0 }}>
              No business features discovered yet. Click <strong>Analyze Project</strong> to parse source ASTs and extract capabilities.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {dashboard.businessFeatures.map((feat: BusinessFeatureDto) => (
              <div
                key={feat.id}
                data-testid={`feature-card-${feat.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  border: '1px solid #dfe1e6',
                  borderRadius: '3px',
                  boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
                  backgroundColor: '#ffffff',
                  padding: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#172b4d', margin: 0 }}>
                      {feat.title}
                    </h3>
                    <Lozenge appearance="inprogress">
                      {feat.category}
                    </Lozenge>
                  </div>

                  <p style={{ fontSize: '13px', color: '#6b778c', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                    {feat.description}
                  </p>

                  {/* Participating Components */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b778c', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                      PARTICIPATING COMPONENTS &amp; METHODS:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {feat.participatingComponents.slice(0, 4).map((comp) => (
                        <span
                          key={comp.id}
                          style={{
                            fontSize: '12px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: '#fafbfc',
                            color: '#172b4d',
                            border: '1px solid #dfe1e6',
                          }}
                        >
                          <strong>{comp.name}</strong>
                          {comp.primaryMethod && (
                            <span style={{ color: '#0052cc', fontFamily: 'monospace', fontWeight: 600 }}>
                              {' '}&rarr; {comp.primaryMethod}
                            </span>
                          )}
                          <span style={{ color: '#6b778c', fontSize: '11px' }}> ({comp.repositoryName})</span>
                        </span>
                      ))}
                      {feat.participatingComponents.length > 4 && (
                        <span style={{ fontSize: '12px', color: '#6b778c', alignSelf: 'center' }}>
                          +{feat.participatingComponents.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Connected Stores */}
                  {feat.dataStores.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#006644', marginTop: '6px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                      <span>Persistence: <strong>{feat.dataStores.join(', ')}</strong></span>
                    </div>
                  )}
                </div>

                {/* Feature Actions */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #dfe1e6', paddingTop: '10px' }}>
                  <Button
                    appearance="primary"
                    onClick={() => {
                      if (onOpenFeatureKT) {
                        onOpenFeatureKT(feat);
                      } else {
                        onAskQuestion(`Explain the complete system flow for ${feat.title}`);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    Get Feature KT &amp; Flow
                  </Button>
                  <Button
                    appearance="default"
                    onClick={() => {
                      if (onNavigateToFeatureFlow) {
                        onNavigateToFeatureFlow(feat.id);
                      } else {
                        onSelectTab('architecture');
                      }
                    }}
                    title="View connected architecture flow & storyboard"
                  >
                    <span>Storyboard</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Architectural Highlights & Insights ── */}
      {dashboard.architecturalInsights && dashboard.architecturalInsights.length > 0 && (
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', margin: '0 0 12px 0' }}>
            System Architecture Insights
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {dashboard.architecturalInsights.map((insight: ArchitecturalInsightDto, idx: number) => {
              const isWarning = insight.severity === 'WARNING';
              const isCritical = insight.severity === 'CRITICAL';
              const appearance = isCritical ? 'removed' : isWarning ? 'moved' : 'success';

              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '3px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #dfe1e6',
                    boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#172b4d' }}>{insight.title}</span>
                    <Lozenge appearance={appearance}>
                      {insight.severity}
                    </Lozenge>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b778c', lineHeight: 1.5 }}>
                    {insight.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Secondary Details: System Metrics & Raw Repository Tables (Collapsible) ── */}
      <div
        style={{
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          boxShadow: '0 1px 1px rgba(9, 30, 66, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d', margin: 0 }}>
              Technical System Metrics &amp; Repository Details
            </h3>
            <p style={{ fontSize: '12px', color: '#6b778c', margin: 0 }}>
              Raw component nodes, extracted edges, and per-repository indexing health
            </p>
          </div>
          <Button
            appearance="default"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          >
            {showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}
          </Button>
        </div>

        {showTechnicalDetails && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* High-level KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', backgroundColor: '#fafbfc', borderRadius: '3px', border: '1px solid #dfe1e6' }}>
                <div style={{ fontSize: '11px', color: '#6b778c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LINKED REPOSITORIES</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#172b4d', marginTop: '4px' }}>
                  {dashboard.totalRepositories}
                </div>
              </div>
              <div style={{ padding: '12px 14px', backgroundColor: '#fafbfc', borderRadius: '3px', border: '1px solid #dfe1e6' }}>
                <div style={{ fontSize: '11px', color: '#6b778c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>INDEXED REPOSITORIES</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#00875a', marginTop: '4px' }}>
                  {dashboard.analyzedRepositoriesCount} / {dashboard.totalRepositories}
                </div>
              </div>
              <div style={{ padding: '12px 14px', backgroundColor: '#fafbfc', borderRadius: '3px', border: '1px solid #dfe1e6' }}>
                <div style={{ fontSize: '11px', color: '#6b778c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>DISCOVERED CAPABILITIES</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#0052cc', marginTop: '4px' }}>
                  {dashboard.businessFeatures.length}
                </div>
              </div>
              <div style={{ padding: '12px 14px', backgroundColor: '#fafbfc', borderRadius: '3px', border: '1px solid #dfe1e6' }}>
                <div style={{ fontSize: '11px', color: '#6b778c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CROSS-REPO EDGES</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffab00', marginTop: '4px' }}>
                  {dashboard.crossRepoDependenciesCount}
                </div>
              </div>
            </div>

            {/* Repositories Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dfe1e6', color: '#6b778c', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 10px' }}>Repository</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                    <th style={{ padding: '8px 10px' }}>Extracted Nodes</th>
                    <th style={{ padding: '8px 10px' }}>Extracted Edges</th>
                    <th style={{ padding: '8px 10px' }}>Health Score</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.repositories.map((item) => (
                    <tr key={item.repository.id} style={{ borderBottom: '1px solid #dfe1e6' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#172b4d' }}>
                        {item.repository.githubOrg}/{item.repository.name}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {item.totalNodes === 0 && item.analysisStatus === 'READY' ? (
                          <Lozenge appearance="moved">
                            EMPTY (0 CODE FILES)
                          </Lozenge>
                        ) : (
                          <Lozenge
                            appearance={
                              item.analysisStatus === 'READY'
                                ? 'success'
                                : item.analysisStatus === 'INDEXING'
                                ? 'inprogress'
                                : 'default'
                            }
                          >
                            {item.analysisStatus}
                          </Lozenge>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: '#42526e' }}>{item.totalNodes}</td>
                      <td style={{ padding: '10px', color: '#42526e' }}>{item.totalEdges}</td>
                      <td style={{ padding: '10px' }}>
                        <Badge appearance={item.healthScore >= 80 ? 'added' : 'important'}>
                          {item.healthScore}%
                        </Badge>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {onSelectRepoForInvestigation && (
                            <Button
                              appearance="default"
                              spacing="compact"
                              onClick={() => {
                                onSelectRepoForInvestigation(item.repository.id);
                                onSelectTab('features');
                              }}
                            >
                              Explore Code
                            </Button>
                          )}
                          <Button
                            appearance="subtle"
                            spacing="compact"
                            onClick={() => handleUnlink(item.repository.id)}
                            disabled={unlinkingRepoId === item.repository.id}
                            style={{ color: '#de350b' }}
                          >
                            {unlinkingRepoId === item.repository.id ? 'Unlinking...' : 'Unlink'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OverviewView;
