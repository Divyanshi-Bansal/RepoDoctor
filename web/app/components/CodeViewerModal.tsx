'use client';

import React, { useState, useEffect } from 'react';
import type { VisualTopologyNodeDto, VisualTopologyEdgeDto, BlastRadiusResultDto } from '@repo-doctor/shared';

interface CodeViewerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly node: VisualTopologyNodeDto | null;
  readonly allNodes?: readonly VisualTopologyNodeDto[];
  readonly allEdges?: readonly VisualTopologyEdgeDto[];
  readonly onOpenAskDoctor?: (initialQuestion: string) => void;
  readonly onCalculateBlastRadius?: (nodeId: string, repositoryId?: string) => Promise<BlastRadiusResultDto>;
}

export function CodeViewerModal({
  isOpen,
  onClose,
  node,
  allNodes = [],
  allEdges = [],
  onOpenAskDoctor,
  onCalculateBlastRadius,
}: CodeViewerModalProps): React.JSX.Element | null {
  const [copied, setCopied] = useState<boolean>(false);
  const [isCalculatingBlast, setIsCalculatingBlast] = useState<boolean>(false);
  const [blastResult, setBlastResult] = useState<BlastRadiusResultDto | null>(null);
  const [activeNode, setActiveNode] = useState<VisualTopologyNodeDto | null>(node);

  useEffect(() => {
    if (node) {
      setActiveNode(node);
      setBlastResult(null);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const currentNode = activeNode || node;
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Inbound callers (who imports/calls currentNode)
  const callers = allEdges
    .filter((e) => e.targetNodeId === currentNode.id)
    .map((e) => ({
      edge: e,
      sourceNode: nodeMap.get(e.sourceNodeId),
    }))
    .filter((item): item is { edge: VisualTopologyEdgeDto; sourceNode: VisualTopologyNodeDto } => Boolean(item.sourceNode));

  // Outbound dependencies (what currentNode imports/calls)
  const dependencies = allEdges
    .filter((e) => e.sourceNodeId === currentNode.id)
    .map((e) => ({
      edge: e,
      targetNode: nodeMap.get(e.targetNodeId),
    }))
    .filter((item): item is { edge: VisualTopologyEdgeDto; targetNode: VisualTopologyNodeDto } => Boolean(item.targetNode));

  const snippet = currentNode.codeSnippet || `// Source file: ${currentNode.filePath || currentNode.identifier}
// Primary Method / Function: ${currentNode.primaryMethod || 'execute()'}

export function ${currentNode.primaryMethod || 'Component'}() {
  // Static AST component declaration
  return null;
}`;

  const lines = snippet.split('\n');
  const startLine = currentNode.lineStart || 1;

  const handleCopyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  const handleRunBlast = async (): Promise<void> => {
    if (!onCalculateBlastRadius) return;
    setIsCalculatingBlast(true);
    try {
      const res = await onCalculateBlastRadius(currentNode.id, currentNode.repositoryId);
      setBlastResult(res);
    } finally {
      setIsCalculatingBlast(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '3px',
          boxShadow: '0 8px 16px -4px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
          width: '95vw',
          maxWidth: '1280px',
          height: '86vh',
          maxHeight: '920px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.35rem' }}>
              {currentNode.role === 'FRONTEND' ? '🖥️' : currentNode.role === 'API' ? '⚡' : currentNode.role === 'SERVICE' ? '⚙️' : currentNode.role === 'DATABASE' ? '🗄️' : currentNode.role === 'QUEUE' ? '📬' : '📦'}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {currentNode.displayName}
                </span>
                {currentNode.primaryMethod && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '5px',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      fontFamily: 'monospace',
                    }}
                  >
                    ƒ {currentNode.primaryMethod}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                  }}
                >
                  📁 {currentNode.repositoryName}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                  }}
                >
                  {currentNode.role}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>
                {currentNode.filePath || currentNode.identifier} &bull; Lines {startLine}–{currentNode.lineEnd || startLine + lines.length - 1}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onOpenAskDoctor && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onOpenAskDoctor(`Explain what ${currentNode.displayName} (${currentNode.primaryMethod || ''}) does and the consequences of modifying it.`);
                  onClose();
                }}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', backgroundColor: '#4f46e5' }}
              >
                💬 Ask Doctor
              </button>
            )}
            {onCalculateBlastRadius && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleRunBlast}
                disabled={isCalculatingBlast}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                {isCalculatingBlast ? 'Analyzing...' : '💥 Blast Radius'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.4rem',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                marginLeft: '0.4rem',
              }}
              title="Close code viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Split View Body: Left = Inbound/Outbound & Consequences; Right = Code Viewer */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Panel: Inbound & Outbound Dependencies & Blast Radius */}
          <div
            style={{
              width: '380px',
              minWidth: '340px',
              maxWidth: '420px',
              backgroundColor: '#f8fafc',
              borderRight: '1.5px solid #e2e8f0',
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Plain-English Responsibility */}
            {currentNode.plainEnglishRole && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>💡</span> WHAT THIS FILE DOES:
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#14532d', lineHeight: 1.5 }}>
                  {currentNode.plainEnglishRole}
                </p>
              </div>
            )}

            {/* Precise Consequences of Changing This File */}
            {currentNode.consequencesOfChange && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>⚠️</span> PRECISE CONSEQUENCES &amp; BLAST RADIUS:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {currentNode.consequencesOfChange
                    .split('\n')
                    .map((item) => item.replace(/^[•\s*-]+/, '').trim())
                    .filter(Boolean)
                    .map((point, idx) => (
                      <div key={idx} style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.45, display: 'flex', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 700, color: '#b45309' }}>•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Blast Radius Results if computed */}
            {blastResult && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                }}
              >
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', fontWeight: 800, color: '#991b1b' }}>
                  💥 Downstream Blast Radius: {blastResult.totalImpactedNodes} component(s)
                </h4>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#b91c1c' }}>
                  Modifying this component cascades across {blastResult.maxDepth} call layer(s):
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '130px', overflowY: 'auto' }}>
                  {blastResult.steps.map((st) => (
                    <div key={st.edgeId} style={{ fontSize: '0.75rem', color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>↳ L{st.depth}:</span>
                      <strong>{st.targetNodeName}</strong>
                      <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>({st.targetNodeType})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inbound Callers List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                  📥 Inbound Callers ({callers.length})
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Click to view code</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Files and controllers that import or invoke this component:
              </p>

              {callers.length === 0 ? (
                <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                  No inbound callers recorded (root entrypoint or page shell)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {callers.map(({ edge, sourceNode }) => {
                    const isSelected = currentNode.id === sourceNode.id;
                    return (
                      <div
                        key={edge.id}
                        onClick={() => setActiveNode(sourceNode)}
                        style={{
                          padding: '0.55rem 0.75rem',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.1)' : 'none',
                        }}
                        title={`Click to inspect ${sourceNode.displayName} code`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {sourceNode.displayName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.05rem 0.35rem',
                              borderRadius: '3px',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            {edge.edgeType}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {sourceNode.primaryMethod && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                              ƒ {sourceNode.primaryMethod}
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            📁 {sourceNode.repositoryName}
                          </span>
                          {edge.isCrossRepository && (
                            <span style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                              Cross-Repo
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outbound Dependencies List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                  📤 Outbound Dependencies ({dependencies.length})
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Click to view code</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Services, repositories, &amp; entities called by this method:
              </p>

              {dependencies.length === 0 ? (
                <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                  No downstream calls recorded (leaf persistence or isolated logic)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {dependencies.map(({ edge, targetNode }) => {
                    const isSelected = currentNode.id === targetNode.id;
                    return (
                      <div
                        key={edge.id}
                        onClick={() => setActiveNode(targetNode)}
                        style={{
                          padding: '0.55rem 0.75rem',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.1)' : 'none',
                        }}
                        title={`Click to inspect ${targetNode.displayName} code`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {targetNode.displayName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.05rem 0.35rem',
                              borderRadius: '3px',
                              backgroundColor: edge.isCrossRepository ? '#fef3c7' : '#eff6ff',
                              color: edge.isCrossRepository ? '#92400e' : '#1e40af',
                            }}
                          >
                            {edge.edgeType}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {targetNode.primaryMethod && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                              ƒ {targetNode.primaryMethod}
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            📁 {targetNode.repositoryName}
                          </span>
                          {edge.isCrossRepository && (
                            <span style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                              Cross-Repo
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Source Code Viewer with Syntax & Line Numbers */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#0f172a',
              overflow: 'hidden',
            }}
          >
            {/* Code Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1.25rem',
                backgroundColor: '#1e293b',
                borderBottom: '1px solid #334155',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', marginLeft: '0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>
                  {currentNode.filePath || currentNode.identifier}
                </span>
                {currentNode.primaryMethod && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#60a5fa',
                      backgroundColor: 'rgba(37,99,235,0.2)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    ƒ {currentNode.primaryMethod}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  background: 'none',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#cbd5e1',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy Code'}
              </button>
            </div>

            {/* Code Content */}
            <div
              style={{
                flex: 1,
                padding: '1rem 1.25rem',
                overflow: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: '#e2e8f0',
                display: 'flex',
                gap: '1.25rem',
              }}
            >
              {/* Line Numbers */}
              <div
                style={{
                  userSelect: 'none',
                  color: '#475569',
                  textAlign: 'right',
                  minWidth: '2.5rem',
                  borderRight: '1px solid #334155',
                  paddingRight: '1rem',
                }}
              >
                {lines.map((_, i) => (
                  <div key={i}>{startLine + i}</div>
                ))}
              </div>

              {/* Code lines */}
              <pre style={{ margin: 0, flex: 1, whiteSpace: 'pre', overflowX: 'auto' }}>
                {lines.map((line, i) => (
                  <div key={i}>{line || ' '}</div>
                ))}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Viewing <strong>{currentNode.displayName}</strong> &bull; {callers.length} inbound caller(s) &bull; {dependencies.length} outbound dependenc(ies)
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            style={{ padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
