'use client';

import React, { useState, useEffect } from 'react';
import type { RepositoryDto, ProjectDto, ProjectAnalysisResultDto } from '@repo-doctor/shared';

interface ManageProjectReposModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly project: ProjectDto | null;
  readonly allRepositories: readonly RepositoryDto[];
  readonly onSaveRepositories: (repoIds: string[]) => Promise<void>;
  readonly onUnlinkRepository?: (repoId: string) => Promise<void>;
  readonly onAnalyzeProject?: () => Promise<ProjectAnalysisResultDto | null>;
  readonly isSaving?: boolean;
}

export function ManageProjectReposModal({
  isOpen,
  onClose,
  project,
  allRepositories,
  onSaveRepositories,
  onUnlinkRepository,
  onAnalyzeProject,
  isSaving = false,
}: ManageProjectReposModalProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialLinkedIds, setInitialLinkedIds] = useState<Set<string>>(new Set());
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ProjectAnalysisResultDto | null>(null);

  // Sync initial selections ONLY when modal opens or projectId changes
  useEffect(() => {
    if (isOpen && project) {
      const linked = new Set((project.repositories || []).map((r) => r.id));
      setSelectedIds(new Set(linked));
      setInitialLinkedIds(new Set(linked));
      setSaveError(null);
      setAnalysisResult(null);
      setSearchQuery('');
    }
  }, [isOpen, project?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isSavingLocal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSaving, isSavingLocal]);

  if (!isOpen || !project) return null;

  const filteredRepos = allRepositories.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.githubOrg.toLowerCase().includes(q);
  });

  const handleToggleRepo = (repoId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = (): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredRepos) {
        next.add(r.id);
      }
      return next;
    });
  };

  const handleDeselectAllFiltered = (): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of filteredRepos) {
        next.delete(r.id);
      }
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    setIsSavingLocal(true);
    setSaveError(null);
    try {
      await onSaveRepositories(Array.from(selectedIds));
      onClose();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      let friendlyMsg = 'Unable to update repository selection. Please try again.';
      if (rawMsg.toLowerCase().includes('another project')) {
        friendlyMsg = 'One or more selected repositories belong to another project. Repositories can only belong to one project at a time.';
      } else if (rawMsg.toLowerCase().includes('not found')) {
        friendlyMsg = 'One or more selected repositories could not be found. Please refresh the page.';
      } else if (rawMsg.toLowerCase().includes('network') || rawMsg.toLowerCase().includes('failed to fetch')) {
        friendlyMsg = 'Connection error: unable to contact the backend service. Check that your connection is active.';
      } else if (rawMsg) {
        friendlyMsg = rawMsg;
      }
      setSaveError(friendlyMsg);
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleRunBatchAnalysis = async (): Promise<void> => {
    if (!onAnalyzeProject) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await onAnalyzeProject();
      if (res) {
        setAnalysisResult(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Project analysis failed';
      setSaveError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Compute pending differences between current selection and initial state
  const addedCount = Array.from(selectedIds).filter((id) => !initialLinkedIds.has(id)).length;
  const removedCount = Array.from(initialLinkedIds).filter((id) => !selectedIds.has(id)).length;
  const hasChanges = addedCount > 0 || removedCount > 0;
  const currentlySaving = isSaving || isSavingLocal;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      data-testid="manage-project-repos-modal"
      onClick={() => {
        if (!currentlySaving) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '740px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Manage Project Repositories
              </h3>
              <span className="badge-info" style={{ fontWeight: 700 }}>
                {project.name}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
              Select which repositories belong to this project. Unlinking a repository preserves its analysis history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={currentlySaving}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              cursor: currentlySaving ? 'not-allowed' : 'pointer',
              padding: '0.25rem 0.5rem',
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Batch Analyze Bar */}
        {initialLinkedIds.size > 0 && onAnalyzeProject && (
          <div
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: 'var(--accent-blue-subtle)',
              borderBottom: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e40af' }}>
                Batch Project Analysis:
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>
                Analyze all {initialLinkedIds.size} saved project repositories.
              </span>
            </div>
            <button
              type="button"
              className="primary-btn"
              data-testid="analyze-all-project-repos-btn"
              onClick={() => void handleRunBatchAnalysis()}
              disabled={isAnalyzing || currentlySaving}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
            >
              {isAnalyzing ? 'Analyzing Repositories...' : '▶ Analyze Project'}
            </button>
          </div>
        )}

        {/* Batch Analysis Results */}
        {analysisResult && (
          <div
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: analysisResult.failed === 0 ? 'var(--accent-green-subtle)' : 'var(--accent-yellow-subtle)',
              borderBottom: '1px solid var(--border-default)',
              fontSize: '0.875rem',
            }}
          >
            <strong>Batch Analysis Completed:</strong> {analysisResult.successful} succeeded, {analysisResult.failed} failed.
            <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {analysisResult.repositoryResults.map((r) => (
                <div key={r.repositoryId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{r.repositoryName}</span>
                  <span style={{ color: r.status === 'SUCCESS' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                    {r.status === 'SUCCESS' ? `✓ Indexed (${r.totalNodes} nodes, ${r.totalEdges} edges)` : `× Error: ${r.error}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {saveError && (
          <div
            data-testid="manage-repos-error"
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: 'var(--accent-red-subtle)',
              borderBottom: '1px solid #fecaca',
              color: 'var(--accent-red)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ⚠️ {saveError}
          </div>
        )}

        {/* Search & Selection Filter Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <input
            type="text"
            className="select-input"
            style={{ flex: 1, minWidth: '220px', padding: '0.5rem 0.85rem' }}
            placeholder="Search authorized repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleSelectAllFiltered}
              disabled={currentlySaving}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            >
              Select All Filtered
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDeselectAllFiltered}
              disabled={currentlySaving}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            >
              Deselect All Filtered
            </button>
          </div>
        </div>

        {/* Repository Checkbox List */}
        <div
          style={{
            padding: '1rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
          data-testid="project-repo-checkbox-list"
        >
          {filteredRepos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              No repositories match &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isChecked = selectedIds.has(repo.id);
              const wasInitiallyLinked = initialLinkedIds.has(repo.id);
              const isPendingAddition = isChecked && !wasInitiallyLinked;
              const isPendingRemoval = !isChecked && wasInitiallyLinked;

              return (
                <div
                  key={repo.id}
                  onClick={() => handleToggleRepo(repo.id)}
                  style={{
                    padding: '0.85rem 1.1rem',
                    borderRadius: '8px',
                    border: `1px solid ${
                      isPendingRemoval
                        ? '#fca5a5'
                        : isChecked
                        ? 'var(--accent-blue)'
                        : 'var(--border-default)'
                    }`,
                    backgroundColor: isPendingRemoval
                      ? '#fff1f2'
                      : isChecked
                      ? 'var(--accent-blue-subtle)'
                      : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: isChecked ? '0 0 0 1px var(--accent-blue)' : 'var(--shadow-sm)',
                    transition: 'all 0.15s ease-in-out',
                  }}
                  data-testid={`project-repo-item-${repo.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRepo(repo.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                      data-testid={`checkbox-repo-${repo.id}`}
                      aria-label={`Select ${repo.githubOrg}/${repo.name}`}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {repo.githubOrg} / {repo.name}
                        </span>
                        {wasInitiallyLinked && !isPendingRemoval && (
                          <span className="badge-info" style={{ fontSize: '0.75rem' }}>
                            Linked
                          </span>
                        )}
                        {isPendingAddition && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                            }}
                          >
                            + Staged to Add
                          </span>
                        )}
                        {isPendingRemoval && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                            }}
                          >
                            - Staged to Unlink
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Branch: <strong>{repo.defaultBranch || 'main'}</strong> · Updated: {new Date(repo.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Quick toggle action button */}
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRepo(repo.id);
                    }}
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      color: isChecked ? 'var(--accent-red)' : 'var(--accent-blue)',
                      borderColor: isChecked ? '#fecaca' : '#bfdbfe',
                    }}
                  >
                    {isChecked ? 'Deselect' : 'Select'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <strong>{selectedIds.size}</strong> of {allRepositories.length} repositories selected
            </span>
            {hasChanges && (
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                }}
              >
                Unsaved changes ({addedCount > 0 ? `+${addedCount}` : ''}{addedCount > 0 && removedCount > 0 ? ', ' : ''}{removedCount > 0 ? `-${removedCount}` : ''})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
              disabled={currentlySaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn"
              data-testid="save-project-repos-btn"
              onClick={() => void handleSave()}
              disabled={currentlySaving}
            >
              {currentlySaving ? 'Saving Selection...' : 'Save Selection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
