"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header, type ActiveTab, type AuthUserInfo } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { FeatureExplorerView } from "./components/FeatureExplorerView";
import { ArchitectureExplorerView } from "./components/ArchitectureExplorerView";
import { RepoSelectModal } from "./components/RepoSelectModal";
import { ManageProjectReposModal } from "./components/ManageProjectReposModal";
import { AskRepoDoctorDrawer } from "./components/AskRepoDoctorDrawer";
import { OverviewView } from "./components/OverviewView";
import { VisualArchitectureView } from "./components/VisualArchitectureView";
import { CodeViewerModal } from "./components/CodeViewerModal";
import { FeatureKTModal } from "./components/FeatureKTModal";
import { Button } from "./components/atlassian/Button";
import { Lozenge } from "./components/atlassian/Lozenge";
import { Badge } from "./components/atlassian/Badge";
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
  VisualTopologyNodeDto,
  BusinessFeatureDto,
} from "@repo-doctor/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getCsrfTokenFromCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : "";
}

export default function HomePage(): React.JSX.Element {
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [selectedFeatureForArchitecture, setSelectedFeatureForArchitecture] =
    useState<string | null>(null);

  // OAuth config status and banners
  const [oauthStatus, setOauthStatus] = useState<AuthStatusDto | null>(null);
  const [urlAuthError, setUrlAuthError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configModalProvider, setConfigModalProvider] = useState<
    "github" | "gitlab"
  >("github");

  // Project state
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isAssociatingRepo, setIsAssociatingRepo] = useState<boolean>(false);

  // Multi-repository Project Overview & Architecture State
  const [projectDashboard, setProjectDashboard] =
    useState<ProjectDashboardDto | null>(null);
  const [projectArchitecture, setProjectArchitecture] =
    useState<ProjectArchitectureDto | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState<boolean>(false);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState<boolean>(false);
  const [isSavingProjectRepos, setIsSavingProjectRepos] =
    useState<boolean>(false);
  const [isManageReposModalOpen, setIsManageReposModalOpen] =
    useState<boolean>(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState<boolean>(false);
  const [askInitialQuestion, setAskInitialQuestion] = useState<string>("");
  const [selectedCodeViewerNode, setSelectedCodeViewerNode] =
    useState<VisualTopologyNodeDto | null>(null);
  const [selectedKTFeature, setSelectedKTFeature] =
    useState<BusinessFeatureDto | null>(null);

  // Repository & Graph state
  const [repositories, setRepositories] = useState<readonly RepositoryDto[]>(
    [],
  );
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [dashboard, setDashboard] = useState<RepositoryDashboardDto | null>(
    null,
  );
  const [features, setFeatures] = useState<readonly FeatureItemDto[]>([]);
  const [topology, setTopology] = useState<ArchitectureTopologyDto | null>(
    null,
  );

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get("auth_error");
      if (authErr) {
        setUrlAuthError(authErr);
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
  }, []);

  // Fetch OAuth configuration status from backend
  const fetchOauthStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/config-status`, {
        credentials: "include",
      });
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
        credentials: "include",
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
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        credentials: "include",
      });
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
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          throw new Error("Session expired. Please sign in again.");
        }
        const errorData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          errorData.message || `HTTP ${res.status}: Access Denied`,
        );
      }

      const data = (await res.json()) as RepositoryDto[];
      setRepositories(data);

      // If user had a selected repository that still exists, retain it; otherwise select the first if none selected
      setSelectedRepoId((prev) => {
        if (prev && data.some((r) => r.id === prev)) {
          return prev;
        }
        return data.length > 0 ? data[0].id : "";
      });

      if (data.length === 0) {
        setDashboard(null);
        setFeatures([]);
        setTopology(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect to backend";
      setErrorMessage(msg);
      setRepositories([]);
      setSelectedRepoId("");
    } finally {
      setIsLoading(false);
      setIsRefreshingRepos(false);
    }
  }, []);

  // Fetch details for the selected repository
  const fetchRepoDetails = useCallback(
    async (repoId: string): Promise<void> => {
      if (!repoId) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [dashRes, featRes, topRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/repositories/${repoId}/dashboard`, {
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/repositories/${repoId}/features`, {
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/repositories/${repoId}/topology`, {
            credentials: "include",
          }),
        ]);

        if (
          dashRes.status === 401 ||
          featRes.status === 401 ||
          topRes.status === 401
        ) {
          setUser(null);
          throw new Error("Authentication required.");
        }

        if (
          dashRes.status === 403 ||
          featRes.status === 403 ||
          topRes.status === 403
        ) {
          throw new Error(`403 Forbidden: Not authorized for repository.`);
        }

        if (dashRes.ok)
          setDashboard((await dashRes.json()) as RepositoryDashboardDto);
        if (featRes.ok) setFeatures((await featRes.json()) as FeatureItemDto[]);
        if (topRes.ok)
          setTopology((await topRes.json()) as ArchitectureTopologyDto);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to fetch repository details";
        setErrorMessage(msg);
        setDashboard(null);
        setFeatures([]);
        setTopology(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Fetch project-level dashboard & architecture topology
  const fetchProjectData = useCallback(
    async (projectId: string): Promise<void> => {
      if (!projectId) {
        setProjectDashboard(null);
        setProjectArchitecture(null);
        return;
      }

      setIsProjectLoading(true);
      try {
        const [dashRes, archRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/projects/${projectId}/dashboard`, {
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/projects/${projectId}/architecture`, {
            credentials: "include",
          }),
        ]);

        if (dashRes.ok) {
          setProjectDashboard((await dashRes.json()) as ProjectDashboardDto);
        }
        if (archRes.ok) {
          setProjectArchitecture(
            (await archRes.json()) as ProjectArchitectureDto,
          );
        }
      } catch {
        // Non-blocking for project data
      } finally {
        setIsProjectLoading(false);
      }
    },
    [],
  );

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
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      });
    } finally {
      setUser(null);
      setRepositories([]);
      setSelectedRepoId("");
      setProjects([]);
      setSelectedProjectId("");
      setDashboard(null);
      setFeatures([]);
      setTopology(null);
    }
  };

  // Handle project creation
  const handleCreateProject = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setProjectError("Project name is required");
      return;
    }

    setProjectError(null);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message || "Failed to create project");
      }

      const created = (await res.json()) as ProjectDto;
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setIsCreatingProject(false);
      setNewProjectName("");
      setNewProjectDesc("");
    } catch (err: unknown) {
      setProjectError(
        err instanceof Error ? err.message : "Project creation failed",
      );
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
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": csrfToken },
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

  const handleSaveProjectRepositories = async (
    repoIds: string[],
  ): Promise<void> => {
    if (!selectedProjectId) return;
    setIsSavingProjectRepos(true);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/repositories`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({ repositoryIds: repoIds }),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          data.message || "Failed to update project repositories",
        );
      }

      const updatedProject = (await res.json()) as ProjectDto;
      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
      );
      await fetchProjects();
      await fetchProjectData(selectedProjectId);
      await fetchRepositories();
    } finally {
      setIsSavingProjectRepos(false);
    }
  };

  const handleUnlinkProjectRepository = async (
    repoId: string,
  ): Promise<void> => {
    if (!selectedProjectId) return;
    const csrfToken = getCsrfTokenFromCookie();
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${selectedProjectId}/repositories/${repoId}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      },
    );

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || "Failed to unlink repository");
    }

    await fetchProjects();
    await fetchProjectData(selectedProjectId);
    await fetchRepositories();
  };

  const handleAnalyzeProject =
    async (): Promise<ProjectAnalysisResultDto | null> => {
      if (!selectedProjectId) return null;
      setIsAnalyzingProject(true);
      setErrorMessage(null);
      try {
        const csrfToken = getCsrfTokenFromCookie();
        const res = await fetch(
          `${API_BASE_URL}/api/projects/${selectedProjectId}/analyze`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "X-CSRF-Token": csrfToken,
            },
          },
        );

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          const errText = data.message || `Project analysis failed with HTTP ${res.status}`;
          throw new Error(errText);
        }

        const result = (await res.json()) as ProjectAnalysisResultDto;
        await fetchProjectData(selectedProjectId);
        if (selectedRepoId) {
          await fetchRepoDetails(selectedRepoId);
        }
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Project analysis failed";
        setErrorMessage(msg);
        return null;
      } finally {
        setIsAnalyzingProject(false);
      }
    };

  const handleAskProjectQuestion = async (
    question: string,
  ): Promise<AskRepoDoctorResponseDto> => {
    if (!selectedProjectId) {
      throw new Error(
        "Please select or create a project first to ask RepoDoctor.",
      );
    }
    const csrfToken = getCsrfTokenFromCookie();
    // Only constrain to selectedRepoId if it has indexed components, otherwise search across all project repos
    const repoHasNodes = selectedRepoId && (dashboard?.totalNodes ?? 0) > 0;
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${selectedProjectId}/query`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          question,
          repositoryId: repoHasNodes ? selectedRepoId : undefined,
        }),
      },
    );

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || "Query failed");
    }

    return (await res.json()) as AskRepoDoctorResponseDto;
  };

  const handleAnalyze = async (): Promise<void> => {
    if (!selectedRepoId) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const res = await fetch(
        `${API_BASE_URL}/api/repositories/${selectedRepoId}/analyze`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        },
      );

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          errJson.message || `Analysis failed with HTTP ${res.status}`,
        );
      }

      const updatedDashboard = (await res.json()) as RepositoryDashboardDto;
      setDashboard(updatedDashboard);
      await fetchRepoDetails(selectedRepoId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
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
        const res = await fetch(
          `${API_BASE_URL}/api/projects/${selectedProjectId}/query`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({
              question: questionText,
              nodeId,
              repositoryId: selectedRepoId || undefined,
            }),
          },
        );

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
      throw new Error(
        "Please select a project or repository to ask questions.",
      );
    }

    const res = await fetch(
      `${API_BASE_URL}/api/repositories/${selectedRepoId}/features/${nodeId}/query`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ question: questionText }),
      },
    );

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorData.message || `Failed to query feature: HTTP ${res.status}`,
      );
    }

    return (await res.json()) as FeatureQuestionResponseDto;
  };

  const handleCalculateBlastRadius = async (
    nodeId: string,
    repositoryId?: string,
  ): Promise<BlastRadiusResultDto> => {
    let repoIdToUse = repositoryId || selectedRepoId;
    if (
      !repoIdToUse &&
      selectedProject?.repositories &&
      selectedProject.repositories.length > 0
    ) {
      repoIdToUse = selectedProject.repositories[0].id;
    }
    if (!repoIdToUse) {
      throw new Error("No repository selected for blast radius calculation.");
    }
    const res = await fetch(
      `${API_BASE_URL}/api/repositories/${repoIdToUse}/blast-radius/${nodeId}`,
      {
        credentials: "include",
      },
    );

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorData.message ||
          `Failed to calculate blast radius: HTTP ${res.status}`,
      );
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
        onLogin={() => {
          window.location.href = "/login";
        }}
        onLogout={() => void handleLogout()}
        onNavigateProfile={() => {
          window.location.href = "/profile";
        }}
        onConnectGitHub={handleGitHubAuth}
        onConnectGitLab={handleGitLabAuth}
        activeTab={activeTab}
        onSelectTab={(t) => setActiveTab(t)}
        onOpenAskDrawer={() => {
          setAskInitialQuestion("");
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
        onNavigateFlow={() => setActiveTab("architecture")}
      />

      {/* Actionable OAuth Error Banner */}
      {urlAuthError && (
        <div
          data-testid="oauth-error-banner"
          style={{
            backgroundColor:
              urlAuthError === "access_denied"
                ? "var(--accent-yellow-subtle)"
                : "var(--accent-red-subtle)",
            borderBottom: `1px solid ${urlAuthError === "access_denied" ? "#fde68a" : "#fecaca"}`,
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h4
              style={{
                color:
                  urlAuthError === "access_denied"
                    ? "#92400e"
                    : "var(--accent-red)",
                marginBottom: "0.25rem",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              {urlAuthError === "github_unconfigured" &&
                "GitHub OAuth Credentials Required"}
              {urlAuthError === "gitlab_unconfigured" &&
                "GitLab OAuth Credentials Required"}
              {urlAuthError === "access_denied" &&
                "Authorization Request Cancelled"}
              {urlAuthError === "state_mismatch" && "OAuth State Expired"}
              {urlAuthError === "state_expired" && "OAuth State Expired"}
              {urlAuthError === "missing_code" && "Authorization Code Missing"}
              {(urlAuthError === "oauth_failed" ||
                urlAuthError === "gitlab_oauth_failed") &&
                "Provider Token Exchange Failed"}
              {![
                "github_unconfigured",
                "gitlab_unconfigured",
                "access_denied",
                "state_mismatch",
                "state_expired",
                "missing_code",
                "oauth_failed",
                "gitlab_oauth_failed",
              ].includes(urlAuthError) &&
                `Authentication Alert: ${urlAuthError}`}
            </h4>
            {urlAuthError === "github_unconfigured" ? (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                }}
              >
                GitHub authorization requires <code>GITHUB_APP_CLIENT_ID</code>{" "}
                and <code>GITHUB_APP_CLIENT_SECRET</code> in{" "}
                <code>backend/.env</code> with callback URL:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {oauthStatus?.githubCallbackUrl ||
                    "http://localhost:3001/auth/callback"}
                </strong>
                .
              </p>
            ) : urlAuthError === "gitlab_unconfigured" ? (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                }}
              >
                GitLab authorization requires <code>GITLAB_CLIENT_ID</code> and{" "}
                <code>GITLAB_CLIENT_SECRET</code> in <code>backend/.env</code>{" "}
                with redirect URI:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {oauthStatus?.gitlabCallbackUrl ||
                    "http://localhost:3001/auth/gitlab/callback"}
                </strong>
                .
              </p>
            ) : urlAuthError === "access_denied" ? (
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                }}
              >
                The authorization request was cancelled on the provider portal.
                Your session remains active; you can retry connecting anytime.
              </p>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                The authentication request could not be completed (
                {urlAuthError}). Please retry or verify provider settings.
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {(urlAuthError === "github_unconfigured" ||
              urlAuthError === "gitlab_unconfigured") && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setConfigModalProvider(
                    urlAuthError === "gitlab_unconfigured"
                      ? "gitlab"
                      : "github",
                  );
                  setShowConfigModal(true);
                }}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              >
                Setup Guide
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setUrlAuthError(null)}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
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
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          data-testid="oauth-guide-modal"
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              maxWidth: "560px",
              width: "100%",
              padding: "1.75rem",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {configModalProvider === "github"
                  ? "GitHub OAuth Application Setup"
                  : "GitLab OAuth Application Setup"}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Backend Status:
                </span>
                <span
                  className={
                    (
                      configModalProvider === "github"
                        ? oauthStatus?.githubConfigured
                        : oauthStatus?.gitlabConfigured
                    )
                      ? "badge-success"
                      : "badge-critical"
                  }
                >
                  {(
                    configModalProvider === "github"
                      ? oauthStatus?.githubConfigured
                      : oauthStatus?.gitlabConfigured
                  )
                    ? "Configured & Ready"
                    : "Missing Credentials in backend/.env"}
                </span>
              </div>
            </div>

            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                marginBottom: "0.75rem",
              }}
            >
              Register an OAuth application on{" "}
              {configModalProvider === "github"
                ? "GitHub Developer Settings"
                : "GitLab Applications"}{" "}
              with this exact Authorization Callback URL:
            </p>
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "0.85rem 1rem",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                color: "var(--accent-blue)",
                marginBottom: "1rem",
                border: "1px solid var(--border-default)",
                wordBreak: "break-all",
              }}
            >
              {configModalProvider === "github"
                ? oauthStatus?.githubCallbackUrl ||
                  "http://localhost:3001/auth/callback"
                : oauthStatus?.gitlabCallbackUrl ||
                  "http://localhost:3001/auth/gitlab/callback"}
            </div>

            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                marginBottom: "0.5rem",
              }}
            >
              Then add the credentials to <code>backend/.env</code>:
            </p>
            <div
              style={{
                backgroundColor: "#0f172a",
                padding: "1rem",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                color: "#38bdf8",
                marginBottom: "1.5rem",
                border: "1px solid #1e293b",
              }}
            >
              {configModalProvider === "github" ? (
                <>
                  GITHUB_APP_CLIENT_ID=&lt;paste_client_id_from_github&gt;
                  <br />
                  GITHUB_APP_CLIENT_SECRET=&lt;paste_client_secret_from_github&gt;
                </>
              ) : (
                <>
                  GITLAB_CLIENT_ID=&lt;paste_client_id_from_gitlab&gt;
                  <br />
                  GITLAB_CLIENT_SECRET=&lt;paste_client_secret_from_gitlab&gt;
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void fetchOauthStatus()}
              >
                Re-check Status
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(
                  configModalProvider === "github"
                    ? oauthStatus?.githubConfigured
                    : oauthStatus?.gitlabConfigured
                ) ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setShowConfigModal(false);
                      if (configModalProvider === "github") handleGitHubAuth();
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
          <div
            className="card-section"
            style={{ textAlign: "center", padding: "4rem" }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
              Authenticating secure session...
            </p>
          </div>
        ) : !user ? (
          /* ========================================================================= */
          /* LANDING & DUAL AUTHENTICATION EXPERIENCE (LIGHT THEME)                   */
          /* ========================================================================= */
          <div
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              padding: "2rem 1rem",
            }}
            data-testid="unauthenticated-prompt"
          >
            {/* Value Proposition Hero */}
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <span
                className="brand-badge"
                style={{ marginBottom: "1rem", display: "inline-block" }}
              >
                Principal Software Architecture Intelligence
              </span>
              <h2
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  marginBottom: "0.85rem",
                  letterSpacing: "-0.03em",
                }}
              >
                Understand systems, not repositories.
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "1.15rem",
                  maxWidth: "680px",
                  margin: "0 auto 2rem auto",
                  lineHeight: "1.6",
                }}
              >
                RepoDoctor maps multi-repository topologies, AST dependencies,
                and code evidence. Zero hallucinations, strictly grounded
                citations, and deterministic change impact blast radius.
              </p>
              {/* Primary Call to Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <Link
                  href="/signup"
                  data-testid="hero-signup-btn"
                  className="primary-btn"
                  style={{
                    padding: "0.75rem 1.75rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    backgroundColor: "#0052cc",
                    color: "#ffffff",
                    textDecoration: "none",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  Get started free →
                </Link>
                <Link
                  href="/login"
                  data-testid="hero-login-btn"
                  className="outline-btn"
                  style={{
                    padding: "0.75rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    backgroundColor: "#ffffff",
                    border: "1px solid #dfe1e6",
                    color: "#172b4d",
                  }}
                >
                  Log in
                </Link>
              </div>
            </div>

            {/* Core Capabilities Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.25rem",
                marginBottom: "3rem",
              }}
            >
              <div
                className="card-section"
                style={{ padding: "1.5rem", marginBottom: 0 }}
              >
                <h3
                  style={{
                    color: "var(--accent-blue)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    marginBottom: "0.4rem",
                  }}
                >
                  Deterministic AST Graph
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                  }}
                >
                  Analyzes source files using exact AST parsing. Tracks imports,
                  exports, microservices, databases, and message queues.
                </p>
              </div>

              <div
                className="card-section"
                style={{ padding: "1.5rem", marginBottom: 0 }}
              >
                <h3
                  style={{
                    color: "var(--accent-green)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    marginBottom: "0.4rem",
                  }}
                >
                  Evidence-Grounded Citations
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                  }}
                >
                  Every architectural edge is linked to concrete code evidence
                  with exact line numbers and commit SHAs. No speculative
                  guessing.
                </p>
              </div>

              <div
                className="card-section"
                style={{ padding: "1.5rem", marginBottom: 0 }}
              >
                <h3
                  style={{
                    color: "#d97706",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    marginBottom: "0.4rem",
                  }}
                >
                  Multi-Repository Workspaces
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                  }}
                >
                  Organize microservices into unified workspace projects with
                  comprehensive blast radius calculations across repositories.
                </p>
              </div>
            </div>

            {/* Architecture Preview & Quick Start Card */}
            <div
              className="card-section"
              style={{
                padding: "2.5rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #dfe1e6",
                boxShadow: "var(--shadow-sm)",
              }}
              data-testid="architecture-preview-cta"
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#172b4d",
                  marginBottom: "0.5rem",
                }}
              >
                Ready to map and analyze your architecture?
              </h3>
              <p
                style={{
                  color: "#6b778c",
                  fontSize: "0.95rem",
                  maxWidth: "560px",
                  margin: "0 auto 1.5rem auto",
                  lineHeight: "1.5",
                }}
              >
                Connect your GitHub or GitLab repositories and get deep,
                evidence-grounded topological insights, cross-repo dependency
                graphs, and change impact blast radius in seconds.
              </p>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* AUTHENTICATED USER WORKSPACE & WORKFLOW                                   */
          /* ========================================================================= */
          <>
            {/* First-Time Guided Onboarding (Dismissible) */}
            {showOnboarding &&
              (!user.githubUsername ||
                repositories.length === 0 ||
                !dashboard ||
                dashboard.analysisStatus === "NOT_ANALYZED") && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #dfe1e6",
                    borderRadius: "3px",
                    padding: "16px 20px",
                    marginBottom: "16px",
                    boxShadow: "0 1px 1px rgba(9, 30, 66, 0.15)",
                  }}
                  data-testid="onboarding-guide-banner"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#172b4d",
                          margin: 0,
                        }}
                      >
                        Welcome to RepoDoctor! Follow these steps to get
                        started:
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(false)}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: "14px",
                        color: "#6b778c",
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: "3px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(9, 30, 66, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      aria-label="Dismiss guide"
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {/* Step 1: Connect Provider */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "3px",
                        backgroundColor: user.githubUsername
                          ? "#f3fdf8"
                          : "#fafbfc",
                        border: `1px solid ${user.githubUsername ? "#abf5d1" : "#dfe1e6"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            color: "#172b4d",
                          }}
                        >
                          1. Provider Connected
                        </span>
                        <Lozenge
                          appearance={
                            user.githubUsername ? "success" : "inprogress"
                          }
                        >
                          {user.githubUsername ? "CONNECTED" : "REQUIRED"}
                        </Lozenge>
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b778c",
                          margin: 0,
                        }}
                      >
                        {user.githubUsername
                          ? `@${user.githubUsername}`
                          : "Connect GitHub or GitLab."}
                      </p>
                      {!user.githubUsername && (
                        <Button
                          appearance="default"
                          spacing="compact"
                          onClick={handleGitHubAuth}
                          style={{ marginTop: "4px", alignSelf: "flex-start" }}
                        >
                          Connect GitHub
                        </Button>
                      )}
                    </div>

                    {/* Step 2: Select Repository */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "3px",
                        backgroundColor: selectedRepoId ? "#f3fdf8" : "#fafbfc",
                        border: `1px solid ${selectedRepoId ? "#abf5d1" : "#dfe1e6"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            color: "#172b4d",
                          }}
                        >
                          2. Select Repository
                        </span>
                        <Lozenge
                          appearance={selectedRepoId ? "success" : "default"}
                        >
                          {selectedRepoId ? "SELECTED" : "PENDING"}
                        </Lozenge>
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b778c",
                          margin: 0,
                        }}
                      >
                        {selectedRepo
                          ? `${selectedRepo.name}`
                          : "Choose from your repositories."}
                      </p>
                      {repositories.length > 0 && !selectedRepoId && (
                        <Button
                          appearance="default"
                          spacing="compact"
                          onClick={() => setIsRepoModalOpen(true)}
                          style={{ marginTop: "4px", alignSelf: "flex-start" }}
                        >
                          Select Repository
                        </Button>
                      )}
                    </div>

                    {/* Step 3: Run Analysis */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "3px",
                        backgroundColor:
                          dashboard?.analysisStatus === "READY"
                            ? "#f3fdf8"
                            : "#fafbfc",
                        border: `1px solid ${dashboard?.analysisStatus === "READY" ? "#abf5d1" : "#dfe1e6"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            color: "#172b4d",
                          }}
                        >
                          3. Run Analysis
                        </span>
                        <Lozenge
                          appearance={
                            dashboard?.analysisStatus === "READY"
                              ? "success"
                              : "default"
                          }
                        >
                          {dashboard?.analysisStatus === "READY"
                            ? "COMPLETE"
                            : "PENDING"}
                        </Lozenge>
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b778c",
                          margin: 0,
                        }}
                      >
                        Extract components &amp; verified citations.
                      </p>
                      {selectedRepoId &&
                        dashboard?.analysisStatus === "NOT_ANALYZED" && (
                          <Button
                            appearance="primary"
                            spacing="compact"
                            onClick={() => void handleAnalyze()}
                            disabled={isAnalyzing}
                            style={{
                              marginTop: "4px",
                              alignSelf: "flex-start",
                            }}
                          >
                            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
                          </Button>
                        )}
                    </div>

                    {/* Step 4: Explore Architecture */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "3px",
                        backgroundColor: "#fafbfc",
                        border: "1px solid #dfe1e6",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            color: "#172b4d",
                          }}
                        >
                          4. Explore Architecture
                        </span>
                        <Lozenge appearance="default">READY</Lozenge>
                      </div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b778c",
                          margin: 0,
                        }}
                      >
                        Inspect code citations &amp; blast radius.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Workspace & Project Context Bar */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #dfe1e6",
                borderRadius: "3px",
                padding: "10px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                boxShadow: "0 1px 1px rgba(9, 30, 66, 0.15)",
              }}
              data-testid="project-controls-bar"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <label
                    htmlFor="project-select"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#172b4d",
                    }}
                  >
                    Workspace Project:
                  </label>
                  <select
                    id="project-select"
                    className="select-input"
                    data-testid="project-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    style={{ minWidth: "220px", height: "32px" }}
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

                <Button
                  appearance="default"
                  data-testid="new-project-button"
                  onClick={() => setIsCreatingProject(!isCreatingProject)}
                >
                  {isCreatingProject ? "Cancel" : "+ New Project"}
                </Button>

                {selectedProjectId && (
                  <Button
                    appearance="default"
                    data-testid="manage-project-repos-button"
                    onClick={() => setIsManageReposModalOpen(true)}
                    style={{ columnGap: "4px" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#42526e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Manage Repositories</span>
                    <Badge appearance="default">
                      {selectedProject?.repositoryCount || 0}
                    </Badge>
                  </Button>
                )}

                {selectedProjectId && selectedRepoId && (
                  <Button
                    appearance="default"
                    data-testid="associate-repo-button"
                    onClick={() => void handleAssociateRepo(selectedRepoId)}
                    disabled={isAssociatingRepo}
                    title="Associate the currently selected repository with this project"
                  >
                    {isAssociatingRepo
                      ? "Linking..."
                      : "+ Link Selected Repo to Project"}
                  </Button>
                )}
              </div>

              {/* Quick Status / Change Repository */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {selectedProject && (
                  <span style={{ fontSize: "13px", color: "#6b778c" }}>
                    Project has{" "}
                    <strong style={{ color: "#172b4d" }}>
                      {selectedProject.repositoryCount}
                    </strong>{" "}
                    linked repositories
                  </span>
                )}
                <Button
                  appearance="default"
                  onClick={() => setIsRepoModalOpen(true)}
                  style={{ columnGap: "4px" }}
                >
                  <span>Browse Repositories</span>
                  <Badge appearance="default">{repositories.length}</Badge>
                </Button>
              </div>
            </div>

            {/* Create Project Collapsible Form */}
            {isCreatingProject && (
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #dfe1e6",
                  borderRadius: "3px",
                  padding: "16px 20px",
                  marginBottom: "16px",
                  boxShadow: "0 1px 1px rgba(9, 30, 66, 0.15)",
                }}
                data-testid="create-project-card"
              >
                <form
                  onSubmit={(e) => void handleCreateProject(e)}
                  style={{ maxWidth: "640px" }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#172b4d",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Create Architecture Project
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6b778c",
                      margin: "0 0 12px 0",
                    }}
                  >
                    A project acts as a unified architecture boundary grouping
                    multiple services and repositories together.
                  </p>
                  {projectError && (
                    <div
                      style={{
                        color: "var(--accent-red)",
                        fontSize: "13px",
                        marginBottom: "10px",
                      }}
                    >
                      {projectError}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      className="select-input"
                      data-testid="project-name-input"
                      placeholder="Project Name (e.g. Payments Architecture)"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "220px",
                        height: "32px",
                      }}
                      required
                    />
                    <input
                      type="text"
                      className="select-input"
                      data-testid="project-desc-input"
                      placeholder="Description (optional)"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      style={{
                        flex: 2,
                        minWidth: "220px",
                        height: "32px",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      appearance="primary"
                      type="submit"
                      data-testid="save-project-button"
                    >
                      Save Project
                    </Button>
                    <Button
                      appearance="subtle"
                      onClick={() => setIsCreatingProject(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Primary Tab Views */}
            {activeTab === "dashboard" &&
              (selectedProjectId && projectDashboard ? (
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
                  onSelectRepoForInvestigation={(repoId) =>
                    setSelectedRepoId(repoId)
                  }
                  onOpenFeatureKT={(feat) => setSelectedKTFeature(feat)}
                  onNavigateToFeatureFlow={(featId) => {
                    setSelectedFeatureForArchitecture(featId);
                    setActiveTab("architecture");
                  }}
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
              ))}

            {activeTab === "features" && (
              <FeatureExplorerView
                features={features}
                projectFeatures={projectDashboard?.businessFeatures}
                isLoading={selectedProjectId ? isProjectLoading : isLoading}
                error={errorMessage}
                onAskQuestion={handleAskQuestion}
                onAnalyze={() =>
                  void (selectedProjectId
                    ? handleAnalyzeProject()
                    : handleAnalyze())
                }
                isAnalyzing={
                  selectedProjectId ? isAnalyzingProject : isAnalyzing
                }
                onOpenAskDoctor={(q) => {
                  setAskInitialQuestion(q);
                  setIsAskDrawerOpen(true);
                }}
                onNavigateArchitectureFlow={(featureId) => {
                  setSelectedFeatureForArchitecture(featureId || null);
                  setActiveTab("architecture");
                }}
                onOpenFeatureKT={(feat) => setSelectedKTFeature(feat)}
                onOpenCodeViewer={(node) => setSelectedCodeViewerNode(node)}
              />
            )}

            {activeTab === "architecture" &&
              (selectedProjectId && projectArchitecture ? (
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
                  onOpenCodeViewer={(node) => setSelectedCodeViewerNode(node)}
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
              ))}
          </>
        )}
      </main>

      {/* Code Viewer Modal */}
      <CodeViewerModal
        isOpen={Boolean(selectedCodeViewerNode)}
        onClose={() => setSelectedCodeViewerNode(null)}
        node={selectedCodeViewerNode}
        allNodes={projectArchitecture?.nodes || []}
        allEdges={projectArchitecture?.edges || []}
        onOpenAskDoctor={(q) => {
          setSelectedCodeViewerNode(null);
          setAskInitialQuestion(q);
          setIsAskDrawerOpen(true);
        }}
        onCalculateBlastRadius={handleCalculateBlastRadius}
      />

      {/* Feature KT & Architecture Flow Modal */}
      <FeatureKTModal
        isOpen={Boolean(selectedKTFeature)}
        onClose={() => setSelectedKTFeature(null)}
        feature={selectedKTFeature}
        allNodes={projectArchitecture?.nodes || []}
        allEdges={projectArchitecture?.edges || []}
        onOpenCodeViewer={(node) => {
          setSelectedKTFeature(null);
          setSelectedCodeViewerNode(node);
        }}
        onNavigateToArchitecture={(featureId) => {
          setSelectedKTFeature(null);
          setSelectedFeatureForArchitecture(featureId);
          setActiveTab("architecture");
        }}
        onOpenAskDoctor={(q) => {
          setSelectedKTFeature(null);
          setAskInitialQuestion(q);
          setIsAskDrawerOpen(true);
        }}
      />

      {/* Floating Persistent Ask RepoDoctor Launcher */}
      {user && (
        <button
          type="button"
          data-testid="floating-ask-btn"
          onClick={() => {
            setAskInitialQuestion("");
            setIsAskDrawerOpen(true);
          }}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 900,
            height: "36px",
            padding: "0 16px",
            borderRadius: "18px",
            backgroundColor: "#0052cc",
            color: "#ffffff",
            border: "none",
            boxShadow:
              "0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
            transition: "background-color 0.1s ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#0065ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#0052cc";
          }}
          title="Ask anything about system flows, repositories, or blast radius"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Ask RepoDoctor</span>
        </button>
      )}
    </div>
  );
}
