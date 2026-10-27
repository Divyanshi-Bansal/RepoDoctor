'use client';

import React, { useState, useEffect } from 'react';
import type {
  AskRepoDoctorResponseDto,
  CodeLocationCitationDto,
  FlowStepDto,
} from '@repo-doctor/shared';

interface AskRepoDoctorDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly projectId?: string;
  readonly selectedRepoId?: string;
  readonly onQueryProject: (question: string) => Promise<AskRepoDoctorResponseDto>;
  readonly initialQuestion?: string;
  readonly onNavigateFlow?: (flowQuestion?: string) => void;
}

const STARTER_QUESTIONS = [
  'Explain how user login works end to end across frontend and backend.',
  'What are the consequences of changing auth.service.ts?',
  'I am new to this codebase: give me KT on the main project features.',
  'Which components and database tables handle user authentication?',
  'What happens if I modify a service in cadence-api?',
];

export function AskRepoDoctorDrawer({
  isOpen,
  onClose,
  projectId,
  selectedRepoId,
  onQueryProject,
  initialQuestion = '',
  onNavigateFlow,
}: AskRepoDoctorDrawerProps): React.JSX.Element | null {
  const [query, setQuery] = useState<string>(initialQuestion);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskRepoDoctorResponseDto | null>(null);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState<boolean>(false);
  const [expandedCitationIndex, setExpandedCitationIndex] = useState<number | null>(0);

  // Update query when initialQuestion changes
  useEffect(() => {
    if (initialQuestion) {
      setQuery(initialQuestion);
      void handleExecuteQuery(initialQuestion);
    }
  }, [initialQuestion]);

  if (!isOpen) return null;

  const handleExecuteQuery = async (questionText: string): Promise<void> => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await onQueryProject(trimmed);
      setResponse(res);
      setShowEvidenceDetails(false);
      setExpandedCitationIndex(0);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('404') || rawMsg.includes('Not Found') || rawMsg.includes('Cannot POST')) {
        friendlyMsg = 'The analysis engine could not be reached (HTTP 404). Please ensure the backend is running with the latest routes.';
      } else if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('network')) {
        friendlyMsg = 'Connection error: unable to reach the RepoDoctor server. Please check your network connection and server status.';
      } else if (rawMsg.includes('401') || rawMsg.toLowerCase().includes('unauthorized')) {
        friendlyMsg = 'Your session has expired or authentication is required. Please sign in again.';
      } else if (rawMsg.includes('403') || rawMsg.toLowerCase().includes('forbidden')) {
        friendlyMsg = 'You do not have permission to query this project.';
      }
      setError(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void handleExecuteQuery(query);
  };

  const handleViewFlow = (): void => {
    if (onNavigateFlow) {
      onNavigateFlow(query);
      onClose();
    }
  };

  // Generate contextual follow-ups based on the response
  const getFollowUpSuggestions = (res: AskRepoDoctorResponseDto): string[] => {
    const suggestions: string[] = [];
    if (res.participatingComponents.some((c) => c.type === 'DATABASE')) {
      suggestions.push('Which database tables are read from or written to?');
    }
    if (res.participatingComponents.some((c) => c.type === 'SERVICE')) {
      suggestions.push('What is the downstream blast radius if this service is modified?');
    }
    if (res.participatingRepositories.length > 1) {
      suggestions.push('Explain the cross-repository protocol between these services');
    } else {
      suggestions.push('What external services or queues are connected?');
    }
    return suggestions.slice(0, 3);
  };

  return (
    <div
      className="modal-overlay"
      data-testid="ask-repodoctor-drawer"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="drawer-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          height: '100vh',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Drawer Header ── */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-primary, #2563eb)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
              }}
            >
              💬
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Ask RepoDoctor
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                Explain features, visual flows, and dependencies backed strictly by source code evidence
              </p>
            </div>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            aria-label="Close Ask Drawer"
            style={{ padding: '0.4rem 0.75rem', fontSize: '1rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* ── 2. Large Question Composer Section ── */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                data-testid="ask-question-input"
                className="input-field"
                placeholder="Ask how something works, blast radius, or cross-repo flows..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.9rem 6rem 0.9rem 1.1rem',
                  fontSize: '1rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              />
              <button
                type="submit"
                data-testid="ask-question-btn"
                className="primary-btn"
                disabled={isLoading || !query.trim()}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '6px',
                  bottom: '6px',
                  padding: '0 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {isLoading ? 'Analyzing...' : 'Ask'}
              </button>
            </div>

            {/* Starter Suggestion Chips */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>
                SUGGESTED QUESTIONS:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {STARTER_QUESTIONS.map((sq) => (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => {
                      setQuery(sq);
                      void handleExecuteQuery(sq);
                    }}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      lineHeight: 1.3,
                    }}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* ── 3. Conversational Content Area ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem' }}>
                Analyzing System Architecture...
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, maxWidth: '420px', marginInline: 'auto' }}>
                Tracing component calls, database operations, and evidence citations across repositories without hallucinations.
              </p>
            </div>
          )}

          {error && (
            <div
              className="card-section"
              style={{
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
                borderRadius: '10px',
                padding: '1.25rem',
                margin: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <h4 style={{ margin: 0, fontWeight: 700, color: '#991b1b', fontSize: '0.95rem' }}>
                  Unable to Answer Question
                </h4>
              </div>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#b91c1c', lineHeight: 1.5 }}>
                {error}
              </p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void handleExecuteQuery(query)}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.85rem',
                  borderColor: '#fca5a5',
                  color: '#991b1b',
                  backgroundColor: '#ffffff',
                }}
              >
                ↻ Try Again
              </button>
            </div>
          )}

          {!isLoading && !response && !error && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧭</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
                Ask Anything About This Project
              </h3>
              <p style={{ fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
                RepoDoctor correlates route handlers, business services, database operations, and message queues to explain how functionality actually flows through code.
              </p>
            </div>
          )}

          {!isLoading && response && (
            <div data-testid="ask-response-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* ── Answer Card ── */}
              <div
                style={{
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Top Status Pill: Honest Grounding, NO 100% Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        backgroundColor: response.isInferred ? '#fef3c7' : '#dcfce7',
                        color: response.isInferred ? '#92400e' : '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>{response.isInferred ? 'ℹ' : '✓'}</span>
                      <span>{response.isInferred ? 'Inferred Flow' : 'Verified Static Evidence'}</span>
                    </span>

                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ({response.participatingComponents.length} components, {response.citations.length} code citations)
                    </span>
                  </div>

                  {/* One-Click "View Flow" Action */}
                  {response.flowSteps.length > 0 && onNavigateFlow && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleViewFlow}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.35rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>🕸️</span>
                      <span>View Flow in Architecture</span>
                    </button>
                  )}
                </div>

                {/* Natural Answer Content */}
                <div
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1.7,
                    color: '#0f172a',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {response.answer}
                </div>
              </div>

              {/* ── Step-by-Step Flow Timeline ── */}
              {response.flowSteps.length > 0 && (
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Step-by-Step Execution Flow
                    </h3>
                    {onNavigateFlow && (
                      <button
                        type="button"
                        onClick={handleViewFlow}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Open interactive diagram ➔
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {response.flowSteps.map((step: FlowStepDto) => (
                      <div
                        key={step.stepNumber}
                        style={{
                          display: 'flex',
                          gap: '0.85rem',
                          padding: '0.85rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {step.stepNumber}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                              {step.componentName}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#e2e8f0',
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            >
                              {step.componentType}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                fontWeight: 600,
                              }}
                            >
                              📁 {step.repositoryName}
                            </span>
                            {step.edgeType && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  fontWeight: 600,
                                }}
                              >
                                {step.edgeType}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                            {step.description}
                          </p>
                          {step.targetName && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                              ↳ Connects to: {step.targetName}
                              {step.targetRepositoryName && step.targetRepositoryName !== step.repositoryName && (
                                <span style={{ marginLeft: '0.4rem', color: '#b45309' }}>
                                  [Cross-Repo: {step.targetRepositoryName}]
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Contextual Follow-Up Suggestions ── */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                  FOLLOW-UP QUESTIONS:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {getFollowUpSuggestions(response).map((fq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(fq);
                        void handleExecuteQuery(fq);
                      }}
                      style={{
                        padding: '0.6rem 0.9rem',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>💬 {fq}</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>➔</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Expandable "Why This Answer?" Evidence Section ── */}
              <div
                style={{
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>🔍</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      Why this answer? Supporting Code Evidence ({response.citations.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {showEvidenceDetails ? 'Hide ▴' : 'Inspect Evidence ▾'}
                  </span>
                </div>

                {showEvidenceDetails && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                      This explanation is synthesized directly from verified AST declarations, route decorators, and dependency citations across {response.participatingRepositories.length} repository(s). No speculative code was synthesized.
                    </p>

                    {response.citations.map((cite: CodeLocationCitationDto, idx: number) => {
                      const isExpanded = expandedCitationIndex === idx;
                      return (
                        <div
                          key={idx}
                          style={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              padding: '0.65rem 0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#f1f5f9' : '#f8fafc',
                            }}
                            onClick={() => setExpandedCitationIndex(isExpanded ? null : idx)}
                          >
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
                              📄 {cite.filePath}:{cite.lineStart}-{cite.lineEnd}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {isExpanded ? 'Collapse' : 'View Code'}
                            </span>
                          </div>

                          {isExpanded && cite.codeSnippet && (
                            <pre
                              style={{
                                margin: 0,
                                padding: '0.75rem',
                                backgroundColor: '#ffffff',
                                borderTop: '1px solid #e2e8f0',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                overflowX: 'auto',
                                color: '#334155',
                                lineHeight: 1.5,
                              }}
                            >
                              {cite.codeSnippet}
                            </pre>
                          )}
                        </div>
                      );
                    })}

                    {/* Documented Limitations */}
                    {response.limitations.length > 0 && (
                      <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                          Analysis Limitations:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#b45309' }}>
                          {response.limitations.map((lim, lIdx) => (
                            <li key={lIdx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
