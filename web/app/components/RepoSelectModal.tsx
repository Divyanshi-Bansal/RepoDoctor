'use client';

import React, { useState, useEffect } from 'react';
import type { RepositoryDto } from '@repo-doctor/shared';

interface RepoSelectModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly repositories: readonly RepositoryDto[];
  readonly currentRepoId: string;
  readonly onSelectRepo: (repoId: string) => void;
  readonly onRefresh: () => void;
  readonly isRefreshing?: boolean;
}

export function RepoSelectModal({
  isOpen,
  onClose,
  repositories,
  currentRepoId,
  onSelectRepo,
  onRefresh,
  isRefreshing,
}: RepoSelectModalProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(currentRepoId);

  useEffect(() => {
    setSelectedId(currentRepoId);
  }, [currentRepoId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = repositories.filter((r) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      r.name.toLowerCase().includes(query) ||
      r.githubOrg.toLowerCase().includes(query)
    );
  });

  const handleConfirm = (): void => {
    if (selectedId) {
      onSelectRepo(selectedId);
      onClose();
    }
  };

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
      data-testid="repo-select-modal"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '3px',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 16px -4px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
          maxWidth: '640px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Select Repository for Analysis
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Choose a repository from your connected providers to view system architecture and evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Search & Refresh Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            gap: '0.75rem',
          }}
        >
          <input
            type="text"
            className="select-input"
            style={{ flex: 1, padding: '0.55rem 0.9rem', fontSize: '0.95rem' }}
            placeholder="Search by repository name or owner/org..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="secondary-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ padding: '0.55rem 1rem', fontSize: '0.875rem' }}
          >
            {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Repository List */}
        <div
          style={{
            padding: '1rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              {repositories.length === 0 ? (
                <>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    No Repositories Discovered
                  </p>
                  <p style={{ fontSize: '0.9rem' }}>
                    Connect GitHub in your account or click Refresh above to fetch repositories.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '0.95rem' }}>
                  No repositories match &ldquo;{searchQuery}&rdquo;. Try another search term.
                </p>
              )}
            </div>
          ) : (
            filtered.map((repo) => {
              const isSelected = repo.id === selectedId;
              const isCurrent = repo.id === currentRepoId;
              return (
                <div
                  key={repo.id}
                  onClick={() => setSelectedId(repo.id)}
                  style={{
                    padding: '0.9rem 1.1rem',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                    backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? '0 0 0 1px var(--accent-blue)' : 'var(--shadow-sm)',
                  }}
                  data-testid={`repo-option-${repo.id}`}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {repo.githubOrg} / {repo.name}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      <span>Branch: <strong>{repo.defaultBranch || 'main'}</strong></span>
                      <span>•</span>
                      <span>Updated: {new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-muted)'}`,
                        backgroundColor: isSelected ? 'var(--accent-blue)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {repositories.length} total repositories accessible
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn"
              data-testid="confirm-select-repo-btn"
              onClick={handleConfirm}
              disabled={!selectedId}
            >
              Select Repository
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
