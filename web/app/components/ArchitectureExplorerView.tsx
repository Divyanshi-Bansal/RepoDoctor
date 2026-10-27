'use client';

import React, { useState } from 'react';
import type {
  ArchitectureTopologyDto,
  BlastRadiusResultDto,
} from '@repo-doctor/shared';

interface ArchitectureExplorerViewProps {
  readonly topology: ArchitectureTopologyDto | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onCalculateBlastRadius: (nodeId: string) => Promise<BlastRadiusResultDto>;
  readonly onAnalyze?: () => void;
  readonly isAnalyzing?: boolean;
}

export function ArchitectureExplorerView({
  topology,
  isLoading,
  error,
  onCalculateBlastRadius,
  onAnalyze,
  isAnalyzing,
}: ArchitectureExplorerViewProps): React.JSX.Element {
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [blastRadiusResult, setBlastRadiusResult] = useState<BlastRadiusResultDto | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="card-section" data-testid="topology-loading" style={{ textAlign: 'center', padding: '3.5rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading architecture topology and dependency graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-forbidden" data-testid="topology-error">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Architecture Access Blocked</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="empty-state-box" data-testid="topology-empty">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🕸️</div>
        <h3 className="empty-state-title">No Architecture Topology Discovered</h3>
        <p className="empty-state-text">
          Run static code analysis on this repository to extract components, parse AST dependency edges, and calculate change blast radius.
        </p>
        {onAnalyze && (
          <button
            type="button"
            className="primary-btn"
            onClick={onAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing Repository...' : 'Run Static Analysis'}
          </button>
        )}
      </div>
    );
  }

  const filteredNodes =
    selectedDomain === 'ALL'
      ? topology.nodes
      : topology.nodes.filter((n) => n.nodeType === selectedDomain);

  const nodeMap = new Map(topology.nodes.map((n) => [n.id, n.displayName]));

  const handleSimulateBlastRadius = async (nodeId: string): Promise<void> => {
    setSelectedNodeId(nodeId);
    setIsCalculating(true);
    try {
      const res = await onCalculateBlastRadius(nodeId);
      setBlastRadiusResult(res);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div data-testid="architecture-explorer-view">
      {/* Subsystem Filter Pills */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['ALL', 'SERVICE', 'DATABASE', 'QUEUE', 'ENDPOINT'].map((dom) => (
          <button
            key={dom}
            type="button"
            data-testid={`domain-filter-${dom}`}
            className={`tab-button ${selectedDomain === dom ? 'active' : ''}`}
            onClick={() => setSelectedDomain(dom)}
            style={{
              padding: '0.45rem 0.9rem',
              backgroundColor: selectedDomain === dom ? 'var(--accent-blue-subtle)' : '#ffffff',
              border: `1px solid ${selectedDomain === dom ? 'var(--accent-blue)' : 'var(--border-default)'}`,
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {dom === 'ALL'
              ? `All Subsystems (${topology.nodes.length})`
              : `${dom}s (${topology.nodes.filter((n) => n.nodeType === dom).length})`}
          </button>
        ))}
      </div>

      <div className="split-layout">
        {/* Left: Components List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              Subsystem Components ({filteredNodes.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  className="insight-item"
                  data-testid={`arch-node-${node.identifier}`}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-blue)' : undefined,
                    backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : '#ffffff',
                    boxShadow: isSelected ? '0 0 0 1px var(--accent-blue)' : 'var(--shadow-sm)',
                  }}
                  onClick={() => handleSimulateBlastRadius(node.id)}
                >
                  <div className="insight-header">
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {node.displayName}
                    </strong>
                    <span className="brand-badge">{node.nodeType}</span>
                  </div>
                  <p className="insight-desc" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {node.identifier}
                  </p>
                  <button
                    type="button"
                    data-testid={`btn-blast-radius-${node.identifier}`}
                    className="primary-btn"
                    style={{ marginTop: '0.75rem', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSimulateBlastRadius(node.id);
                    }}
                  >
                    Simulate Downstream Blast Radius
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Relationships and Blast Radius Simulator */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              Verified Relationship Flows ({topology.edges.length})
            </h3>
          </div>

          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {topology.edges.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No relationships found for this repository.</p>
            ) : (
              topology.edges.map((edge) => {
                const sourceName = nodeMap.get(edge.sourceNodeId) ?? 'Source';
                const targetName = nodeMap.get(edge.targetNodeId) ?? 'Target';
                return (
                  <div
                    key={edge.id}
                    className={`edge-card ${edge.isInferred ? 'edge-inferred' : 'edge-deterministic'}`}
                    data-testid={`arch-edge-${edge.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{sourceName}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                        → [{edge.edgeType}] →
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{targetName}</strong>
                    </div>
                    <div>
                      {edge.isInferred ? (
                        <span className="badge-warning">Inferred • {(edge.confidence * 100).toFixed(0)}%</span>
                      ) : (
                        <span className="badge-info">Deterministic (100%)</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isCalculating && (
            <div className="card-section" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Calculating recursive blast radius traversal...</p>
            </div>
          )}

          {blastRadiusResult && (
            <div className="card-section" data-testid="blast-radius-result">
              <h3 className="section-title" style={{ color: 'var(--accent-purple)', fontSize: '1.25rem', marginBottom: '0.35rem' }}>
                Downstream Blast Radius: {blastRadiusResult.rootNodeName}
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Total Impacted Subsystems: <strong>{blastRadiusResult.totalImpactedNodes}</strong> (Max Depth: {blastRadiusResult.maxDepth})
              </p>
              {blastRadiusResult.steps.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No downstream dependents impacted if this component is altered.</p>
              ) : (
                blastRadiusResult.steps.map((step, idx) => (
                  <div key={`${step.edgeId}-${idx}`} className="step-item" data-testid={`blast-step-${idx}`}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      <strong>Depth {step.depth}:</strong> {step.targetNodeName} ({step.targetNodeType}) via [{step.edgeType}]
                    </div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Traversal path: {step.path.join(' → ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
