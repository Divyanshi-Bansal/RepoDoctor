'use client';

import React, { useState } from 'react';
import type {
  FeatureItemDto,
  FeatureQuestionResponseDto,
  BusinessFeatureDto,
} from '@repo-doctor/shared';

interface FeatureExplorerViewProps {
  readonly features: readonly FeatureItemDto[];
  readonly projectFeatures?: readonly BusinessFeatureDto[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onAskQuestion: (nodeId: string, question: string) => Promise<FeatureQuestionResponseDto>;
  readonly onAnalyze?: () => void;
  readonly isAnalyzing?: boolean;
  readonly onOpenAskDoctor?: (initialQuestion: string) => void;
  readonly onNavigateArchitectureFlow?: (featureTitle?: string) => void;
  readonly onOpenFeatureKT?: (feature: BusinessFeatureDto) => void;
  readonly onOpenCodeViewer?: (node: any) => void;
}

export function FeatureExplorerView({
  features,
  projectFeatures,
  isLoading,
  error,
  onAskQuestion,
  onAnalyze,
  isAnalyzing,
  onOpenAskDoctor,
  onNavigateArchitectureFlow,
  onOpenFeatureKT,
  onOpenCodeViewer,
}: FeatureExplorerViewProps): React.JSX.Element {
  const hasProjectFeatures = Boolean(projectFeatures && projectFeatures.length > 0);
  const [viewMode, setViewMode] = useState<'features' | 'components'>(
    hasProjectFeatures ? 'features' : 'components',
  );

  // Business Feature selection
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(
    projectFeatures && projectFeatures.length > 0 ? projectFeatures[0].id : '',
  );

  // AST Component selection
  const [selectedNodeId, setSelectedNodeId] = useState<string>(features[0]?.id ?? '');
  const [question, setQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [answerResult, setAnswerResult] = useState<FeatureQuestionResponseDto | null>(null);

  const selectedBusinessFeature =
    projectFeatures?.find((f) => f.id === selectedFeatureId) ?? projectFeatures?.[0];

  const selectedFeature = features.find((f) => f.id === selectedNodeId) ?? features[0];

  const handleAskSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedFeature || !question.trim()) return;

    setIsAsking(true);
    try {
      const res = await onAskQuestion(selectedFeature.id, question.trim());
      setAnswerResult(res);
    } finally {
      setIsAsking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card-section" data-testid="features-loading" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>🔍</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
          Loading System Features &amp; Components...
        </h3>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem' }}>
          Mapping business functionality, execution pathways, and source evidence.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-forbidden" data-testid="features-error">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Feature Access Blocked</h3>
        <p style={{ fontSize: '0.95rem', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (features.length === 0 && (!projectFeatures || projectFeatures.length === 0)) {
    return (
      <div className="empty-state-box" data-testid="features-empty" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h3 className="empty-state-title" style={{ fontSize: '1.4rem', fontWeight: 800 }}>No Features Discovered Yet</h3>
        <p className="empty-state-text" style={{ maxWidth: '520px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
          Run static analysis on this project to extract business features, trace execution paths across repositories, and map source evidence citations.
        </p>
        {onAnalyze && (
          <button
            type="button"
            className="primary-btn"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
          >
            {isAnalyzing ? 'Analyzing Repositories...' : 'Run Static Analysis'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Top Header Toolbar: Feature First Navigation ── */}
      <div
        className="card-section"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.1rem 1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
            Features &amp; Code Explorer
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
            {hasProjectFeatures
              ? `Navigate from Feature → Flow → Component → Function → Code Evidence`
              : `${features.length} Components &bull; Click to explore dependencies, files, and grounded Q&A`}
          </p>
        </div>

        {/* View Switcher: Business Features vs Technical Component Browser */}
        {hasProjectFeatures && (
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', gap: '2px' }}>
            <button
              type="button"
              className={`tab-button ${viewMode === 'features' ? 'active' : ''}`}
              onClick={() => setViewMode('features')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              ✨ Feature Capabilities ({projectFeatures?.length ?? 0})
            </button>
            <button
              type="button"
              className={`tab-button ${viewMode === 'components' ? 'active' : ''}`}
              onClick={() => setViewMode('components')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              📁 Technical Component Browser ({features.length})
            </button>
          </div>
        )}
      </div>

      {/* ── Mode 1: Business Feature Capabilities (Feature → Flow → Component → Code Evidence) ── */}
      {viewMode === 'features' && projectFeatures && projectFeatures.length > 0 && (
        <div className="split-layout" data-testid="business-features-explorer">
          {/* Left Sidebar: Business Features List */}
          <aside className="nav-sidebar" data-testid="business-features-sidebar" style={{ width: '320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                Discovered Features
              </h3>
              <span className="badge-info">{projectFeatures.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {projectFeatures.map((feat) => {
                const isSelected = selectedBusinessFeature?.id === feat.id;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    data-testid={`feature-select-${feat.id}`}
                    className={`sidebar-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedFeatureId(feat.id)}
                    style={{
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.25rem',
                      borderRadius: '8px',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#1e40af' : '#0f172a' }}>
                        {feat.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                        }}
                      >
                        {feat.category}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.3 }}>
                      {feat.participatingComponents.length} components &bull; {feat.relatedRepositories.length} repo(s)
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Detail Pane: Feature → Flow → Component → Evidence */}
          <section className="detail-pane" data-testid="business-feature-detail">
            {selectedBusinessFeature ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 1. Feature Header */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
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
                          {selectedBusinessFeature.category}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Spans {selectedBusinessFeature.relatedRepositories.join(', ')}
                        </span>
                      </div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {selectedBusinessFeature.title}
                      </h2>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {onOpenFeatureKT && (
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => onOpenFeatureKT(selectedBusinessFeature)}
                          style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem', fontWeight: 700, backgroundColor: '#4f46e5' }}
                        >
                          🎓 Get Feature KT &amp; Flow
                        </button>
                      )}
                      {onOpenAskDoctor && (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => onOpenAskDoctor(`Explain the complete system flow for ${selectedBusinessFeature.title}`)}
                          style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', fontWeight: 600 }}
                        >
                          💬 Explain This Flow
                        </button>
                      )}
                      {onNavigateArchitectureFlow && (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => onNavigateArchitectureFlow(selectedBusinessFeature.id)}
                          style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', fontWeight: 600 }}
                          title="View the end-to-end execution tree flow for this feature"
                        >
                          🌳 View Flow Tree in Architecture
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                    {selectedBusinessFeature.description}
                  </p>

                  {/* Natural Language Explanation if present */}
                  {selectedBusinessFeature.naturalLanguageExplanation && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        fontSize: '0.9rem',
                        color: '#1e3a8a',
                        lineHeight: 1.55,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>💡</span>
                        <span>Plain-English Knowledge Transfer (KT):</span>
                      </div>
                      <div>{selectedBusinessFeature.naturalLanguageExplanation}</div>
                    </div>
                  )}
                </div>

                {/* 2. Participating Components Hierarchy */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem' }}>
                    Participating Components &amp; Architecture Roles ({selectedBusinessFeature.participatingComponents.length})
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                    {selectedBusinessFeature.participatingComponents.map((comp) => (
                      <div
                        key={comp.id}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                            {comp.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                            }}
                          >
                            {comp.type}
                          </span>
                        </div>

                        {/* Method / Function */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Method:</span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              backgroundColor: '#eff6ff',
                              padding: '0.05rem 0.3rem',
                              borderRadius: '3px',
                            }}
                          >
                            {comp.primaryMethod || 'execute()'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            📁 <strong>{comp.repositoryName}</strong>
                          </div>

                          {onOpenCodeViewer && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenCodeViewer({
                                  id: comp.id,
                                  displayName: comp.name,
                                  identifier: comp.id,
                                  repositoryId: '',
                                  repositoryName: comp.repositoryName,
                                  role: comp.type as any,
                                  nodeType: 'FILE' as any,
                                  filePath: comp.name,
                                  primaryMethod: comp.primaryMethod || 'execute()',
                                  methods: [],
                                  incomingCount: 0,
                                  outgoingCount: 0,
                                  metadata: {},
                                })
                              }
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#2563eb',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              title={`Open code for ${comp.name}`}
                            >
                              🔍 View Code
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Connected Persistence Stores */}
                  {selectedBusinessFeature.dataStores.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 700, color: '#047857' }}>🗄️ Connected Persistence:</span>
                      <span style={{ color: '#334155' }}>{selectedBusinessFeature.dataStores.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* 3. Deep Dive Q&A Box for this feature */}
                {onOpenAskDoctor && (
                  <div
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      border: '1.5px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>
                        Investigate {selectedBusinessFeature.title} with RepoDoctor
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#3b82f6' }}>
                        Trace end-to-end execution, inspect database mutations, or test hypothetical change impact.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => onOpenAskDoctor(`How does ${selectedBusinessFeature.title} work from frontend to database?`)}
                      style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem', fontWeight: 600 }}
                    >
                      Ask About This Feature ➔
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                Select a feature from the left sidebar to inspect its execution hierarchy and participating components.
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Mode 2: Technical Component Browser (Original AST component & file inspection) ── */}
      {(viewMode === 'components' || !hasProjectFeatures) && (
        <div className="split-layout" data-testid="feature-explorer-view">
          <aside className="nav-sidebar" data-testid="features-sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                System Components
              </h3>
              <span className="badge-info">{features.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {features.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  data-testid={`feature-item-${feature.identifier}`}
                  className={`sidebar-item ${selectedFeature?.id === feature.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedNodeId(feature.id);
                    setAnswerResult(null);
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600 }}>{feature.displayName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {feature.identifier}
                    </span>
                  </div>
                  <span className="brand-badge" style={{ fontSize: '0.75rem' }}>{feature.nodeType}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="detail-pane" data-testid="feature-detail-pane">
            {selectedFeature && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 className="section-title" style={{ margin: 0, fontSize: '1.4rem' }}>
                      {selectedFeature.displayName}
                    </h2>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      Identifier: {selectedFeature.identifier}
                    </div>
                  </div>
                  <span className="badge-info" style={{ fontSize: '0.85rem' }}>
                    {selectedFeature.nodeType}
                  </span>
                </div>

                {/* Related Source Files */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                    Related Source Files ({selectedFeature.relatedFiles.length})
                  </h4>
                  {selectedFeature.relatedFiles.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No direct file citations attached.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {selectedFeature.relatedFiles.map((file) => (
                        <div
                          key={file}
                          style={{
                            padding: '0.45rem 0.75rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            color: 'var(--accent-blue)',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>📄</span>
                          <span>{file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Code Location Evidence */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                    Code Location Evidence ({selectedFeature.codeLocations.length})
                  </h4>
                  {selectedFeature.codeLocations.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No code location snippets attached.</p>
                  ) : (
                    selectedFeature.codeLocations.map((loc) => (
                      <div key={loc.evidenceId} className="code-citation-box" data-testid={`citation-${loc.evidenceId}`}>
                        <div className="code-citation-header">
                          <span>{loc.filePath}:{loc.lineStart}-{loc.lineEnd}</span>
                          <span>Commit: {loc.commitSha ? loc.commitSha.substring(0, 7) : 'HEAD'}</span>
                        </div>
                        <pre className="code-snippet-pre">{loc.codeSnippet}</pre>
                      </div>
                    ))
                  )}
                </div>

                {/* Grounded Component Q&A */}
                <div className="card-section" style={{ backgroundColor: '#f8fafc', marginBottom: 0 }}>
                  <h3 className="section-title" style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                    Grounded Q&amp;A About this Component
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                    Ask architectural questions about component responsibilities and interaction contracts.
                    All responses are strictly grounded in verified database evidence.
                  </p>
                  <form onSubmit={handleAskSubmit}>
                    <textarea
                      data-testid="feature-question-input"
                      className="text-area-input"
                      rows={3}
                      placeholder={`Ask a question about ${selectedFeature.displayName}... (e.g. What services does this component call?)`}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button
                      type="submit"
                      data-testid="feature-ask-submit-btn"
                      className="primary-btn"
                      disabled={isAsking || !question.trim()}
                    >
                      {isAsking ? 'Querying Knowledge Graph...' : 'Ask Architecture Question'}
                    </button>
                  </form>

                  {answerResult && (
                    <div
                      style={{
                        marginTop: '1.25rem',
                        padding: '1.25rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      data-testid="feature-answer-box"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ color: 'var(--accent-green)', fontSize: '0.95rem' }}>
                          ✓ Verified Architecture Response
                        </strong>
                        <span className="badge-info">Grounded Evidence</span>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: '1.6' }}>
                        {answerResult.answer}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
