'use client';

import React, { useState } from 'react';
import type {
  ProjectArchitectureDto,
  VisualTopologyNodeDto,
  VisualTopologyEdgeDto,
  BlastRadiusResultDto,
  BusinessFeatureDto,
  EdgeType,
} from '@repo-doctor/shared';

interface VisualArchitectureViewProps {
  readonly architecture: ProjectArchitectureDto | null;
  readonly projectFeatures?: readonly BusinessFeatureDto[];
  readonly initialFeatureId?: string | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onAnalyzeProject?: () => void;
  readonly isAnalyzing?: boolean;
  readonly onCalculateBlastRadius?: (nodeId: string, repositoryId?: string) => Promise<BlastRadiusResultDto>;
  readonly onOpenAskDoctor?: (initialQuestion: string) => void;
  readonly onOpenCodeViewer?: (node: VisualTopologyNodeDto) => void;
}

export function VisualArchitectureView({
  architecture,
  projectFeatures,
  initialFeatureId,
  isLoading,
  error,
  onAnalyzeProject,
  isAnalyzing,
  onCalculateBlastRadius,
  onOpenAskDoctor,
  onOpenCodeViewer,
}: VisualArchitectureViewProps): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<'storyboard' | 'flow' | 'layers' | 'dependencies' | 'relationships'>('storyboard');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(initialFeatureId || 'ALL');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<VisualTopologyNodeDto | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<VisualTopologyEdgeDto | null>(null);
  const [filterCrossRepoOnly, setFilterCrossRepoOnly] = useState<boolean>(false);
  const [filterRepoId, setFilterRepoId] = useState<string>('ALL');
  const [filterEdgeType, setFilterEdgeType] = useState<string>('ALL');
  const [blastRadius, setBlastRadius] = useState<BlastRadiusResultDto | null>(null);
  const [isCalculatingBlast, setIsCalculatingBlast] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="card-section" data-testid="architecture-loading" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>🕸️</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
          Constructing Cross-Repository Architecture Topology...
        </h3>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem' }}>
          Mapping role layers, tracing API routes, queues, and database connections.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-forbidden" data-testid="architecture-error">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>Architecture Error</h3>
        <p style={{ fontSize: '0.95rem', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!architecture || architecture.nodes.length === 0) {
    return (
      <div className="empty-state-box" data-testid="architecture-empty">
        <div style={{ fontSize: '2.8rem', marginBottom: '1rem' }}>🕸️</div>
        <h3 className="empty-state-title">No Architecture Discovered Yet</h3>
        <p className="empty-state-text">
          Run analysis across your linked project repositories to discover visual component flows from the frontend to the database.
        </p>
        {onAnalyzeProject && (
          <button
            type="button"
            className="primary-btn"
            onClick={onAnalyzeProject}
            disabled={isAnalyzing}
            style={{ padding: '0.6rem 1.4rem' }}
          >
            {isAnalyzing ? 'Analyzing Repositories...' : 'Analyze Project Repositories'}
          </button>
        )}
      </div>
    );
  }

  const { roleLayers, edges, crossRepositoryEdges, repositories } = architecture;

  // Node Map for edge resolution
  const nodeMap = new Map<string, VisualTopologyNodeDto>(architecture.nodes.map((n) => [n.id, n]));

  // Filter edges according to controls
  const filteredEdges = edges.filter((e) => {
    if (filterCrossRepoOnly && !e.isCrossRepository) return false;
    if (filterEdgeType !== 'ALL' && e.edgeType !== filterEdgeType) return false;
    if (filterRepoId !== 'ALL') {
      const src = nodeMap.get(e.sourceNodeId);
      const tgt = nodeMap.get(e.targetNodeId);
      if (src?.repositoryId !== filterRepoId && tgt?.repositoryId !== filterRepoId) {
        return false;
      }
    }
    return true;
  });

  // Filter nodes according to repository filter
  const filteredNodes = architecture.nodes.filter((n) => {
    if (filterRepoId !== 'ALL' && n.repositoryId !== filterRepoId) return false;
    return true;
  });

  // Inbound & Outbound edges for selected node
  const inboundEdges = selectedNode
    ? edges.filter((e) => e.targetNodeId === selectedNode.id)
    : [];
  const outboundEdges = selectedNode
    ? edges.filter((e) => e.sourceNodeId === selectedNode.id)
    : [];

  const handleNodeClick = (node: VisualTopologyNodeDto): void => {
    if (onOpenCodeViewer) {
      onOpenCodeViewer(node);
    }
    setSelectedNode(node);
    setSelectedEdge(null);
    setBlastRadius(null);
  };

  const handleEdgeClick = (edge: VisualTopologyEdgeDto): void => {
    setSelectedEdge(edge);
    const srcNode = nodeMap.get(edge.sourceNodeId);
    if (srcNode) {
      if (onOpenCodeViewer) onOpenCodeViewer(srcNode);
      setSelectedNode(srcNode);
    }
    setBlastRadius(null);
  };

  const toggleExpandNode = (nodeId: string): void => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSimulateImpact = async (nodeId: string, repositoryId?: string): Promise<void> => {
    if (!onCalculateBlastRadius) return;
    setIsCalculatingBlast(true);
    try {
      const res = await onCalculateBlastRadius(nodeId, repositoryId);
      setBlastRadius(res);
    } finally {
      setIsCalculatingBlast(false);
    }
  };

  // Build root flow entrypoints: Frontend or API nodes with callers or entry roles
  React.useEffect(() => {
    if (initialFeatureId) {
      setSelectedFeatureId(initialFeatureId);
      setActiveSubTab('storyboard');
    }
  }, [initialFeatureId]);

  const currentFeature = selectedFeatureId !== 'ALL'
    ? projectFeatures?.find((f) => f.id === selectedFeatureId)
    : null;

  const featureComponentIds = new Set(currentFeature?.participatingComponents.map((c) => c.id) || []);

  const entryNodes = (() => {
    if (selectedFeatureId !== 'ALL' && currentFeature) {
      const inFeature = filteredNodes.filter((n) => featureComponentIds.has(n.id));
      const roots = inFeature.filter(
        (n) => n.role === 'FRONTEND' || n.role === 'API' || (n.incomingCount === 0 && n.outgoingCount > 0),
      );
      return roots.length > 0 ? roots : inFeature.slice(0, 20);
    }
    return filteredNodes.filter(
      (n) => n.role === 'FRONTEND' || n.role === 'API' || (n.incomingCount === 0 && n.outgoingCount > 0),
    );
  })();

  const layers = [
    { key: 'frontend', title: '1. Frontend / Web', items: roleLayers.frontend, icon: '🖥️' },
    { key: 'api', title: '2. API & Routes', items: roleLayers.api, icon: '⚡' },
    { key: 'services', title: '3. Business Services', items: roleLayers.services, icon: '⚙️' },
    { key: 'queue', title: '4. Queues & Workers', items: roleLayers.queue, icon: '📬' },
    { key: 'database', title: '5. Databases & Storage', items: roleLayers.database, icon: '🗄️' },
    { key: 'packages', title: '6. Shared Packages', items: roleLayers.packages, icon: '📦' },
  ];

  const getEdgeBadgeStyle = (edgeType: EdgeType): { bg: string; color: string; label: string } => {
    switch (edgeType) {
      case 'CALLS':
        return { bg: '#dbeafe', color: '#1e40af', label: 'CALLS' };
      case 'READS_FROM':
        return { bg: '#dcfce7', color: '#166534', label: 'READS_FROM' };
      case 'WRITES_TO':
        return { bg: '#fef3c7', color: '#92400e', label: 'WRITES_TO' };
      case 'PRODUCES':
        return { bg: '#e0e7ff', color: '#3730a3', label: 'PRODUCES' };
      case 'CONSUMES':
        return { bg: '#fae8ff', color: '#86198f', label: 'CONSUMES' };
      case 'DEPENDS_ON':
      default:
        return { bg: '#f1f5f9', color: '#475569', label: 'DEPENDS_ON' };
    }
  };

  const renderSwimlaneLane = (
    laneTitle: string,
    repoName: string,
    icon: string,
    laneType: 'CLIENT' | 'API' | 'SERVICE' | 'DATABASE',
    feature: BusinessFeatureDto,
    allNodes: readonly VisualTopologyNodeDto[],
    onSelectNode: (node: VisualTopologyNodeDto) => void,
    onViewCode?: (node: VisualTopologyNodeDto) => void,
    onSimulateBlast?: (nodeId: string, repoId?: string) => void
  ) => {
    const explicitSteps = (feature.sequenceSteps || []).filter((s) => s.lane === laneType);

    const derivedSteps =
      explicitSteps.length > 0
        ? explicitSteps
        : feature.participatingComponents
            .filter((c) => {
              const r = (c.type || '').toUpperCase();
              if (laneType === 'CLIENT') return r === 'FRONTEND';
              if (laneType === 'API') return r === 'API';
              if (laneType === 'SERVICE') return r === 'SERVICE' || r === 'WORKER';
              if (laneType === 'DATABASE') return r === 'PERSISTENCE' || r === 'QUEUE' || r === 'DATABASE';
              return false;
            })
            .map((c, idx) => ({
              stepNumber: idx + 1,
              title: c.name.replace(/\.[^/.]+$/, ''),
              lane: laneType,
              componentName: c.name,
              repositoryName: c.repositoryName,
              primaryMethod: c.primaryMethod || 'execute()',
              description: `Executes ${c.name} in ${c.repositoryName}`,
              networkCall: laneType === 'API' ? 'HTTP REST' : undefined,
            }));

    return (
      <div
        key={laneType}
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          minHeight: '320px',
        }}
      >
        <div
          style={{
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
            <span>{icon}</span>
            <span>{laneTitle}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            📁 {repoName} &bull; {derivedSteps.length} Step{derivedSteps.length === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
          {derivedSteps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
              No operations in this lane
            </div>
          ) : (
            derivedSteps.map((step) => {
              const matchingNode = allNodes.find(
                (n) =>
                  n.displayName.toLowerCase() === step.componentName.toLowerCase() ||
                  n.identifier.toLowerCase().includes(step.componentName.toLowerCase()) ||
                  n.filePath?.toLowerCase().includes(step.componentName.toLowerCase())
              );

              return (
                <div
                  key={`${step.lane}-${step.stepNumber}-${step.componentName}`}
                  onClick={() => {
                    if (matchingNode) onSelectNode(matchingNode);
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    cursor: matchingNode ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                      }}
                    >
                      Step {step.stepNumber}
                    </span>
                    {step.networkCall && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontFamily: 'monospace',
                        }}
                      >
                        {step.networkCall}
                      </span>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                    {step.title}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                      {step.componentName}
                    </span>
                    {step.primaryMethod && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#1d4ed8',
                          backgroundColor: '#eff6ff',
                          padding: '0.05rem 0.3rem',
                          borderRadius: '3px',
                        }}
                      >
                        ƒ {step.primaryMethod}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                    {step.description}
                  </p>

                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {onViewCode && matchingNode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCode(matchingNode);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.2rem 0.4rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#2563eb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.2rem',
                        }}
                        title={`View source code for ${matchingNode.displayName}`}
                      >
                        <span>🔍</span>
                        <span>View Code</span>
                      </button>
                    )}
                    {onSimulateBlast && matchingNode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSimulateBlast(matchingNode.id, matchingNode.repositoryId);
                        }}
                        style={{
                          padding: '0.2rem 0.4rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          cursor: 'pointer',
                        }}
                        title="Simulate blast radius impact"
                      >
                        💥 Impact
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div data-testid="visual-architecture-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Filter & View Switcher Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              Architecture & Execution Flows
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
              {architecture.nodes.length} Components &bull; {edges.length} Relationships ({edges.filter((e) => e.edgeType !== 'DEPENDS_ON').length} operational calls) &bull; {crossRepositoryEdges.length} Cross-Repo Boundaries
            </p>
          </div>

          {/* Sub-view Switcher: Storyboard vs Flow Tree vs Layered Topology vs Friendly Dependencies vs Relationships Table */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', gap: '2px' }}>
            <button
              type="button"
              className={`tab-button ${activeSubTab === 'storyboard' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('storyboard')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              🎬 Feature Storyboard
            </button>
            <button
              type="button"
              className={`tab-button ${activeSubTab === 'flow' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('flow')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              🌳 Execution Flow Tree
            </button>
            <button
              type="button"
              className={`tab-button ${activeSubTab === 'layers' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('layers')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              🏢 Layered Topology
            </button>
            <button
              type="button"
              className={`tab-button ${activeSubTab === 'dependencies' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('dependencies')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              📋 Friendly Dependencies
            </button>
            <button
              type="button"
              className={`tab-button ${activeSubTab === 'relationships' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('relationships')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              ⚙️ Relationships Table
            </button>
          </div>

          {/* Feature Selector Dropdown */}
          {projectFeatures && projectFeatures.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                🎯 Feature Flow:
              </span>
              <select
                value={selectedFeatureId}
                onChange={(e) => {
                  setSelectedFeatureId(e.target.value);
                  setActiveSubTab('storyboard');
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                  maxWidth: '280px',
                }}
              >
                <option value="ALL">🌐 All Project Flows ({architecture.nodes.length} nodes)</option>
                {projectFeatures.map((f) => (
                  <option key={f.id} value={f.id}>
                    ✨ {f.title} ({f.participatingComponents.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Compact Filters Button */}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: showFilters ? '#e0e7ff' : '#ffffff',
              borderColor: showFilters ? '#6366f1' : '#cbd5e1',
            }}
          >
            <span>⚙️ Filters</span>
            {(filterRepoId !== 'ALL' || filterEdgeType !== 'ALL' || filterCrossRepoOnly) && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
            )}
            <span>{showFilters ? '▴' : '▾'}</span>
          </button>
        </div>

        {/* Global Action Button */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onOpenAskDoctor && (
            <button
              type="button"
              className="primary-btn"
              onClick={() => onOpenAskDoctor('What is the complete flow across the frontend, backend, and database?')}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
            >
              💬 Explain Entire Flow
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar (Hidden behind compact Filters toggle) */}
      {showFilters && (
        <div
          className="card-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Repository Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Repository:</span>
            <select
              className="select-input"
              value={filterRepoId}
              onChange={(e) => setFilterRepoId(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value="ALL">All Repositories ({repositories.length})</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.org}/{r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Relationship:</span>
            <select
              className="select-input"
              value={filterEdgeType}
              onChange={(e) => setFilterEdgeType(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value="ALL">All Relationships ({edges.length})</option>
              <option value="CALLS">CALLS (Method/Function Calls)</option>
              <option value="READS_FROM">READS_FROM (Database Queries)</option>
              <option value="WRITES_TO">WRITES_TO (Database Mutations)</option>
              <option value="PRODUCES">PRODUCES (Queue Enqueue)</option>
              <option value="CONSUMES">CONSUMES (Queue Workers)</option>
              <option value="DEPENDS_ON">DEPENDS_ON (Imports/Exports)</option>
            </select>
          </div>

          {/* Cross-Repository Only Toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#b45309',
              marginLeft: 'auto',
            }}
          >
            <input
              type="checkbox"
              checked={filterCrossRepoOnly}
              onChange={(e) => setFilterCrossRepoOnly(e.target.checked)}
              style={{ accentColor: '#d97706' }}
            />
            <span>Highlight Cross-Repository Only ({crossRepositoryEdges.length})</span>
          </label>
        </div>
      )}

      {/* Main Content Area: Flow Tree, Storyboard, Layers & Technical Table (Full Width) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activeSubTab === 'storyboard' ? (
            /* 0. Feature Execution Storyboard (4-Lane Sequence Diagram) */
            <div
              className="card-section"
              data-testid="architecture-storyboard"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                backgroundColor: '#ffffff',
              }}
            >
              {currentFeature ? (
                <>
                  {/* Feature Header Card */}
                  <div
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      border: '1.5px solid #bfdbfe',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                            }}
                          >
                            {currentFeature.category}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                            Spans: {currentFeature.relatedRepositories.join(' ➔ ')}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            {currentFeature.participatingComponents.length} Components
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                          🎬 {currentFeature.title} — End-to-End Execution Storyboard
                        </h3>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {onOpenAskDoctor && (
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => onOpenAskDoctor(`Explain the complete system flow for ${currentFeature.title}`)}
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                          >
                            💬 Ask Doctor About This Flow
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setSelectedFeatureId('ALL')}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                        >
                          All Features Blueprint
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>
                      {currentFeature.naturalLanguageExplanation || currentFeature.description}
                    </p>
                  </div>

                  {/* 4-Lane Swimlane Diagram */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Cross-Repository Execution Journey (Client ➔ API ➔ Service ➔ Database)
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Click any card to inspect code or calculate blast radius
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: '0.85rem',
                        overflowX: 'auto',
                        paddingBottom: '0.5rem',
                      }}
                    >
                      {/* Lane 1: Client UI */}
                      {renderSwimlaneLane(
                        '1. Client UI',
                        'cadence-web',
                        '🖥️',
                        'CLIENT',
                        currentFeature,
                        architecture.nodes,
                        handleNodeClick,
                        onOpenCodeViewer,
                        handleSimulateImpact
                      )}

                      {/* Lane 2: API Gateway */}
                      {renderSwimlaneLane(
                        '2. API Gateway',
                        'cadence-api',
                        '⚡',
                        'API',
                        currentFeature,
                        architecture.nodes,
                        handleNodeClick,
                        onOpenCodeViewer,
                        handleSimulateImpact
                      )}

                      {/* Lane 3: Business Services */}
                      {renderSwimlaneLane(
                        '3. Business Services',
                        'cadence-api',
                        '⚙️',
                        'SERVICE',
                        currentFeature,
                        architecture.nodes,
                        handleNodeClick,
                        onOpenCodeViewer,
                        handleSimulateImpact
                      )}

                      {/* Lane 4: Database & Queue */}
                      {renderSwimlaneLane(
                        '4. Data & Storage',
                        'PostgreSQL / BullMQ',
                        '🗄️',
                        'DATABASE',
                        currentFeature,
                        architecture.nodes,
                        handleNodeClick,
                        onOpenCodeViewer,
                        handleSimulateImpact
                      )}
                    </div>
                  </div>

                  {/* Tech Lead Architecture Walkthrough & Consequences Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1.25rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.15rem' }}>🎯</span>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Tech Lead Architecture Walkthrough
                        </h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
                        {currentFeature.naturalLanguageExplanation || currentFeature.description}
                      </p>
                    </div>

                    {currentFeature.consequencesOfChange && (
                      <div
                        style={{
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>💥</span> CONSEQUENCES OF MODIFYING THIS FLOW:
                        </div>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#78350f', lineHeight: 1.5 }}>
                          {currentFeature.consequencesOfChange}
                        </p>
                      </div>
                    )}

                    {currentFeature.whereToStartGuide && (
                      <div
                        style={{
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🚀</span> WHERE TO START (NEW DEVELOPER GUIDE):
                        </div>
                        <p style={{ margin: 0, fontSize: '0.825rem', color: '#14532d', lineHeight: 1.5 }}>
                          {currentFeature.whereToStartGuide}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ALL Features Blueprint: Multi-Repo System Architecture */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* System Architecture Blueprint Banner */}
                  <div
                    style={{
                      padding: '1.5rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                      border: '1.5px solid #bfdbfe',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🚀</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                        Multi-Repository System Architecture Blueprint
                      </h3>
                    </div>
                    <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                      RepoDoctor maps cross-repository boundaries so new developers and tech leads immediately understand how client UI triggers backend routes, domain services, and database persistence.
                    </p>

                    {/* Architecture Topology Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                          <span>🖥️</span> cadence-web (Frontend)
                        </div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                          Next.js 14 App Router with React client components, Tailwind CSS, and TanStack React Query.
                        </p>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>
                          Routes: login, projects, tasks, chat, billing
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                          <span>⚡</span> cadence-api (Backend)
                        </div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                          NestJS modular REST application with TypeORM repositories, JwtAuthGuard, and BullMQ queues.
                        </p>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>
                          Gateways: Auth, Projects, Tasks, AI, Billing
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                          <span>🗄️</span> PostgreSQL &amp; Redis
                        </div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                          PostgreSQL 16 relational database with pgvector embeddings, plus Redis for asynchronous jobs.
                        </p>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                          Entities: Users, Projects, Tasks, Comments
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core System Workflows Grid */}
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem' }}>
                      Select a System Feature to View its Storyboard Flow:
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                      {(projectFeatures || []).map((feat) => (
                        <div
                          key={feat.id}
                          style={{
                            padding: '1.1rem',
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.85rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                }}
                              >
                                {feat.category}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {feat.participatingComponents.length} components
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
                              {feat.title}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.825rem', color: '#475569', lineHeight: 1.5 }}>
                              {feat.naturalLanguageExplanation || feat.description}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              className="primary-btn"
                              onClick={() => {
                                setSelectedFeatureId(feat.id);
                              }}
                              style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                            >
                              🎬 View Storyboard Flow
                            </button>
                            {onOpenAskDoctor && (
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => onOpenAskDoctor(`Explain the complete system flow for ${feat.title}`)}
                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                                title="Ask Doctor about this feature"
                              >
                                💬 Ask
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeSubTab === 'flow' ? (
            /* 1. Interactive Execution Flow Tree */
            <div
              className="card-section"
              data-testid="architecture-flow-tree"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    System Execution Flows (Frontend ➔ API ➔ Service ➔ Database/Queue)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                    Expandable hierarchy tracing verified calls from entrypoints down to data access operations.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setExpandedNodes(new Set(entryNodes.map((n) => n.id)));
                    }}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                  >
                    Expand All Branches
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setExpandedNodes(new Set())}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {currentFeature && (
                <div
                  style={{
                    padding: '0.85rem 1.1rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem' }}>
                        ✨ Feature Flow: {currentFeature.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          padding: '0.1rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {currentFeature.participatingComponents.length} Components &bull; {currentFeature.relatedRepositories.join(' + ')}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#14532d' }}>
                      {currentFeature.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => onOpenAskDoctor?.(`Explain the complete system flow for ${currentFeature.title}`)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                    >
                      💬 Ask Doctor About This Flow
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setSelectedFeatureId('ALL')}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                    >
                      Show All Flows
                    </button>
                  </div>
                </div>
              )}

              {entryNodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No entrypoint components match the active filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {entryNodes.map((rootNode) => {
                    const isExpanded = expandedNodes.has(rootNode.id);
                    const rootOutbound = edges.filter((e) => e.sourceNodeId === rootNode.id);
                    const isSelected = selectedNode?.id === rootNode.id;

                    return (
                      <div
                        key={rootNode.id}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        {/* Root Node Header */}
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleNodeClick(rootNode)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandNode(rootNode.id);
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                width: '22px',
                                height: '22px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                fontWeight: 700,
                                color: '#334155',
                              }}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                            <span style={{ fontSize: '1rem' }}>
                              {rootNode.role === 'FRONTEND' ? '🖥️' : rootNode.role === 'API' ? '⚡' : '⚙️'}
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                              {rootNode.displayName}
                            </span>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
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
                              {rootNode.primaryMethod || 'execute()'}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                              }}
                            >
                              📁 {rootNode.repositoryName}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                              }}
                            >
                              {rootNode.role}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {rootOutbound.length} downstream connections
                            </span>
                            {onOpenCodeViewer && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenCodeViewer(rootNode);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                }}
                                title={`Open source code for ${rootNode.displayName} at ${rootNode.primaryMethod || 'method'}`}
                              >
                                <span>🔍</span>
                                <span>Code</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Flow Branches */}
                        {isExpanded && (
                          <div style={{ padding: '0.75rem 1.25rem 1rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                            {rootOutbound.length === 0 ? (
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                No downstream calls discovered. (Leaf node or external boundary)
                              </div>
                            ) : (
                              rootOutbound.map((edge) => {
                                const targetNode = nodeMap.get(edge.targetNodeId);
                                const badge = getEdgeBadgeStyle(edge.edgeType);
                                const isChildSelected = selectedNode?.id === targetNode?.id;

                                // Level 3: downstream operations from targetNode (e.g. Service -> Database)
                                const targetDownstream = targetNode
                                  ? edges.filter((e) => e.sourceNodeId === targetNode.id)
                                  : [];

                                return (
                                  <div
                                    key={edge.id}
                                    style={{
                                      padding: '0.65rem 0.85rem',
                                      backgroundColor: isChildSelected ? '#eff6ff' : '#ffffff',
                                      border: isChildSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.4rem',
                                      cursor: 'pointer',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdgeClick(edge);
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem' }}>├──</span>
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '4px',
                                            backgroundColor: badge.bg,
                                            color: badge.color,
                                          }}
                                        >
                                          {badge.label}
                                        </span>
                                        <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
                                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                                          {targetNode?.displayName || edge.targetNodeId}
                                        </span>
                                        <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
                                        <span
                                          style={{
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            color: '#1d4ed8',
                                            backgroundColor: '#eff6ff',
                                            padding: '0.1rem 0.35rem',
                                            borderRadius: '4px',
                                            border: '1px solid #dbeafe',
                                          }}
                                        >
                                          {targetNode?.primaryMethod || 'execute()'}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '4px',
                                            backgroundColor: '#f1f5f9',
                                            color: '#475569',
                                          }}
                                        >
                                          {targetNode?.role || 'COMPONENT'}
                                        </span>
                                        {edge.isCrossRepository && (
                                          <span
                                            style={{
                                              fontSize: '0.7rem',
                                              fontWeight: 700,
                                              padding: '0.1rem 0.45rem',
                                              borderRadius: '4px',
                                              backgroundColor: '#fef3c7',
                                              color: '#92400e',
                                            }}
                                          >
                                            Cross-Repo: {edge.targetRepositoryName}
                                          </span>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {onOpenCodeViewer && targetNode && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenCodeViewer(targetNode);
                                            }}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.2rem',
                                              padding: '0.2rem 0.5rem',
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              borderRadius: '4px',
                                              border: '1px solid #cbd5e1',
                                              backgroundColor: '#ffffff',
                                              color: '#2563eb',
                                              cursor: 'pointer',
                                            }}
                                            title={`Open source code for ${targetNode.displayName} at ${targetNode.primaryMethod || 'method'}`}
                                          >
                                            <span>🔍</span>
                                            <span>Code</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Friendly dependency sentence */}
                                    {edge.friendlyDescription && (
                                      <div style={{ fontSize: '0.8rem', color: '#475569', paddingLeft: '1.5rem', fontStyle: 'italic' }}>
                                        💬 {edge.friendlyDescription}
                                      </div>
                                    )}

                                    {/* Level 3: Nested operations (e.g. Service calling Database or Queue) */}
                                    {targetDownstream.length > 0 && (
                                      <div style={{ marginLeft: '1.25rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        {targetDownstream.map((subEdge) => {
                                          const subTarget = nodeMap.get(subEdge.targetNodeId);
                                          const subBadge = getEdgeBadgeStyle(subEdge.edgeType);
                                          return (
                                            <div
                                              key={subEdge.id}
                                              style={{
                                                fontSize: '0.8rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '0.4rem',
                                                color: '#475569',
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '4px',
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdgeClick(subEdge);
                                              }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>│   └──</span>
                                                <span
                                                  style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    padding: '0.1rem 0.35rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: subBadge.bg,
                                                    color: subBadge.color,
                                                  }}
                                                >
                                                  {subBadge.label}
                                                </span>
                                                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                                  {subTarget?.displayName || subEdge.targetNodeId}
                                                </span>
                                                <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
                                                <span
                                                  style={{
                                                    fontFamily: 'monospace',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                    color: '#1d4ed8',
                                                    backgroundColor: '#eff6ff',
                                                    padding: '0.05rem 0.3rem',
                                                    borderRadius: '3px',
                                                  }}
                                                >
                                                  {subTarget?.primaryMethod || 'query()'}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                  ({subTarget?.role})
                                                </span>
                                              </div>

                                              {onOpenCodeViewer && subTarget && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenCodeViewer(subTarget);
                                                  }}
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.2rem',
                                                    padding: '0.15rem 0.4rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    borderRadius: '3px',
                                                    border: '1px solid #cbd5e1',
                                                    backgroundColor: '#ffffff',
                                                    color: '#2563eb',
                                                    cursor: 'pointer',
                                                  }}
                                                  title={`Open source code for ${subTarget.displayName}`}
                                                >
                                                  <span>🔍</span>
                                                  <span>Code</span>
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeSubTab === 'layers' ? (
            /* 2. Layered Multi-Column Topology */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {layers.map((layer) => (
                <div
                  key={layer.key}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: '260px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '2px solid #f1f5f9',
                      paddingBottom: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      <span>{layer.icon}</span>
                      <span>{layer.title}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '9999px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                      }}
                    >
                      {layer.items.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                    {layer.items.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        No components discovered
                      </div>
                    ) : (
                      layer.items.map((node: VisualTopologyNodeDto) => {
                        const isSelected = selectedNode?.id === node.id;
                        return (
                          <div
                            key={node.id}
                            data-testid={`arch-node-${node.id}`}
                            onClick={() => handleNodeClick(node)}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease-in-out',
                              boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.15)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', wordBreak: 'break-word' }}>
                                {node.displayName}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#e2e8f0',
                                  color: '#334155',
                                }}
                              >
                                {node.nodeType}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>
                              <span>📁</span>
                              <span style={{ fontWeight: 600 }}>{node.repositoryName}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem' }}>
                              <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                ↓ In: {node.incomingCount}
                              </span>
                              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                ↑ Out: {node.outgoingCount}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : activeSubTab === 'dependencies' ? (
            /* 3. User-Friendly File & Method Dependencies Catalog */
            <div
              className="card-section"
              data-testid="architecture-friendly-dependencies"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 0.25rem' }}>
                  📋 User-Friendly File &amp; Method Dependencies ({filteredEdges.length})
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Plain-English explanations of which files depend on what other files, methods called, and cross-repo boundaries.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredEdges.map((edge: VisualTopologyEdgeDto) => {
                  const src = nodeMap.get(edge.sourceNodeId);
                  const tgt = nodeMap.get(edge.targetNodeId);
                  const badge = getEdgeBadgeStyle(edge.edgeType);

                  const friendlySentence =
                    edge.friendlyDescription ||
                    `${src?.displayName || edge.sourceNodeId} imports and calls ${tgt?.displayName || edge.targetNodeId}`;

                  return (
                    <div
                      key={edge.id}
                      onClick={() => handleEdgeClick(edge)}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: edge.isCrossRepository ? '#fffbeb' : '#f8fafc',
                        border: edge.isCrossRepository ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Top Bar: Source File+Method ➔ Badge ➔ Target File+Method */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                            {src?.displayName || edge.sourceNodeId}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              backgroundColor: '#eff6ff',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            {src?.primaryMethod || 'execute()'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({src?.repositoryName})
                          </span>

                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>

                          <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>

                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                            {tgt?.displayName || edge.targetNodeId}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              backgroundColor: '#eff6ff',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            {tgt?.primaryMethod || 'execute()'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({tgt?.repositoryName})
                          </span>
                        </div>

                        {/* Quick View Code buttons */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {onOpenCodeViewer && src && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCodeViewer(src);
                              }}
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
                              title={`View ${src.displayName}`}
                            >
                              🔍 Source Code
                            </button>
                          )}
                          {onOpenCodeViewer && tgt && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCodeViewer(tgt);
                              }}
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
                              title={`View ${tgt.displayName}`}
                            >
                              🔍 Target Code
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Plain-English Explanation */}
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#334155',
                          lineHeight: 1.5,
                          backgroundColor: '#ffffff',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ color: edge.isCrossRepository ? '#b45309' : '#2563eb', fontWeight: 700 }}>
                          {edge.isCrossRepository ? '⚡' : '💬'}
                        </span>
                        <span>{friendlySentence}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 4. Secondary Technical Relationships Table */
            <div
              className="card-section"
              data-testid="architecture-relationships-table"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 0.25rem' }}>
                  Technical Relationship Catalog ({filteredEdges.length})
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Raw static dependency, operational call, and data access edges across repositories.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredEdges.map((edge: VisualTopologyEdgeDto) => {
                  const src = nodeMap.get(edge.sourceNodeId);
                  const tgt = nodeMap.get(edge.targetNodeId);
                  const badge = getEdgeBadgeStyle(edge.edgeType);

                  return (
                    <div
                      key={edge.id}
                      onClick={() => handleEdgeClick(edge)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        backgroundColor: edge.isCrossRepository ? '#fffbeb' : '#f8fafc',
                        border: edge.isCrossRepository ? '1px solid #fde68a' : '1px solid #e2e8f0',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {src?.displayName || edge.sourceNodeId}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({src?.repositoryName || 'repo'})
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ color: '#2563eb', fontWeight: 700 }}>➔</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {tgt?.displayName || edge.targetNodeId}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({tgt?.repositoryName || 'repo'})
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {edge.isCrossRepository && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                            }}
                          >
                            Cross-Repo
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: edge.isInferred ? '#fef3c7' : '#dcfce7',
                            color: edge.isInferred ? '#92400e' : '#166534',
                          }}
                        >
                          {edge.isInferred ? 'Inferred' : 'Verified AST'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
