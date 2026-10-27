'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header, type ActiveTab, type AuthUserInfo } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { FeatureExplorerView } from './components/FeatureExplorerView';
import { ArchitectureExplorerView } from './components/ArchitectureExplorerView';
import { RepoSelectModal } from './components/RepoSelectModal';
import { ManageProjectReposModal } from './components/ManageProjectReposModal';
import { AskRepoDoctorDrawer } from './components/AskRepoDoctorDrawer';
import { OverviewView } from './components/OverviewView';
import { VisualArchitectureView } from './components/VisualArchitectureView';
import type {
  RepositoryDto,
  RepositoryDashboardDto,
  FeatureItemDto,
  FeatureQuestionResponseDto,
  ArchitectureTopologyDto,
  BlastRadiusResultDto,
  ProjectDto,
  AuthStatusDto,
  ProjectDashboardDto,
  ProjectArchitectureDto,
  AskRepoDoctorResponseDto,
  ProjectAnalysisResultDto,
} from '@repo-doctor/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getCsrfTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : '';
}

export default function HomePage(): React.JSX.Element {
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedFeatureForArchitecture, setSelectedFeatureForArchitecture] = useState<string | null>(null);

  // Auth form states
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);

  // OAuth config status and banners
  const [oauthStatus, setOauthStatus] = useState<AuthStatusDto | null>(null);
  const [urlAuthError, setUrlAuthError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configModalProvider, setConfigModalProvider] = useState<'github' | 'gitlab'>('github');

  // Project state
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isAssociatingRepo, setIsAssociatingRepo] = useState<boolean>(false);

  // Multi-repository Project Overview & Architecture State
  const [projectDashboard, setProjectDashboard] = useState<ProjectDashboardDto | null>(null);
  const [projectArchitecture, setProjectArchitecture] = useState<ProjectArchitectureDto | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState<boolean>(false);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState<boolean>(false);
  const [isSavingProjectRepos, setIsSavingProjectRepos] = useState<boolean>(false);
  const [isManageReposModalOpen, setIsManageReposModalOpen] = useState<boolean>(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState<boolean>(false);
  const [askInitialQuestion, setAskInitialQuestion] = useState<string>('');

  // Repository & Graph state
  const [repositories, setRepositories] = useState<readonly RepositoryDto[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [dashboard, setDashboard] = useState<RepositoryDashboardDto | null>(null);
  const [features, setFeatures] = useState<readonly FeatureItemDto[]>([]);
  const [topology, setTopology] = useState<ArchitectureTopologyDto | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Repository selector modal state
  const [isRepoModalOpen, setIsRepoModalOpen] = useState<boolean>(false);
  const [isRefreshingRepos, setIsRefreshingRepos] = useState<boolean>(false);

  // Onboarding banner dismiss state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);

  // Check URL for OAuth return parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get('auth_error');
      if (authErr) {
        setUrlAuthError(authErr);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Fetch OAuth configuration status from backend
  const fetchOauthStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/config-status`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as AuthStatusDto;
        setOauthStatus(data);
      }
    } catch {
      // Ignore background config check failure
    }
  }, []);

  // Check current session
  const checkAuth = useCallback(async (): Promise<AuthUserInfo | null> => {
    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const userData = (await res.json()) as AuthUserInfo;
        setUser(userData);
        return userData;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  // Fetch projects owned by authenticated user
  const fetchProjects = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as ProjectDto[];
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [selectedProjectId]);

  // Fetch repositories accessible to the authenticated user
  const fetchRepositories = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setIsRefreshingRepos(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/repositories`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          throw new Error('Session expired. Please sign in again.');
        }
        const errorData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || `HTTP ${res.status}: Access Denied`);
      }

      const data = (await res.json()) as RepositoryDto[];
      setRepositories(data);

      // If user had a selected repository that still exists, retain it; otherwise select the first if none selected
      setSelectedRepoId((prev) => {
        if (prev && data.some((r) => r.id === prev)) {
          return prev;
        }
        return data.length > 0 ? data[0].id : '';
      });

      if (data.length === 0) {
        setDashboard(null);
        setFeatures([]);
        setTopology(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend';
      setErrorMessage(msg);
      setRepositories([]);
      setSelectedRepoId('');
    } finally {
      setIsLoading(false);
      setIsRefreshingRepos(false);
    }
  }, []);

  // Fetch details for the selected repository
  const fetchRepoDetails = useCallback(async (repoId: string): Promise<void> => {
    if (!repoId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [dashRes, featRes, topRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/repositories/${repoId}/dashboard`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/repositories/${repoId}/features`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/repositories/${repoId}/topology`, { credentials: 'include' }),
      ]);

      if (dashRes.status === 401 || featRes.status === 401 || topRes.status === 401) {
        setUser(null);
        throw new Error('Authentication required.');
      }

      if (dashRes.status === 403 || featRes.status === 403 || topRes.status === 403) {
        throw new Error(`403 Forbidden: Not authorized for repository.`);
      }

      if (dashRes.ok) setDashboard((await dashRes.json()) as RepositoryDashboardDto);
      if (featRes.ok) setFeatures((await featRes.json()) as FeatureItemDto[]);
      if (topRes.ok) setTopology((await topRes.json()) as ArchitectureTopologyDto);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch repository details';
      setErrorMessage(msg);
      setDashboard(null);
      setFeatures([]);
      setTopology(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch project-level dashboard & architecture topology
  const fetchProjectData = useCallback(async (projectId: string): Promise<void> => {
    if (!projectId) {
      setProjectDashboard(null);
      setProjectArchitecture(null);
      return;
    }

    setIsProjectLoading(true);
    try {
      const [dashRes, archRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/projects/${projectId}/dashboard`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/projects/${projectId}/architecture`, { credentials: 'include' }),
      ]);

      if (dashRes.ok) {
        setProjectDashboard((await dashRes.json()) as ProjectDashboardDto);
      }
      if (archRes.ok) {
        setProjectArchitecture((await archRes.json()) as ProjectArchitectureDto);
      }
    } catch {
      // Non-blocking for project data
    } finally {
      setIsProjectLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void (async () => {
      void fetchOauthStatus();
      const authenticatedUser = await checkAuth();
      if (authenticatedUser) {
        void fetchProjects();
        void fetchRepositories();
      }
    })();
  }, [checkAuth, fetchProjects, fetchRepositories, fetchOauthStatus]);

  // Load repository details when selectedRepoId changes
  useEffect(() => {
    if (selectedRepoId && user) {
      void fetchRepoDetails(selectedRepoId);
    }
  }, [selectedRepoId, user, fetchRepoDetails]);

  // Load project-level details when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId && user) {
      void fetchProjectData(selectedProjectId);
    } else {
      setProjectDashboard(null);
      setProjectArchitecture(null);
    }
  }, [selectedProjectId, user, fetchProjectData]);

  // Handle password login
  const handlePasswordLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setAuthFormError(null);

    if (!loginEmail.trim() || !loginPassword) {
      setAuthFormError('Please enter both email and password.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Invalid email or password.');
      }

      const data = (await res.json()) as { user: AuthUserInfo };
      setUser(data.user);
      setLoginEmail('');
      setLoginPassword('');
      void fetchProjects();
      void fetchRepositories();
    } catch (err: unknown) {
      setAuthFormError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle signup
  const handleSignup = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setAuthFormError(null);

    const name = signupName.trim();
    const email = signupEmail.trim();
    const password = signupPassword;
    const confirmPassword = signupConfirmPassword;

    if (!name) {
      setAuthFormError('Please provide your name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setAuthFormError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setAuthFormError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setAuthFormError('Password must contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthFormError('Passwords do not match.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Registration failed. Email may already be in use.');
      }

      const data = (await res.json()) as { user: AuthUserInfo };
      setUser(data.user);
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      void fetchProjects();
      void fetchRepositories();
    } catch (err: unknown) {
      setAuthFormError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle GitHub OAuth initiation
  const handleGitHubAuth = (): void => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

  // Handle GitLab OAuth initiation
  const handleGitLabAuth = (): void => {
    window.location.href = `${API_BASE_URL}/auth/gitlab/login`;
  };

  const handleLogout = async (): Promise<void> => {
    try {
      const csrfToken = getCsrfTokenFromCookie();
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
    } finally {
      setUser(null);
      setRepositories([]);
      setSelectedRepoId('');
      setProjects([]);
      setSelectedProjectId('');
      setDashboard(null);
      setFeatures([]);
      setTopology(null);
    }
  };

  // Handle project creation
  const handleCreateProject = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setProjectError('Project name is required');
      return;
    }

    setProjectError(null);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Failed to create project');
      }

      const created = (await res.json()) as ProjectDto;
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setIsCreatingProject(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (err: unknown) {
      setProjectError(err instanceof Error ? err.message : 'Project creation failed');
    }
  };

  // Handle repository association to selected project
  const handleAssociateRepo = async (repoId: string): Promise<void> => {
    if (!selectedProjectId || !repoId) return;
    setIsAssociatingRepo(true);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/repositories/${repoId}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
        },
      );
      if (res.ok) {
        await fetchProjects();
        await fetchProjectData(selectedProjectId);
      }
    } finally {
      setIsAssociatingRepo(false);
    }
  };

  const handleSaveProjectRepositories = async (repoIds: string[]): Promise<void> => {
    if (!selectedProjectId) return;
    setIsSavingProjectRepos(true);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/repositories`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ repositoryIds: repoIds }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Failed to update project repositories');
      }

      const updatedProject = (await res.json()) as ProjectDto;
      setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
      await fetchProjects();
      await fetchProjectData(selectedProjectId);
      await fetchRepositories();
    } finally {
      setIsSavingProjectRepos(false);
    }
  };

  const handleUnlinkProjectRepository = async (repoId: string): Promise<void> => {
    if (!selectedProjectId) return;
    const csrfToken = getCsrfTokenFromCookie();
    const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/repositories/${repoId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || 'Failed to unlink repository');
    }

    await fetchProjects();
    await fetchProjectData(selectedProjectId);
    await fetchRepositories();
  };

  const handleAnalyzeProject = async (): Promise<ProjectAnalysisResultDto | null> => {
    if (!selectedProjectId) return null;
    setIsAnalyzingProject(true);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Project analysis failed');
      }

      const result = (await res.json()) as ProjectAnalysisResultDto;
      await fetchProjectData(selectedProjectId);
      if (selectedRepoId) {
        await fetchRepoDetails(selectedRepoId);
      }
      return result;
    } finally {
      setIsAnalyzingProject(false);
    }
  };

  const handleAskProjectQuestion = async (question: string): Promise<AskRepoDoctorResponseDto> => {
    if (!selectedProjectId) {
      throw new Error('Please select or create a project first to ask RepoDoctor.');
    }
    const csrfToken = getCsrfTokenFromCookie();
    // Only constrain to selectedRepoId if it has indexed components, otherwise search across all project repos
    const repoHasNodes = selectedRepoId && (dashboard?.totalNodes ?? 0) > 0;
    const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/query`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ question, repositoryId: repoHasNodes ? selectedRepoId : undefined }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || 'Query failed');
    }

    return (await res.json()) as AskRepoDoctorResponseDto;
  };

  const handleAnalyze = async (): Promise<void> => {
    if (!selectedRepoId) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(`${API_BASE_URL}/api/repositories/${selectedRepoId}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errJson.message || `Analysis failed with HTTP ${res.status}`);
      }

      const updatedDashboard = (await res.json()) as RepositoryDashboardDto;
      setDashboard(updatedDashboard);
      await fetchRepoDetails(selectedRepoId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskQuestion = async (
    nodeId: string,
    questionText: string,
  ): Promise<FeatureQuestionResponseDto> => {
    const csrfToken = getCsrfTokenFromCookie();

    if (selectedProjectId) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProjectId}/query`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ question: questionText, nodeId, repositoryId: selectedRepoId || undefined }),
        });

        if (res.ok) {
          const data = (await res.json()) as AskRepoDoctorResponseDto;
          return {
            answer: data.answer,
            confidence: data.confidence,
            isInferred: data.isInferred,
            citations: data.citations,
            relatedNodeIds: data.participatingComponents.map((c) => c.id),
          };
        }
      } catch {
        // Fall back to repository feature query
      }
    }

    if (!selectedRepoId) {
      throw new Error('Please select a project or repository to ask questions.');
    }

    const res = await fetch(
      `${API_BASE_URL}/api/repositories/${selectedRepoId}/features/${nodeId}/query`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ question: questionText }),
      },
    );

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || `Failed to query feature: HTTP ${res.status}`);
    }

    return (await res.json()) as FeatureQuestionResponseDto;
  };

  const handleCalculateBlastRadius = async (nodeId: string, repositoryId?: string): Promise<BlastRadiusResultDto> => {
    let repoIdToUse = repositoryId || selectedRepoId;
    if (!repoIdToUse && selectedProject?.repositories && selectedProject.repositories.length > 0) {
      repoIdToUse = selectedProject.repositories[0].id;
    }
    if (!repoIdToUse) {
      throw new Error('No repository selected for blast radius calculation.');
    }
    const res = await fetch(
      `${API_BASE_URL}/api/repositories/${repoIdToUse}/blast-radius/${nodeId}`,
      {
        credentials: 'include',
      },
    );

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || `Failed to calculate blast radius: HTTP ${res.status}`);
    }

    return (await res.json()) as BlastRadiusResultDto;
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

  return (
    <div className="portal-container" data-testid="repodoctor-portal">
      <Header
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onSelectRepo={(id) => setSelectedRepoId(id)}
        onOpenRepoModal={() => setIsRepoModalOpen(true)}
        selectedProjectName={selectedProject?.name}
        projectRepoCount={selectedProject?.repositoryCount}
        user={user}
        onLogin={handleGitHubAuth}
        onLogout={() => void handleLogout()}
        onNavigateProfile={() => { window.location.href = '/profile'; }}
        onConnectGitHub={handleGitHubAuth}
        onConnectGitLab={handleGitLabAuth}
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        onOpenAskDrawer={() => {
          setAskInitialQuestion('');
          setIsAskDrawerOpen(true);
        }}
        hasProject={Boolean(selectedProjectId)}
      />

      {/* Repository Selection Modal */}
      <RepoSelectModal
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        repositories={repositories}
        currentRepoId={selectedRepoId}
        onSelectRepo={(id) => setSelectedRepoId(id)}
        onRefresh={() => void fetchRepositories()}
        isRefreshing={isRefreshingRepos}
      />

      {/* Multi-Repository Project Management Modal */}
      <ManageProjectReposModal
        isOpen={isManageReposModalOpen}
        onClose={() => setIsManageReposModalOpen(false)}
        project={selectedProject || null}
        allRepositories={repositories}
        onSaveRepositories={handleSaveProjectRepositories}
        onUnlinkRepository={handleUnlinkProjectRepository}
        onAnalyzeProject={handleAnalyzeProject}
        isSaving={isSavingProjectRepos}
      />

      {/* Persistent Ask RepoDoctor Drawer */}
      <AskRepoDoctorDrawer
        isOpen={isAskDrawerOpen}
        onClose={() => setIsAskDrawerOpen(false)}
        projectId={selectedProjectId}
        selectedRepoId={selectedRepoId}
        onQueryProject={handleAskProjectQuestion}
        initialQuestion={askInitialQuestion}
        onNavigateFlow={() => setActiveTab('architecture')}
      />

      {/* Actionable OAuth Error Banner */}
      {urlAuthError && (
        <div
          data-testid="oauth-error-banner"
          style={{
            backgroundColor: urlAuthError === 'access_denied' ? 'var(--accent-yellow-subtle)' : 'var(--accent-red-subtle)',
            borderBottom: `1px solid ${urlAuthError === 'access_denied' ? '#fde68a' : '#fecaca'}`,
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <h4
              style={{
                color: urlAuthError === 'access_denied' ? '#92400e' : 'var(--accent-red)',
                marginBottom: '0.25rem',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              {urlAuthError === 'github_unconfigured' && 'GitHub OAuth Credentials Required'}
              {urlAuthError === 'gitlab_unconfigured' && 'GitLab OAuth Credentials Required'}
              {urlAuthError === 'access_denied' && 'Authorization Request Cancelled'}
              {urlAuthError === 'state_mismatch' && 'OAuth State Expired'}
              {urlAuthError === 'state_expired' && 'OAuth State Expired'}
              {urlAuthError === 'missing_code' && 'Authorization Code Missing'}
              {(urlAuthError === 'oauth_failed' || urlAuthError === 'gitlab_oauth_failed') && 'Provider Token Exchange Failed'}
              {!['github_unconfigured', 'gitlab_unconfigured', 'access_denied', 'state_mismatch', 'state_expired', 'missing_code', 'oauth_failed', 'gitlab_oauth_failed'].includes(urlAuthError) && `Authentication Alert: ${urlAuthError}`}
            </h4>
            {urlAuthError === 'github_unconfigured' ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                GitHub authorization requires <code>GITHUB_APP_CLIENT_ID</code> and <code>GITHUB_APP_CLIENT_SECRET</code> in <code>backend/.env</code> with callback URL:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {oauthStatus?.githubCallbackUrl || 'http://localhost:3001/auth/callback'}
                </strong>.
              </p>
            ) : urlAuthError === 'gitlab_unconfigured' ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                GitLab authorization requires <code>GITLAB_CLIENT_ID</code> and <code>GITLAB_CLIENT_SECRET</code> in <code>backend/.env</code> with redirect URI:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {oauthStatus?.gitlabCallbackUrl || 'http://localhost:3001/auth/gitlab/callback'}
                </strong>.
              </p>
            ) : urlAuthError === 'access_denied' ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                The authorization request was cancelled on the provider portal. Your session remains active; you can retry connecting anytime.
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                The authentication request could not be completed ({urlAuthError}). Please retry or verify provider settings.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {(urlAuthError === 'github_unconfigured' || urlAuthError === 'gitlab_unconfigured') && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setConfigModalProvider(urlAuthError === 'gitlab_unconfigured' ? 'gitlab' : 'github');
                  setShowConfigModal(true);
                }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                Setup Guide
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setUrlAuthError(null)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* OAuth Setup Guide Modal */}
      {showConfigModal && (
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
          data-testid="oauth-guide-modal"
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {configModalProvider === 'github' ? 'GitHub OAuth Application Setup' : 'GitLab OAuth Application Setup'}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Backend Status:</span>
                <span
                  className={
                    (configModalProvider === 'github' ? oauthStatus?.githubConfigured : oauthStatus?.gitlabConfigured)
                      ? 'badge-success'
                      : 'badge-critical'
                  }
                >
                  {(configModalProvider === 'github' ? oauthStatus?.githubConfigured : oauthStatus?.gitlabConfigured)
                    ? 'Configured & Ready'
                    : 'Missing Credentials in backend/.env'}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.75rem' }}>
              Register an OAuth application on {configModalProvider === 'github' ? 'GitHub Developer Settings' : 'GitLab Applications'} with this exact Authorization Callback URL:
            </p>
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: 'var(--accent-blue)',
                marginBottom: '1rem',
                border: '1px solid var(--border-default)',
                wordBreak: 'break-all',
              }}
            >
              {configModalProvider === 'github'
                ? (oauthStatus?.githubCallbackUrl || 'http://localhost:3001/auth/callback')
                : (oauthStatus?.gitlabCallbackUrl || 'http://localhost:3001/auth/gitlab/callback')}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.5rem' }}>
              Then add the credentials to <code>backend/.env</code>:
            </p>
            <div
              style={{
                backgroundColor: '#0f172a',
                padding: '1rem',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: '#38bdf8',
                marginBottom: '1.5rem',
                border: '1px solid #1e293b',
              }}
            >
              {configModalProvider === 'github' ? (
                <>
                  GITHUB_APP_CLIENT_ID=&lt;paste_client_id_from_github&gt;<br />
                  GITHUB_APP_CLIENT_SECRET=&lt;paste_client_secret_from_github&gt;
                </>
              ) : (
                <>
                  GITLAB_CLIENT_ID=&lt;paste_client_id_from_gitlab&gt;<br />
                  GITLAB_CLIENT_SECRET=&lt;paste_client_secret_from_gitlab&gt;
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void fetchOauthStatus()}
              >
                Re-check Status
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(configModalProvider === 'github' ? oauthStatus?.githubConfigured : oauthStatus?.gitlabConfigured) ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setShowConfigModal(false);
                      if (configModalProvider === 'github') handleGitHubAuth();
                      else handleGitLabAuth();
                    }}
                  >
                    Proceed to Authorization
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setShowConfigModal(false)}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App Content */}
      <main className="portal-content" data-testid="portal-content-area">
        {isAuthLoading ? (
          <div className="card-section" style={{ textAlign: 'center', padding: '4rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>Authenticating secure session...</p>
          </div>
        ) : !user ? (
          /* ========================================================================= */
          /* LANDING & DUAL AUTHENTICATION EXPERIENCE (LIGHT THEME)                   */
          /* ========================================================================= */
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }} data-testid="unauthenticated-prompt">
            {/* Value Proposition Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
              <span className="brand-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>
                Principal Software Architecture Intelligence
              </span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem', letterSpacing: '-0.03em' }}>
                Understand systems, not repositories.
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6' }}>
                RepoDoctor maps multi-repository topologies, AST dependencies, and code evidence.
                Zero hallucinations, strictly grounded citations, and deterministic change impact blast radius.
              </p>
            </div>

            {/* Core Capabilities Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
                marginBottom: '3rem',
              }}
            >
              <div className="card-section" style={{ padding: '1.5rem', marginBottom: 0 }}>
                <h3 style={{ color: 'var(--accent-blue)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Deterministic AST Graph
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Analyzes source files using exact AST parsing. Tracks imports, exports, microservices, databases, and message queues.
                </p>
              </div>

              <div className="card-section" style={{ padding: '1.5rem', marginBottom: 0 }}>
                <h3 style={{ color: 'var(--accent-green)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Evidence-Grounded Citations
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Every architectural edge is linked to concrete code evidence with exact line numbers and commit SHAs. No speculative guessing.
                </p>
              </div>

              <div className="card-section" style={{ padding: '1.5rem', marginBottom: 0 }}>
                <h3 style={{ color: '#d97706', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Multi-Repository Workspaces
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Organize microservices into unified workspace projects with comprehensive blast radius calculations across repositories.
                </p>
              </div>
            </div>

            {/* Authentication Card (GitHub OAuth + Local Password) */}
            <div
              className="card-section"
              style={{
                maxWidth: '460px',
                margin: '0 auto',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-md)',
              }}
              data-testid="auth-card"
            >
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  data-testid="auth-tab-login"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    textAlign: 'center',
                    background: 'none',
                    border: 'none',
                    borderBottom: authTab === 'login' ? '2px solid var(--accent-blue)' : 'none',
                    color: authTab === 'login' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    fontWeight: authTab === 'login' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                  onClick={() => { setAuthTab('login'); setAuthFormError(null); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-signup"
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    textAlign: 'center',
                    background: 'none',
                    border: 'none',
                    borderBottom: authTab === 'signup' ? '2px solid var(--accent-blue)' : 'none',
                    color: authTab === 'signup' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    fontWeight: authTab === 'signup' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                  onClick={() => { setAuthTab('signup'); setAuthFormError(null); }}
                >
                  Create Account
                </button>
              </div>

              {authFormError && (
                <div
                  data-testid="auth-form-error"
                  style={{
                    backgroundColor: 'var(--accent-red-subtle)',
                    border: '1px solid #fecaca',
                    color: 'var(--accent-red)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  {authFormError}
                </div>
              )}

              {/* GitHub OAuth Primary Action */}
              <button
                type="button"
                className="primary-btn"
                data-testid="welcome-login-button"
                onClick={handleGitHubAuth}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  marginBottom: '1.25rem',
                  backgroundColor: '#24292f',
                }}
              >
                <span>Continue with GitHub</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-default)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  or with email
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-default)' }} />
              </div>

              {authTab === 'login' ? (
                <form onSubmit={(e) => void handlePasswordLogin(e)} data-testid="login-form">
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      data-testid="login-email-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.6rem 0.85rem' }}
                      placeholder="you@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      data-testid="login-password-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.6rem 0.85rem' }}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="login-submit-button"
                    className="primary-btn"
                    disabled={isAuthSubmitting}
                    style={{ width: '100%', padding: '0.7rem 1rem', fontSize: '0.95rem' }}
                  >
                    {isAuthSubmitting ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => void handleSignup(e)} data-testid="signup-form">
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      data-testid="signup-name-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem' }}
                      placeholder="Ada Lovelace"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      data-testid="signup-email-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem' }}
                      placeholder="ada@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Password (min. 8 characters, letter + number)
                    </label>
                    <input
                      type="password"
                      data-testid="signup-password-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem' }}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      data-testid="signup-confirm-input"
                      className="select-input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem' }}
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="signup-submit-button"
                    className="primary-btn"
                    disabled={isAuthSubmitting}
                    style={{ width: '100%', padding: '0.7rem 1rem', fontSize: '0.95rem' }}
                  >
                    {isAuthSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* AUTHENTICATED USER WORKSPACE & WORKFLOW                                   */
          /* ========================================================================= */
          <>
            {/* First-Time Guided Onboarding (Dismissible) */}
            {showOnboarding && (!user.githubUsername || repositories.length === 0 || !dashboard || dashboard.analysisStatus === 'NOT_ANALYZED') && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
                data-testid="onboarding-guide-banner"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Welcome to RepoDoctor! Follow these steps to get started:
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                    aria-label="Dismiss guide"
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {/* Step 1: Connect Provider */}
                  <div
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: user.githubUsername ? 'var(--accent-green-subtle)' : '#f8fafc',
                      border: `1px solid ${user.githubUsername ? '#bbf7d0' : 'var(--border-default)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: user.githubUsername ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {user.githubUsername ? '✓ 1. Provider Connected' : '1. Connect Provider'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {user.githubUsername ? `@${user.githubUsername}` : 'Connect GitHub or GitLab.'}
                    </p>
                    {!user.githubUsername && (
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={handleGitHubAuth}
                        style={{ marginTop: '0.5rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Connect GitHub
                      </button>
                    )}
                  </div>

                  {/* Step 2: Select Repository */}
                  <div
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: selectedRepoId ? 'var(--accent-green-subtle)' : '#f8fafc',
                      border: `1px solid ${selectedRepoId ? '#bbf7d0' : 'var(--border-default)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedRepoId ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {selectedRepoId ? '✓ 2. Repository Selected' : '2. Select Repository'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {selectedRepo ? `${selectedRepo.name}` : 'Choose from your repositories.'}
                    </p>
                    {repositories.length > 0 && !selectedRepoId && (
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setIsRepoModalOpen(true)}
                        style={{ marginTop: '0.5rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Select Repository
                      </button>
                    )}
                  </div>

                  {/* Step 3: Run Analysis */}
                  <div
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: dashboard?.analysisStatus === 'READY' ? 'var(--accent-green-subtle)' : '#f8fafc',
                      border: `1px solid ${dashboard?.analysisStatus === 'READY' ? '#bbf7d0' : 'var(--border-default)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: dashboard?.analysisStatus === 'READY' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {dashboard?.analysisStatus === 'READY' ? '✓ 3. Analysis Complete' : '3. Run Analysis'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Extract components &amp; verified citations.
                    </p>
                    {selectedRepoId && dashboard?.analysisStatus === 'NOT_ANALYZED' && (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void handleAnalyze()}
                        disabled={isAnalyzing}
                        style={{ marginTop: '0.5rem', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                      </button>
                    )}
                  </div>

                  {/* Step 4: Explore Architecture */}
                  <div
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        4. Explore Architecture
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Inspect code citations &amp; blast radius.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Workspace & Project Context Bar */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: '10px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
              }}
              data-testid="project-controls-bar"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="project-select" className="control-label">
                    Workspace Project:
                  </label>
                  <select
                    id="project-select"
                    className="select-input"
                    data-testid="project-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    style={{ minWidth: '200px' }}
                  >
                    {projects.length === 0 ? (
                      <option value="">No Projects Created</option>
                    ) : (
                      projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.repositoryCount} repos)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="new-project-button"
                  onClick={() => setIsCreatingProject(!isCreatingProject)}
                >
                  {isCreatingProject ? 'Cancel' : '+ New Project'}
                </button>

                {selectedProjectId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="manage-project-repos-button"
                    onClick={() => setIsManageReposModalOpen(true)}
                    style={{ fontWeight: 600, color: 'var(--brand-primary, #2563eb)' }}
                  >
                    ⚙️ Manage Repositories ({selectedProject?.repositoryCount || 0})
                  </button>
                )}

                {selectedProjectId && selectedRepoId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="associate-repo-button"
                    onClick={() => void handleAssociateRepo(selectedRepoId)}
                    disabled={isAssociatingRepo}
                    title="Associate the currently selected repository with this project"
                  >
                    {isAssociatingRepo ? 'Linking...' : '+ Link Selected Repo to Project'}
                  </button>
                )}
              </div>

              {/* Quick Status / Change Repository */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {selectedProject && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Project has <strong>{selectedProject.repositoryCount}</strong> linked repositories
                  </span>
                )}
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsRepoModalOpen(true)}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  Browse Repositories ({repositories.length})
                </button>
              </div>
            </div>

            {/* Create Project Collapsible Form */}
            {isCreatingProject && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-default)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  marginBottom: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
                data-testid="create-project-card"
              >
                <form onSubmit={(e) => void handleCreateProject(e)} style={{ maxWidth: '640px' }}>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Create Architecture Project
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    A project acts as a unified architecture boundary grouping multiple services and repositories together.
                  </p>
                  {projectError && (
                    <div style={{ color: 'var(--accent-red)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      {projectError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="select-input"
                      data-testid="project-name-input"
                      placeholder="Project Name (e.g. Payments Architecture)"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.85rem' }}
                      required
                    />
                    <input
                      type="text"
                      className="select-input"
                      data-testid="project-desc-input"
                      placeholder="Description (optional)"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      style={{ flex: 2, minWidth: '220px', padding: '0.55rem 0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="submit"
                      className="primary-btn"
                      data-testid="save-project-button"
                      style={{ padding: '0.5rem 1.1rem' }}
                    >
                      Save Project
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setIsCreatingProject(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Primary Tab Views */}
            {activeTab === 'dashboard' && (
              selectedProjectId && projectDashboard ? (
                <OverviewView
                  dashboard={projectDashboard}
                  isLoading={isProjectLoading}
                  error={errorMessage}
                  onOpenManageRepos={() => setIsManageReposModalOpen(true)}
                  onAnalyzeProject={() => void handleAnalyzeProject()}
                  isAnalyzingProject={isAnalyzingProject}
                  onAskQuestion={(q) => {
                    setAskInitialQuestion(q);
                    setIsAskDrawerOpen(true);
                  }}
                  onSelectTab={(tab) => setActiveTab(tab)}
                  onUnlinkRepo={handleUnlinkProjectRepository}
                  onSelectRepoForInvestigation={(repoId) => setSelectedRepoId(repoId)}
                />
              ) : (
                <DashboardView
                  dashboard={dashboard}
                  isLoading={isLoading}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={() => void handleAnalyze()}
                  error={errorMessage}
                  repositoriesCount={repositories.length}
                  githubUsername={user?.githubUsername}
                  onConnectGitHub={handleGitHubAuth}
                  onRefreshRepositories={() => void fetchRepositories()}
                  onOpenRepoModal={() => setIsRepoModalOpen(true)}
                />
              )
            )}

            {activeTab === 'features' && (
              <FeatureExplorerView
                features={features}
                projectFeatures={projectDashboard?.businessFeatures}
                isLoading={selectedProjectId ? isProjectLoading : isLoading}
                error={errorMessage}
                onAskQuestion={handleAskQuestion}
                onAnalyze={() => void (selectedProjectId ? handleAnalyzeProject() : handleAnalyze())}
                isAnalyzing={selectedProjectId ? isAnalyzingProject : isAnalyzing}
                onOpenAskDoctor={(q) => {
                  setAskInitialQuestion(q);
                  setIsAskDrawerOpen(true);
                }}
                onNavigateArchitectureFlow={(featureId) => {
                  setSelectedFeatureForArchitecture(featureId || null);
                  setActiveTab('architecture');
                }}
              />
            )}

            {activeTab === 'architecture' && (
              selectedProjectId && projectArchitecture ? (
                <VisualArchitectureView
                  architecture={projectArchitecture}
                  projectFeatures={projectDashboard?.businessFeatures}
                  initialFeatureId={selectedFeatureForArchitecture}
                  isLoading={isProjectLoading}
                  error={errorMessage}
                  onAnalyzeProject={() => void handleAnalyzeProject()}
                  isAnalyzing={isAnalyzingProject}
                  onCalculateBlastRadius={handleCalculateBlastRadius}
                  onOpenAskDoctor={(q) => {
                    setAskInitialQuestion(q);
                    setIsAskDrawerOpen(true);
                  }}
                />
              ) : (
                <ArchitectureExplorerView
                  topology={topology}
                  isLoading={isLoading}
                  error={errorMessage}
                  onCalculateBlastRadius={handleCalculateBlastRadius}
                  onAnalyze={() => void handleAnalyze()}
                  isAnalyzing={isAnalyzing}
                />
              )
            )}
          </>
        )}
      </main>

      {/* Floating Persistent Ask RepoDoctor Launcher */}
      {user && (
        <button
          type="button"
          data-testid="floating-ask-btn"
          onClick={() => {
            setAskInitialQuestion('');
            setIsAskDrawerOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 900,
            padding: '0.75rem 1.35rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--brand-primary, #2563eb)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          title="Ask anything about system flows, repositories, or blast radius"
        >
          <span style={{ fontSize: '1.15rem' }}>💬</span>
          <span>Ask RepoDoctor</span>
        </button>
      )}
    </div>
  );
}
