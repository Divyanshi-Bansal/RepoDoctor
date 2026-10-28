'use client';

import React from 'react';
import type {
  BusinessFeatureDto,
  VisualTopologyNodeDto,
  VisualTopologyEdgeDto,
} from '@repo-doctor/shared';

interface FeatureKTModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly feature: BusinessFeatureDto | null;
  readonly allNodes?: readonly VisualTopologyNodeDto[];
  readonly allEdges?: readonly VisualTopologyEdgeDto[];
  readonly onOpenCodeViewer: (node: VisualTopologyNodeDto) => void;
  readonly onNavigateToArchitecture?: (featureId: string) => void;
  readonly onOpenAskDoctor?: (question: string) => void;
}

export function FeatureKTModal({
  isOpen,
  onClose,
  feature,
  allNodes = [],
  allEdges = [],
  onOpenCodeViewer,
  onNavigateToArchitecture,
  onOpenAskDoctor,
}: FeatureKTModalProps): React.JSX.Element | null {
  if (!isOpen || !feature) return null;

  const nodeMap = new Map<string, VisualTopologyNodeDto>(allNodes.map((n) => [n.id, n]));

  // Participating nodes in this feature
  const participatingNodeIds = new Set(feature.participatingComponents.map((c) => c.id));
  const participatingNodes = feature.participatingComponents
    .map((c) => nodeMap.get(c.id) || ({
      id: c.id,
      displayName: c.name,
      identifier: c.id,
      repositoryId: '',
      repositoryName: c.repositoryName,
      role: c.type as any,
      nodeType: 'FILE' as any,
      filePath: c.name,
      primaryMethod: c.primaryMethod || `${c.name.split('.')[0]}Main()`,
      methods: [],
      incomingCount: 0,
      outgoingCount: 0,
      metadata: {},
    } satisfies VisualTopologyNodeDto));

  // Group participating nodes by role
  const frontendNodes = participatingNodes.filter((n) => n.role === 'FRONTEND');
  const apiNodes = participatingNodes.filter((n) => n.role === 'API');
  const serviceNodes = participatingNodes.filter((n) => n.role === 'SERVICE' || n.role === 'WORKER');
  const storeNodes = participatingNodes.filter((n) => n.role === 'PERSISTENCE' || n.role === 'QUEUE');

  // Relevant edges between participating components
  const relevantEdges = allEdges.filter(
    (e) => participatingNodeIds.has(e.sourceNodeId) || participatingNodeIds.has(e.targetNodeId)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kt-modal-title"
      data-testid="feature-kt-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.6rem' }}>🎓</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    textTransform: 'uppercase',
                  }}
                >
                  {feature.category}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Spans: <strong>{feature.relatedRepositories.join(' & ')}</strong>
                </span>
              </div>
              <h2
                id="kt-modal-title"
                style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}
              >
                {feature.title} — Feature KT &amp; Architecture Flow
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close KT modal"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Modal Scrollable Body ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* 1. Natural Language KT Explanation */}
          <section
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: '#eff6ff',
              borderRadius: '10px',
              border: '1.5px solid #bfdbfe',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>💡</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                Plain-English Feature Explanation
              </h3>
            </div>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#1e293b',
                lineHeight: 1.65,
                margin: '0 0 0.85rem',
                fontWeight: 500,
              }}
            >
              {feature.naturalLanguageExplanation || feature.description}
            </p>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
              }}
            >
              <span>🧭 Why this matters for new teammates:</span>
              <span style={{ color: '#1e40af', fontWeight: 400 }}>
                You do not need to hunt across {feature.relatedRepositories.join(' and ')} to understand this functionality.
                The flow connects the user interface entrypoints directly to the API endpoints, business logic, and databases below.
              </span>
            </div>
          </section>

          {/* 2. Visual Call & Method Tree */}
          <section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  🌳 Connected Architecture Tree (File ➔ Method)
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Each step shows the exact file and executed method. Click <strong>View Code</strong> to inspect the method source.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                }}
              >
                {participatingNodes.length} Step{participatingNodes.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {participatingNodes.map((node, index) => {
                const isFirst = index === 0;
                const isLast = index === participatingNodes.length - 1;
                const roleIcon =
                  node.role === 'FRONTEND'
                    ? '🖥️'
                    : node.role === 'API'
                    ? '⚡'
                    : node.role === 'SERVICE'
                    ? '⚙️'
                    : '🗄️';

                const roleBadgeColor =
                  node.role === 'FRONTEND'
                    ? { bg: '#e0f2fe', text: '#0369a1' }
                    : node.role === 'API'
                    ? { bg: '#fef3c7', text: '#b45309' }
                    : node.role === 'SERVICE'
                    ? { bg: '#f3e8ff', text: '#7e22ce' }
                    : { bg: '#dcfce7', text: '#15803d' };

                return (
                  <div
                    key={node.id}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Tree Branch Visual Connector */}
                    <div
                      style={{
                        width: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: '#94a3b8',
                        }}
                      >
                        {isFirst ? '●' : isLast ? '└──' : '├──'}
                      </span>
                    </div>

                    {/* Node Card */}
                    <div
                      style={{
                        flex: 1,
                        padding: '0.85rem 1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.15rem' }}>{roleIcon}</span>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>
                              {node.displayName}
                            </span>
                            <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.85rem' }}>➔</span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: '#1d4ed8',
                                backgroundColor: '#eff6ff',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid #dbeafe',
                              }}
                            >
                              {node.primaryMethod || 'execute()'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.35rem',
                                borderRadius: '3px',
                                backgroundColor: roleBadgeColor.bg,
                                color: roleBadgeColor.text,
                              }}
                            >
                              {node.role}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              📁 {node.repositoryName}
                            </span>
                            {node.filePath && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                ({node.filePath})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Click to open File and Method */}
                      <button
                        type="button"
                        onClick={() => onOpenCodeViewer(node)}
                        data-testid={`view-code-btn-${node.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#2563eb',
                          cursor: 'pointer',
                        }}
                        title={`Open source code for ${node.displayName} at ${node.primaryMethod || 'method'}`}
                      >
                        <span>🔍</span>
                        <span>View Code</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Friendly File Dependencies Breakdown */}
          <section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem' }}>
              📋 How Files Depend on Each Other
            </h3>

            {relevantEdges.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Files in this feature execute sequentially across the frontend and backend boundaries shown above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {relevantEdges.map((edge) => {
                  const src = nodeMap.get(edge.sourceNodeId);
                  const tgt = nodeMap.get(edge.targetNodeId);

                  const friendlyText =
                    edge.friendlyDescription ||
                    `${src?.displayName || edge.sourceNodeId} (${edge.sourceRepositoryName || 'source'}) ${
                      edge.edgeType === 'CALLS'
                        ? 'calls method in'
                        : edge.edgeType === 'READS_FROM'
                        ? 'reads database records from'
                        : edge.edgeType === 'WRITES_TO'
                        ? 'persists mutations to'
                        : edge.edgeType === 'PRODUCES'
                        ? 'enqueues job to'
                        : edge.edgeType === 'CONSUMES'
                        ? 'processes queue messages from'
                        : 'imports and depends on'
                    } ${tgt?.displayName || edge.targetNodeId} (${edge.targetRepositoryName || 'target'})`;

                  return (
                    <div
                      key={edge.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        backgroundColor: edge.isCrossRepository ? '#fffbeb' : '#f8fafc',
                        border: edge.isCrossRepository ? '1px solid #fde68a' : '1px solid #e2e8f0',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: edge.isCrossRepository ? '#b45309' : '#2563eb', fontWeight: 700 }}>
                          {edge.isCrossRepository ? '⚡' : '➔'}
                        </span>
                        <span style={{ color: '#1e293b', lineHeight: 1.5 }}>
                          {friendlyText}
                        </span>
                      </div>

                      {edge.isCrossRepository && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          Cross-Repository
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Consequences & Blast Radius */}
          {feature.consequencesOfChange && (
            <section
              style={{
                backgroundColor: '#fffbeb',
                borderRadius: '10px',
                border: '1.5px solid #fde68a',
                padding: '1.25rem 1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>💥</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
                  Consequences of Modifying This Feature
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: 1.6 }}>
                {feature.consequencesOfChange}
              </p>
            </section>
          )}

          {/* 5. Where to Start Guide */}
          {feature.whereToStartGuide && (
            <section
              style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '10px',
                border: '1.5px solid #bbf7d0',
                padding: '1.25rem 1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🚀</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534', margin: 0 }}>
                  Where to Start (New Developer Guide)
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#14532d', lineHeight: 1.6 }}>
                {feature.whereToStartGuide}
              </p>
            </section>
          )}
        </div>

        {/* ── Modal Footer Action Bar ── */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onNavigateToArchitecture && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  onClose();
                  onNavigateToArchitecture(feature.id);
                }}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>🌳</span>
                <span>View in Architecture Canvas</span>
              </button>
            )}

            {onOpenAskDoctor && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onClose();
                  onOpenAskDoctor(`How does ${feature.title} work from the frontend to the database?`);
                }}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>💬</span>
                <span>Ask RepoDoctor Deep-Dive</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
