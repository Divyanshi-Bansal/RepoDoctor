'use client';

import React from 'react';
import type { RepositoryDashboardDto } from '@repo-doctor/shared';

interface DashboardViewProps {
  readonly dashboard: RepositoryDashboardDto | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onAnalyze?: () => void;
  readonly isAnalyzing?: boolean;
  readonly repositoriesCount?: number;
  readonly githubUsername?: string | null;
  readonly onConnectGitHub?: () => void;
  readonly onRefreshRepositories?: () => void;
  readonly onOpenRepoModal?: () => void;
}

export function DashboardView({
  dashboard,
  isLoading,
  error,
  onAnalyze,
  isAnalyzing,
  repositoriesCount,
  githubUsername,
  onConnectGitHub,
  onRefreshRepositories,
  onOpenRepoModal,
}: DashboardViewProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="card-section" data-testid="dashboard-loading" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
          Loading repository overview and health metrics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-forbidden" data-testid="dashboard-error">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Access Blocked</h3>
        <p style={{ fontSize: '0.95rem' }}>{error}</p>
      </div>
    );
  }

  // No active repository selected or 0 repositories
  if (!dashboard) {
    if (repositoriesCount === 0) {
      return (
        <div className="empty-state-box" data-testid="no-repositories-card">
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
          <h3 className="empty-state-title">No Repositories Accessible</h3>
          <p className="empty-state-text">
            {!githubUsername
              ? 'Connect your GitHub or GitLab account to discover, index, and analyze your repositories.'
              : `Your connected account (@${githubUsername}) has not returned any accessible repositories yet. Check your provider permissions or click refresh below.`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {!githubUsername && onConnectGitHub && (
              <button
                type="button"
                className="primary-btn"
                onClick={onConnectGitHub}
              >
                Authorize with GitHub
              </button>
            )}
            {onRefreshRepositories && (
              <button
                type="button"
                className="secondary-btn"
                onClick={onRefreshRepositories}
              >
                ↻ Refresh Repositories
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="empty-state-box" data-testid="dashboard-empty">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📁</div>
        <h3 className="empty-state-title">No Repository Selected</h3>
        <p className="empty-state-text">
          Choose a repository from your connected providers to view system health, architecture topology, and code evidence.
        </p>
        {onOpenRepoModal && (
          <button
            type="button"
            className="primary-btn"
            data-testid="empty-select-repo-btn"
            onClick={onOpenRepoModal}
          >
            Select a Repository
          </button>
        )}
      </div>
    );
  }

  const { repository, analysisStatus, lastAnalyzedAt, healthScore } = dashboard;
  const isUnanalyzed = analysisStatus === 'NOT_ANALYZED';

  const formattedDate = lastAnalyzedAt
    ? new Date(lastAnalyzedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never';

  return (
    <div data-testid="technical-dashboard">
      {/* Selected Repository Header Summary */}
      <div
        className="card-section"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {repository.githubOrg} / {repository.name}
            </h1>
            <span
              className={
                analysisStatus === 'READY'
                  ? 'badge-success'
                  : analysisStatus === 'INDEXING'
                  ? 'badge-info'
                  : 'badge-warning'
              }
              data-testid="repo-analysis-status-badge"
            >
              {analysisStatus === 'READY' ? 'Analysis Complete' : analysisStatus === 'INDEXING' ? 'Indexing...' : 'Pending Analysis'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <span>Default branch: <strong>{repository.defaultBranch || 'main'}</strong></span>
            <span>•</span>
            <span>Last analyzed: {formattedDate}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {onOpenRepoModal && (
            <button
              type="button"
              className="secondary-btn"
              onClick={onOpenRepoModal}
            >
              Change Repository
            </button>
          )}

          {onAnalyze && (
            <button
              type="button"
              className="primary-btn"
              data-testid="run-analysis-btn"
              onClick={onAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing
                ? 'Analyzing Repository...'
                : isUnanalyzed
                ? 'Analyze Repository'
                : '↻ Re-analyze'}
            </button>
          )}
        </div>
      </div>

      {/* Prominent Callout when Repository has NOT been analyzed */}
      {isUnanalyzed && (
        <div
          className="card-section"
          style={{
            border: '1px solid #bfdbfe',
            backgroundColor: 'var(--accent-blue-subtle)',
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '2rem',
          }}
          data-testid="pending-analysis-banner"
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.5rem' }}>
            Repository Pending Static Analysis
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
            Running static analysis parses the repository&apos;s source files with AST Tree-sitter / Babel, discovers system components (services, databases, queues, endpoints), and builds verified code evidence citations.
          </p>
          <button
            type="button"
            className="primary-btn"
            data-testid="pending-banner-analyze-btn"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            style={{ padding: '0.65rem 1.5rem', fontSize: '1rem' }}
          >
            {isAnalyzing ? 'Analyzing Repository...' : 'Run Static Analysis Now'}
          </button>
        </div>
      )}

      {/* Real Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card" data-testid="metric-health-score">
          <div className="metric-label">Architecture Health Score</div>
          <div
            className="metric-value"
            style={{
              color: isUnanalyzed
                ? 'var(--text-muted)'
                : healthScore >= 70
                ? 'var(--accent-green)'
                : 'var(--accent-yellow)',
            }}
          >
            {isUnanalyzed ? '—' : `${healthScore} / 100`}
          </div>
          <div className="metric-sub">
            {isUnanalyzed ? 'Awaiting static code analysis' : `Status: ${analysisStatus}`}
          </div>
        </div>

        <div className="metric-card" data-testid="metric-components-total">
          <div className="metric-label">Detected Components</div>
          <div className="metric-value">
            {isUnanalyzed ? '—' : dashboard.totalNodes}
          </div>
          <div className="metric-sub">
            {isUnanalyzed ? 'AST parsing required' : `${dashboard.totalEdges} verified relationships`}
          </div>
        </div>

        <div className="metric-card" data-testid="metric-evidence-count">
          <div className="metric-label">Evidence Grounding Citations</div>
          <div className="metric-value" style={{ color: isUnanalyzed ? 'var(--text-muted)' : 'var(--accent-blue)' }}>
            {isUnanalyzed ? '—' : dashboard.totalEvidenceCount}
          </div>
          <div className="metric-sub">
            {isUnanalyzed ? 'Line-level citations pending' : 'Zero ungrounded assertions'}
          </div>
        </div>

        <div className="metric-card" data-testid="metric-services-breakdown">
          <div className="metric-label">Component Breakdown</div>
          <div className="metric-value" style={{ fontSize: '1.6rem' }}>
            {isUnanalyzed ? (
              '—'
            ) : (
              <>
                {dashboard.components.services} <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>services</span>
                {' · '}
                {dashboard.components.packages} <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>packages</span>
              </>
            )}
          </div>
          <div className="metric-sub">
            {isUnanalyzed
              ? 'Services, databases & queues'
              : `${dashboard.components.databases} database(s), ${dashboard.components.queues} queue(s), ${dashboard.components.endpoints} endpoint(s)`}
          </div>
        </div>
      </div>

      {/* Key Architectural Insights */}
      <section className="card-section" data-testid="dashboard-insights-section">
        <h2 className="section-title">Key Architectural Insights</h2>
        {isUnanalyzed ? (
          <p style={{ color: 'var(--text-muted)' }}>
            Architectural insights, coupling warnings, and coverage analysis will appear here after running static analysis.
          </p>
        ) : dashboard.insights.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No anomalies or warnings detected for this repository.</p>
        ) : (
          dashboard.insights.map((insight, idx) => (
            <div key={`${insight.type}-${idx}`} className="insight-item" data-testid={`insight-item-${idx}`}>
              <div className="insight-header">
                <span className="insight-title">{insight.title}</span>
                <span
                  className={
                    insight.severity === 'CRITICAL'
                      ? 'badge-critical'
                      : insight.severity === 'WARNING'
                      ? 'badge-warning'
                      : 'badge-info'
                  }
                >
                  {insight.severity} • {insight.type}
                </span>
              </div>
              <p className="insight-desc">{insight.description}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
