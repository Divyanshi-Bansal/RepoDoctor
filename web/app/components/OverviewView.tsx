'use client';

import React, { useState } from 'react';
import type {
  ProjectDashboardDto,
  BusinessFeatureDto,
  ArchitecturalInsightDto,
} from '@repo-doctor/shared';

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
      <div className="card-section" data-testid="overview-loading" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
          Loading Project Overview...
        </h3>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem' }}>
          Correlating multi-repository architecture, business features, and evidence.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-forbidden" data-testid="overview-error">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Unable to Load Project</h3>
        <p style={{ fontSize: '0.95rem', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!dashboard || dashboard.totalRepositories === 0) {
    return (
      <div className="empty-state-box" data-testid="overview-empty" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏗️</div>
        <h3 className="empty-state-title" style={{ fontSize: '1.4rem', fontWeight: 800 }}>No Repositories Linked to this Project</h3>
        <p className="empty-state-text" style={{ maxWidth: '560px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
          Link repositories (such as your web frontend, backend API, or shared packages) to map cross-repository workflows, trace execution from browser to database, and ask architectural questions.
        </p>
        <button
          type="button"
          className="primary-btn"
          data-testid="link-repositories-btn"
          onClick={onOpenManageRepos}
          style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
        >
          + Manage Project Repositories
        </button>
      </div>
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
    <div data-testid="overview-view" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── 1. Hero Summary: Answering Which Project, Status, & Next Action ── */}
      <div
        className="card-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            {/* Project identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.5rem' }}>📂</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                {dashboard.project.name}
              </h1>
              {/* Analysis status badge */}
              {isAnalysisReady ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>✓</span> Analysis Ready ({dashboard.analyzedRepositoriesCount}/{dashboard.totalRepositories} repos)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>⚡</span> Analysis Needed ({dashboard.analyzedRepositoriesCount}/{dashboard.totalRepositories} indexed)
                </span>
              )}
            </div>

            <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', color: '#475569', lineHeight: 1.5 }}>
              {dashboard.project.description ||
                'Unified architecture, feature execution flows, and evidence-grounded Q&A engine across all linked repositories.'}
            </p>

            {/* Linked Repositories chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Linked Repos:</span>
              {dashboard.repositories.map((item) => (
                <span
                  key={item.repository.id}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontWeight: 500,
                  }}
                >
                  📁 {item.repository.githubOrg}/{item.repository.name}
                </span>
              ))}
              <button
                type="button"
                onClick={onOpenManageRepos}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.2rem 0.4rem',
                }}
              >
                + Manage
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="secondary-btn"
              data-testid="manage-repos-btn"
              onClick={onOpenManageRepos}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem' }}
            >
              <span>⚙️</span>
              <span>Manage Repositories</span>
            </button>

            {!isAnalysisReady ? (
              <button
                type="button"
                className="primary-btn"
                data-testid="analyze-project-btn"
                onClick={onAnalyzeProject}
                disabled={isAnalyzingProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                <span>{isAnalyzingProject ? '⏳' : '⚡'}</span>
                <span>{isAnalyzingProject ? 'Analyzing Repositories...' : 'Analyze Project'}</span>
              </button>
            ) : (
              <button
                type="button"
                className="primary-btn"
                data-testid="explore-project-btn"
                onClick={() => onSelectTab('features')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                <span>🧭</span>
                <span>Explore Project Features</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Prominent Conversational "Ask RepoDoctor" Input ── */}
      <div
        className="card-section"
        style={{
          border: '1.5px solid #bfdbfe',
          backgroundColor: '#eff6ff',
          borderRadius: '12px',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            💬
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e3a8a', margin: 0 }}>
              Ask RepoDoctor About This System
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#3b82f6', margin: 0 }}>
              Ask how a feature works from the frontend to the database, trace dependencies, or identify blast radius.
            </p>
          </div>
        </div>

        <form onSubmit={handleQuickSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            data-testid="overview-ask-input"
            className="input-field"
            placeholder="e.g. How does user signup work from frontend to database?"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.8rem 1.1rem',
              fontSize: '0.95rem',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
          <button
            type="submit"
            data-testid="overview-ask-btn"
            className="primary-btn"
            style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', fontWeight: 600 }}
          >
            Ask RepoDoctor
          </button>
        </form>

        {/* Suggested Starter Questions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Suggestions:</span>
          {POPULAR_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAskQuestion(q)}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2.5 New Developer Onboarding: System Architecture Blueprint ── */}
      <div
        className="card-section"
        style={{
          border: '1.5px solid #cbd5e1',
          borderRadius: '12px',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🚀</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                New Developer Onboarding: System Architecture Blueprint
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
              Unfamiliar with this codebase? Here is how this multi-repository system connects client user interfaces, backend API routes, business logic, and databases.
            </p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => onSelectTab('architecture')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
          >
            🎬 Open Interactive Storyboard ➔
          </button>
        </div>

        {/* 3-Tier Multi-Repo Flow Visualization */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.25rem',
          }}
        >
          {/* Step 1: Client Web */}
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #dbeafe', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', backgroundColor: '#eff6ff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                LAYER 1 &bull; CLIENT UI
              </span>
              <span style={{ fontSize: '1.1rem' }}>🖥️</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              cadence-web
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
              Next.js 14 App Router, React 18, Tailwind CSS. Renders views and issues REST HTTP API calls.
            </p>
          </div>

          {/* Step 2: Backend API */}
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #bbf7d0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#f0fdf4', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                LAYER 2 &bull; API &amp; LOGIC
              </span>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              cadence-api
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
              NestJS backend. Contains REST Controllers, JwtAuthGuard, domain Services, and TypeORM entities.
            </p>
          </div>

          {/* Step 3: Database & Queue */}
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #e9d5ff', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7e22ce', backgroundColor: '#faf5ff', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                LAYER 3 &bull; PERSISTENCE
              </span>
              <span style={{ fontSize: '1.1rem' }}>🗄️</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              PostgreSQL 16 &amp; Redis
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
              ACID relational tables (Users, Projects, Tasks) + pgvector semantic embeddings + BullMQ workers.
            </p>
          </div>
        </div>

        {/* Quick Knowledge Transfer Questions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
            💡 Quick KT for new team members:
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onAskQuestion('I am new to this project: give me an executive KT on the architecture and key features.')}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#1e40af', fontWeight: 600, cursor: 'pointer' }}
            >
              🎓 Executive Onboarding KT
            </button>
            <button
              type="button"
              onClick={() => onAskQuestion('What happens if I modify a service in cadence-api? What are the breaking consequences?')}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#92400e', fontWeight: 600, cursor: 'pointer' }}
            >
              ⚠️ Blast Radius &amp; Breaking Risks
            </button>
            <button
              type="button"
              onClick={() => onAskQuestion('Explain how user login works end to end across frontend and backend.')}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#15803d', fontWeight: 600, cursor: 'pointer' }}
            >
              🔐 Trace Auth Flow
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Evidence-Backed Feature Capabilities ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              System Features &amp; Capabilities
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
              Verified end-to-end functionality mapped across frontend routes, services, and databases
            </p>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => onSelectTab('architecture')}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
          >
            View Visual Architecture ➔
          </button>
        </div>

        {dashboard.businessFeatures.length === 0 ? (
          <div className="card-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <p style={{ color: '#64748b', margin: 0 }}>
              No business features discovered yet. Click <strong>Analyze Project</strong> to parse source ASTs and extract capabilities.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {dashboard.businessFeatures.map((feat: BusinessFeatureDto) => (
              <div
                key={feat.id}
                className="card-section"
                data-testid={`feature-card-${feat.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  backgroundColor: '#ffffff',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {feat.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                      }}
                    >
                      {feat.category}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: '0 0 0.85rem' }}>
                    {feat.description}
                  </p>

                  {/* Participating Components */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>
                      PARTICIPATING COMPONENTS &amp; METHODS:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {feat.participatingComponents.slice(0, 4).map((comp) => (
                        <span
                          key={comp.id}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          <strong>{comp.name}</strong>
                          {comp.primaryMethod && (
                            <span style={{ color: '#2563eb', fontFamily: 'monospace', fontWeight: 600 }}>
                              {' '}➔ {comp.primaryMethod}
                            </span>
                          )}
                          <span style={{ color: '#64748b', fontSize: '0.7rem' }}> ({comp.repositoryName})</span>
                        </span>
                      ))}
                      {feat.participatingComponents.length > 4 && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>
                          +{feat.participatingComponents.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Connected Stores */}
                  {feat.dataStores.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#047857' }}>
                      <span>🗄️ Persistence:</span>
                      <span style={{ fontWeight: 600 }}>{feat.dataStores.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Feature Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      if (onOpenFeatureKT) {
                        onOpenFeatureKT(feat);
                      } else {
                        onAskQuestion(`Explain the complete system flow for ${feat.title}`);
                      }
                    }}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600, backgroundColor: '#4f46e5' }}
                  >
                    🎓 Get Feature KT &amp; Flow
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      if (onNavigateToFeatureFlow) {
                        onNavigateToFeatureFlow(feat.id);
                      } else {
                        onSelectTab('architecture');
                      }
                    }}
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    title="View connected architecture flow & storyboard"
                  >
                    <span>🎬</span>
                    <span>Storyboard</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Architectural Highlights & Insights ── */}
      {dashboard.architecturalInsights && dashboard.architecturalInsights.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginBottom: '0.75rem' }}>
            System Architecture Insights
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {dashboard.architecturalInsights.map((insight: ArchitecturalInsightDto, idx: number) => {
              const isWarning = insight.severity === 'WARNING';
              const isCritical = insight.severity === 'CRITICAL';
              const bg = isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f8fafc';
              const border = isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#e2e8f0';
              const textCol = isCritical ? '#991b1b' : isWarning ? '#92400e' : '#1e293b';

              return (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    backgroundColor: bg,
                    border: `1px solid ${border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '1rem' }}>{isCritical ? '⚠️' : isWarning ? '⚡' : '💡'}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: textCol }}>{insight.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                    {insight.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Secondary Details: System Metrics & Raw Repository Tables (Collapsible) ── */}
      <div className="card-section" style={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#334155', margin: 0 }}>
              Technical System Metrics &amp; Repository Details
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              Raw component nodes, extracted edges, and per-repository indexing health
            </p>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
          >
            {showTechnicalDetails ? 'Hide Technical Details ▴' : 'Show Technical Details ▾'}
          </button>
        </div>

        {showTechnicalDetails && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* High-level KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LINKED REPOSITORIES</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                  {dashboard.totalRepositories}
                </div>
              </div>
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>INDEXED REPOSITORIES</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                  {dashboard.analyzedRepositoriesCount} / {dashboard.totalRepositories}
                </div>
              </div>
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>DISCOVERED CAPABILITIES</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                  {dashboard.businessFeatures.length}
                </div>
              </div>
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CROSS-REPO EDGES</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                  {dashboard.crossRepoDependenciesCount}
                </div>
              </div>
            </div>

            {/* Repositories Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Repository</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Extracted Nodes</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Extracted Edges</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Health Score</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.repositories.map((item) => (
                    <tr key={item.repository.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                        📁 {item.repository.githubOrg}/{item.repository.name}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {item.totalNodes === 0 && item.analysisStatus === 'READY' ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                            }}
                            title="0 supported TypeScript/JavaScript source files found in this repository on GitHub"
                          >
                            EMPTY (0 CODE FILES)
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor:
                                item.analysisStatus === 'READY'
                                  ? '#dcfce7'
                                  : item.analysisStatus === 'INDEXING'
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                              color:
                                item.analysisStatus === 'READY'
                                  ? '#166534'
                                  : item.analysisStatus === 'INDEXING'
                                  ? '#92400e'
                                  : '#64748b',
                            }}
                          >
                            {item.analysisStatus}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: '#334155' }}>{item.totalNodes}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: '#334155' }}>{item.totalEdges}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span style={{ fontWeight: 700, color: item.healthScore >= 80 ? '#16a34a' : '#d97706' }}>
                          {item.healthScore}%
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {onSelectRepoForInvestigation && (
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => {
                                onSelectRepoForInvestigation(item.repository.id);
                                onSelectTab('features');
                              }}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              Explore Code
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => handleUnlink(item.repository.id)}
                            disabled={unlinkingRepoId === item.repository.id}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#dc2626' }}
                          >
                            {unlinkingRepoId === item.repository.id ? 'Unlinking...' : 'Unlink'}
                          </button>
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
