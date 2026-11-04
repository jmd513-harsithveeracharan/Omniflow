import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PlaygroundHome } from './components/PlaygroundHome';
import { ChatTimeline } from './components/ChatTimeline';
import { PromptDock } from './components/PromptDock';
import { CredentialInterceptionCard } from './components/chat/CredentialInterceptionCard';
import { MedallionFlowCanvas } from './components/MedallionFlowCanvas';
import { SkillInspectorModal } from './components/SkillInspectorModal';
import { ConnectorModal } from './components/ConnectorModal';
import { GovernanceModal } from './components/GovernanceModal';
import { SettingsModal } from './components/SettingsModal';
import { FabricConnectionModal } from './components/modals/FabricConnectionModal';
import { ProjectEditModal } from './components/ProjectEditModal';
import { AuthModal } from './components/auth/AuthModal';
import { LoginPage } from './components/auth/LoginPage';
import { useVoiceMode } from './components/voice/useVoiceMode';
import { SkillsView } from './components/SkillsView';
import { ProjectsView } from './components/ProjectsView';
import { WorkspaceExplorerView } from './components/WorkspaceExplorerView';
import { IngestionStudioView } from './components/IngestionStudioView';
import { GraphMeshView } from './components/graph/GraphMeshView';
import { ProjectWorkspaceHub } from './components/project/ProjectWorkspaceHub';
import {
  fetchFabricStatus,
  streamChatTurn,
  fetchSessions,
  fetchSessionDetail,
  deleteSession,
  renameSession,
  moveSessionToProject,
  fetchProjects,
  fetchProjectDetail,
  updateProject,
  deleteProject,
  logoutFabric,
} from './services/api';
import { FabricStatus, ChatMessage, IngestionPlan, WorkspaceItem, ChatSession, ProjectRecord, UserProfile, CredentialRequestData } from './types';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<string>(() => {
    try {
      return localStorage.getItem('omniflow_active_view') || 'chat';
    } catch {
      return 'chat';
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false);
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  // SWR Instant Hydration for Sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const cached = localStorage.getItem('omniflow_cached_sessions');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(() => {
    return !localStorage.getItem('omniflow_cached_sessions');
  });
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectSessions, setProjectSessions] = useState<ChatSession[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeCredentialRequest, setActiveCredentialRequest] = useState<CredentialRequestData | null>(null);

  // SWR Instant Hydration for Projects
  const [projects, setProjects] = useState<ProjectRecord[]>(() => {
    try {
      const cached = localStorage.getItem('omniflow_cached_projects');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(() => {
    return !localStorage.getItem('omniflow_cached_projects');
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('omniflow_active_project_id') || null;
    } catch {
      return null;
    }
  });
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  // User Auth & RBAC State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('omniflow_active_user');
      if (saved === 'signed_out') return null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const handleUserChanged = (user: UserProfile | null) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    if (user) {
      localStorage.setItem('omniflow_active_user', JSON.stringify(user));
      loadProjectsList(true, user.email);
      loadSessions(user.email);
      const newSid = generateNewSessionId();
      setSessionId(newSid);
      setMessages([]);
    } else {
      localStorage.setItem('omniflow_active_user', 'signed_out');
      setProjects([]);
      setSessions([]);
      setMessages([]);
      setActiveProjectId(null);
    }
  };

  const handleSignOut = async () => {
    handleUserChanged(null);
    setIsAuthModalOpen(false);
    try {
      await logoutFabric();
      fetchFabricStatus().then(setStatus).catch(() => {});
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  // Modals
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState<boolean>(false);
  const [inspectedSkillName, setInspectedSkillName] = useState<string>('using_fabric_skills');
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState<boolean>(false);
  const [isGovernanceModalOpen, setIsGovernanceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFabricConnectionModalOpen, setIsFabricConnectionModalOpen] = useState<boolean>(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<IngestionPlan | null>(null);

  const generateNewSessionId = () => 'sess_' + Math.random().toString(36).substring(2, 11);

  const loadSessions = async (emailOverride?: string) => {
    try {
      const email = emailOverride !== undefined ? emailOverride : currentUser?.email;
      const sessList = await fetchSessions(email);
      setSessions(sessList);
      try {
        localStorage.setItem('omniflow_cached_sessions', JSON.stringify(sessList));
      } catch {}
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadProjectsList = async (shouldAutoSelect: boolean = false, emailOverride?: string) => {
    try {
      const email = emailOverride !== undefined ? emailOverride : currentUser?.email;
      const projs = await fetchProjects(email);
      setProjects(projs || []);
      try {
        localStorage.setItem('omniflow_cached_projects', JSON.stringify(projs || []));
      } catch {}
      if (projs && projs.length > 0) {
        if (shouldAutoSelect && !activeProjectId) {
          const defaultProj = projs[0];
          handleSelectProject(defaultProj.id, false);
        }
      } else {
        setActiveProjectId(null);
      }
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchFabricStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

    const activeEmail = currentUser?.email;
    loadSessions(activeEmail);

    const savedProjId = localStorage.getItem('omniflow_active_project_id');
    const savedSid = localStorage.getItem('omniflow_active_session_id');

    if (savedProjId) {
      loadProjectsList(false, activeEmail).then(() => {
        handleSelectProject(savedProjId, false);
      });
    } else if (savedSid && !savedSid.startsWith('proj_')) {
      loadProjectsList(false, activeEmail);
      let cachedSessionsList: ChatSession[] = [];
      try {
        const raw = localStorage.getItem('omniflow_cached_sessions');
        if (raw) cachedSessionsList = JSON.parse(raw);
      } catch {}
      const found = cachedSessionsList.find((s) => s.sessionId === savedSid);
      if (!found || found.messageCount === 0) {
        setActiveProjectId(null);
        setCurrentPlan(null);
        setActiveView('chat');
        setSessionId(savedSid);
        setMessages([]);
        setIsLoadingSession(false);
      } else {
        handleSelectSession(savedSid);
      }
    } else {
      loadProjectsList(true, activeEmail);
      const initialSid = generateNewSessionId();
      setSessionId(initialSid);
      setMessages([]);
    }
  }, [currentUser?.email]);

  const handleNewSession = () => {
    if (isStreaming) return;
    setActiveProjectId(null);
    setCurrentPlan(null);
    const newSid = generateNewSessionId();
    setSessionId(newSid);
    setMessages([]);
    setActiveView('chat');
    try {
      localStorage.removeItem('omniflow_active_project_id');
      localStorage.setItem('omniflow_active_session_id', newSid);
      localStorage.setItem('omniflow_active_view', 'chat');
    } catch {}
  };

  const handleSelectSession = async (sid: string) => {
    if (isStreaming) return;
    if (sid === sessionId && messages.length > 0) return;
    const isProjSession = sid.startsWith('proj_');
    const knownSession = sessions.find((s) => s.sessionId === sid) || projectSessions.find((s) => s.sessionId === sid);
    if (knownSession && knownSession.messageCount === 0) {
      if (!isProjSession) {
        setActiveProjectId(null);
        try { localStorage.removeItem('omniflow_active_project_id'); } catch {}
      }
      setCurrentPlan(null);
      setActiveView('chat');
      setSessionId(sid);
      setMessages([]);
      setIsLoadingSession(false);
      try {
        localStorage.setItem('omniflow_active_session_id', sid);
        localStorage.setItem('omniflow_active_view', 'chat');
      } catch {}
      return;
    }
    try {
      setIsLoadingSession(true);
      if (!isProjSession) {
        setActiveProjectId(null);
        try { localStorage.removeItem('omniflow_active_project_id'); } catch {}
      }
      setCurrentPlan(null);
      setActiveView('chat');
      setSessionId(sid);
      try {
        localStorage.setItem('omniflow_active_session_id', sid);
        localStorage.setItem('omniflow_active_view', 'chat');
      } catch {}
      const detail = await fetchSessionDetail(sid);
      if (detail && Array.isArray(detail.messages)) {
        setMessages(
          detail.messages.map((m) => ({
            role: m.role,
            content: m.content,
            thoughtSteps: m.thoughtSteps,
            thoughtElapsed: m.thoughtElapsed,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load session detail', e);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      await deleteSession(sid);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sid));
      if (sessionId === sid) {
        handleNewSession();
      }
    } catch (e) {
      console.error('Failed to delete session', e);
    }
  };

  const handleRenameSession = async (sid: string, newTitle: string) => {
    try {
      await renameSession(sid, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sid ? { ...s, title: newTitle } : s))
      );
    } catch (e) {
      console.error('Failed to rename session', e);
    }
  };

  const handleMoveSessionToProject = async (sid: string, projId: string) => {
    try {
      await moveSessionToProject(sid, projId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sid));
      handleSelectProject(projId);
    } catch (e) {
      console.error('Failed to move session to project', e);
    }
  };

  // Projects Handlers
  const handleSelectProject = async (projectId: string, shouldSwitchToView: boolean = true) => {
    setActiveProjectId(projectId);
    try {
      localStorage.setItem('omniflow_active_project_id', projectId);
    } catch {}

    // Load sessions belonging to this project
    try {
      const pSessions = await fetchSessions(currentUser?.email, projectId);
      setProjectSessions(pSessions);
    } catch (e) {
      console.warn('Failed to fetch project sessions', e);
    }

    if (shouldSwitchToView) {
      setActiveView('project');
      try { localStorage.setItem('omniflow_active_view', 'project'); } catch {}
    }

    try {
      const detail = await fetchProjectDetail(projectId);
      if (detail) {
        setCurrentPlan(detail.plan || null);
        if (detail.messages && detail.messages.length > 0) {
          setMessages(
            detail.messages.map((m) => ({
              role: m.role,
              content: m.content,
              thoughtSteps: m.thoughtSteps,
              thoughtElapsed: m.thoughtElapsed,
            }))
          );
        } else {
          const projName = detail.project?.name || projectId;
          const projDesc = detail.project?.description || 'Active Enterprise Medallion Workspace';
          setMessages([
            {
              role: 'assistant',
              content: `### 📁 Project: ${projName}\n\n**Status**: \`Active\` • **ID**: \`${projectId}\`\n\n${projDesc}\n\n---\n\n*Medallion schemas, PySpark notebooks, and pipeline DAGs are active for this workspace.*`,
            },
          ]);
        }
        setSessionId(`proj_${projectId}`);
      }
    } catch (e) {
      console.error('Failed to load project detail', e);
    }
  };

  const handleTogglePinProject = async (projectId: string, currentPinned: number) => {
    const nextPinned = currentPinned ? 0 : 1;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, is_pinned: nextPinned } : p))
    );
    try {
      await updateProject(projectId, { is_pinned: nextPinned });
    } catch (e) {
      console.error('Failed to pin project', e);
      loadProjectsList();
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, is_archived: 1 } : p))
    );
    try {
      await updateProject(projectId, { is_archived: 1 });
    } catch (e) {
      console.error('Failed to archive project', e);
      loadProjectsList();
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    const projName = target ? target.name : projectId;
    if (window.confirm(`Delete project "${projName}"?`)) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      try {
        await deleteProject(projectId);
      } catch (e) {
        console.error('Failed to delete project', e);
        loadProjectsList();
      }
    }
  };

  const handleEditProject = (project: ProjectRecord) => {
    setEditingProject(project);
  };

  const handleSaveEditedProject = async (
    projectId: string,
    updates: { name: string; description: string; local_path?: string }
  ) => {
    await updateProject(projectId, updates);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              name: updates.name,
              description: updates.description,
              local_path: updates.local_path,
              updated_at: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const startVoiceResponseRef = React.useRef<(() => void) | null>(null);
  const feedStreamingChunkRef = React.useRef<((chunk: string) => void) | null>(null);
  const finishStreamingRef = React.useRef<(() => void) | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleInterruptStreaming = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        if (!last.content.trim()) {
          return prev.slice(0, -1);
        } else {
          return [...prev.slice(0, -1), { ...last, isStreaming: false }];
        }
      }
      return prev;
    });
  }, []);

  const handleSendMessage = async (
    text: string,
    model?: string,
    effort?: string,
    mode?: 'auto' | 'general' | 'project'
  ) => {
    if (!text.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (activeView !== 'chat') {
      setActiveView('chat');
    }

    if (isVoiceModeActive && startVoiceResponseRef.current) {
      startVoiceResponseRef.current();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    const userMsg: ChatMessage = { role: 'user', content: text };
    const placeholderAssistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      isStreaming: true,
      thoughtSteps: [],
      thoughtElapsed: '0.0',
    };
    setMessages((prev) => {
      const filtered = prev.filter(
        (m, i) => !(m.role === 'assistant' && !m.content.trim() && i === prev.length - 1)
      );
      return [...filtered, userMsg, placeholderAssistantMsg];
    });
    setIsStreaming(true);

    let assistantContent = '';

    await streamChatTurn(
      text,
      sessionId,
      (chunk) => {
        if (controller.signal.aborted) return;
        assistantContent += chunk;
        if (isVoiceModeActive && feedStreamingChunkRef.current) {
          feedStreamingChunkRef.current(chunk);
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent, isStreaming: true }];
          }
          return prev;
        });
      },
      (plan) => {
        if (controller.signal.aborted) return;
        setIsStreaming(false);
        if (isVoiceModeActive && finishStreamingRef.current) {
          finishStreamingRef.current();
        }
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            const closedSteps = (last.thoughtSteps || []).map((s) =>
              s.status === 'in_progress' ? { ...s, status: 'completed' as const } : s
            );
            return [...prev.slice(0, -1), { ...last, isStreaming: false, thoughtElapsed: elapsedSec, thoughtSteps: closedSteps }];
          }
          return prev;
        });
        if (plan) {
          setCurrentPlan(plan as unknown as IngestionPlan);
        }
        loadSessions();
      },
      (err) => {
        if (controller.signal.aborted || err.includes('aborted') || err.includes('AbortError')) {
          setIsStreaming(false);
          return;
        }
        console.error('Stream error:', err);
        if (isVoiceModeActive && finishStreamingRef.current) {
          finishStreamingRef.current();
        }
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const errMsg = `⚠️ Error communicating with agent: ${err}`;
          if (last && last.role === 'assistant') {
            const closedSteps = (last.thoughtSteps || []).map((s) =>
              s.status === 'in_progress' ? { ...s, status: 'failed' as const } : s
            );
            return [...prev.slice(0, -1), { ...last, content: errMsg, isStreaming: false, thoughtElapsed: elapsedSec, thoughtSteps: closedSteps }];
          }
          return [...prev, { role: 'assistant', content: errMsg }];
        });
        setIsStreaming(false);
      },
      model,
      effort,
      (stage) => {
        if (controller.signal.aborted) return;
        console.log('[STAGE]', stage);
      },
      (thoughtStep) => {
        if (controller.signal.aborted) return;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            const existing = last.thoughtSteps || [];
            const idx = existing.findIndex(
              (s) =>
                (thoughtStep.target && s.target === thoughtStep.target) ||
                s.title === thoughtStep.title
            );
            let updated: typeof existing;
            if (idx >= 0) {
              updated = [...existing];
              updated[idx] = { ...updated[idx], ...thoughtStep };
            } else {
              const closedPrev = existing.map((s) =>
                s.status === 'in_progress' ? { ...s, status: 'completed' as const } : s
              );
              updated = [...closedPrev, thoughtStep];
            }
            return [...prev.slice(0, -1), { ...last, thoughtSteps: updated }];
          }
          return prev;
        });
      },
      mode,
      isVoiceModeActive,
      controller.signal,
      currentUser?.email,
      (credData) => {
        if (!controller.signal.aborted) {
          setActiveCredentialRequest(credData);
        }
      }
    );
  };

  const handleResumeFromCredentialInterception = (
    connectionId: string,
    selectedTables: string[],
    pathway?: string
  ) => {
    setActiveCredentialRequest(null);
    const pathwayTag = pathway === 'pyspark_notebook' ? ' via PySpark Notebook Ingestion' : '';
    const resumePrompt = `Resume pipeline synthesis with connectionId '${connectionId}'${pathwayTag} for selected tables: ${selectedTables.join(', ')}`;
    handleSendMessage(resumePrompt);
  };

  // ChatGPT-Style Hands-Free Voice Mode Hook
  const {
    voiceState,
    voiceTranscript,
    isMuted: isVoiceMuted,
    audioMode: voiceAudioMode,
    toggleMute: toggleVoiceMute,
    toggleAudioMode: toggleVoiceAudioMode,
    interrupt: interruptVoice,
    commitTurn,
    startVoiceResponse,
    feedStreamingChunk,
    finishStreaming,
  } = useVoiceMode({
    isActive: isVoiceModeActive,
    onSendMessage: (txt) => handleSendMessage(txt, undefined, 'low', 'general'),
    onInterruptStreaming: handleInterruptStreaming,
    isStreaming,
  });

  startVoiceResponseRef.current = startVoiceResponse;
  feedStreamingChunkRef.current = feedStreamingChunk;
  finishStreamingRef.current = finishStreaming;

  const handleSelectView = (view: string) => {
    if (view === 'settings') {
      setIsSettingsModalOpen(true);
    } else {
      setActiveView(view);
      try {
        localStorage.setItem('omniflow_active_view', view);
      } catch {}
    }
  };

  const handlePlanGenerated = (plan: IngestionPlan) => {
    setCurrentPlan(plan);
    setActiveView('chat');
    const msg = `Generated Medallion Ingestion Plan for source: **${plan.sourceName}** (${plan.schedule}). Target Lakehouses: \`lh_enterprise_bronze\`, \`lh_enterprise_silver\`, \`lh_enterprise_gold\`.`;
    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  };

  const handleInspectSkill = (skillName: string) => {
    setInspectedSkillName(skillName);
    setIsSkillsModalOpen(true);
  };

  const handleInspectWorkspaceItem = (_item: WorkspaceItem) => {
    setActiveView('chat');
  };

  const handleDeleteWorkspaceItem = (_item: WorkspaceItem) => {
    setIsGovernanceModalOpen(true);
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'mesh':
        return 'Relationship Graph';
      case 'projects':
        return 'Projects';
      case 'project': {
        const currentProj = projects.find((p) => p.id === activeProjectId);
        return currentProj ? currentProj.name : 'Project Workspace';
      }
      case 'skills':
        return 'Skills & Grounding Engine';
      case 'workspaces':
        return 'Workspace Explorer';
      case 'apps':
        return 'Apps & Ingestion Studio';
      default: {
        if (activeProjectId) {
          const currentProj = projects.find((p) => p.id === activeProjectId);
          return currentProj ? currentProj.name : 'Project';
        }
        if (sessionId) {
          const currentSess = sessions.find((s) => s.sessionId === sessionId);
          if (
            currentSess?.title &&
            currentSess.title !== 'Medallion Architecture Session' &&
            currentSess.title !== 'Architect Orders Medallion Flow' &&
            currentSess.title !== 'New Conversation'
          ) {
            return currentSess.title;
          }
        }
        return 'New Chat';
      }
    }
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleUserChanged} />;
  }

  return (
    <div className="studio-app-container">
      {/* 1. Left Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onNewChat={handleNewSession}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        sessions={sessions}
        activeSessionId={sessionId}
        isLoadingSessions={isLoadingSessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onMoveSessionToProject={handleMoveSessionToProject}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        activeProjectId={activeProjectId}
        onSelectProject={(pId) => {
          if (activeView === 'mesh') {
            handleSelectProject(pId, false);
          } else {
            handleSelectProject(pId, true);
          }
        }}
        onTogglePinProject={handleTogglePinProject}
        onEditProject={handleEditProject}
        onArchiveProject={handleArchiveProject}
        onDeleteProject={handleDeleteProject}
        onRefreshStatus={() => fetchFabricStatus().then(setStatus)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* 2. Main Studio Canvas */}
      <main className={`studio-main ${activeView === 'project' ? '!bg-[#1e1e1e]' : ''}`} id="mainCanvas">
        {activeView !== 'project' && (
          <TopBar
            viewTitle={getViewTitle()}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isWorkbenchOpen={isWorkbenchOpen}
            onToggleWorkbench={() => setIsWorkbenchOpen(!isWorkbenchOpen)}
            onNewSession={handleNewSession}
            onRefreshWorkspace={() => fetchFabricStatus().then(setStatus)}
            status={status}
            onOpenFabricConnection={() => setIsFabricConnectionModalOpen(true)}
            onOpenVoiceMode={() => setIsVoiceModeActive((prev) => !prev)}
          />
        )}

        {/* View Routing */}
        {activeView === 'projects' && (
          <ProjectsView
            onOpenProject={(id) => {
              handleSelectProject(id);
            }}
            onNewChatWithContext={(_name) => {
              setActiveView('chat');
              handleNewSession();
            }}
            onProjectsChanged={() => loadProjectsList(false)}
            currentUser={currentUser}
            projects={projects}
            isLoading={isLoadingProjects}
          />
        )}

        {activeView === 'project' && activeProjectId && (
          <ProjectWorkspaceHub
            project={
              projects.find((p) => p.id === activeProjectId) || {
                id: activeProjectId,
                name: activeProjectId,
                description: 'Active Enterprise Medallion Workspace',
                metadata: {},
              }
            }
            sessions={projectSessions}
            activeSessionId={sessionId}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onSelectSession={(sid) => {
              handleSelectSession(sid);
            }}
            onStartNewChat={(prompt, model) => {
              const newSid = `proj_${activeProjectId}_${Math.random().toString(36).substring(2, 9)}`;
              setSessionId(newSid);
              setMessages([]);
              setActiveView('chat');
              try {
                localStorage.setItem('omniflow_active_session_id', newSid);
                localStorage.setItem('omniflow_active_view', 'chat');
              } catch {}
              handleSendMessage(prompt, model, undefined, 'project');
            }}
            onOpenRelationshipGraph={(pId) => {
              setActiveProjectId(pId);
              setActiveView('mesh');
              try {
                localStorage.setItem('omniflow_active_view', 'mesh');
              } catch {}
            }}
            onBackToProjects={() => {
              setActiveView('projects');
              try {
                localStorage.setItem('omniflow_active_view', 'projects');
              } catch {}
            }}
            onUpdateProject={async (updated) => {
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              await updateProject(updated.id, {
                name: updated.name,
                description: updated.description,
                metadata: updated.metadata,
              });
            }}
            onTogglePin={() => {
              const p = projects.find((x) => x.id === activeProjectId);
              if (p) handleTogglePinProject(p.id, p.is_pinned || 0);
            }}
            onEditProject={handleEditProject}
            onDeleteSession={async (sid) => {
              await handleDeleteSession(sid);
              setProjectSessions((prev) => prev.filter((s) => s.sessionId !== sid));
            }}
          />
        )}

        {activeView === 'skills' && (
          <SkillsView
            onSelectSkillPrompt={handleSendMessage}
            onInspectSkill={handleInspectSkill}
          />
        )}

        {activeView === 'workspaces' && (
          <WorkspaceExplorerView
            workspaceName={status?.workspaceId || 'PBT_DATA_AGENT'}
            onInspectItem={handleInspectWorkspaceItem}
            onDeleteItem={handleDeleteWorkspaceItem}
          />
        )}

        {activeView === 'apps' && (
          <IngestionStudioView
            onPlanGenerated={handlePlanGenerated}
          />
        )}

        {activeView === 'mesh' && (
          <div className="flex-1 w-full h-full relative overflow-hidden bg-[#090d16]" style={{ height: 'calc(100vh - 56px)' }}>
            <GraphMeshView
              projectId={activeProjectId || (projects.length > 0 ? projects[0].id : 'PRJ-PELI-BIOTHERMAL')}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              onSelectProject={(newPid) => {
                if (newPid && newPid !== 'all') {
                  handleSelectProject(newPid, false);
                }
              }}
            />
          </div>
        )}

        {activeView === 'chat' && (
          <div className={`bolt-workspace-split ${isWorkbenchOpen ? 'split-active' : ''}`}>
            <div
              className={`bolt-chat-pane ${messages.length === 0 && !isVoiceModeActive ? 'is-landing' : 'in-chat'} ${
                isWorkbenchOpen ? 'with-workbench' : 'full-width'
              } ${isVoiceModeActive ? 'voice-active' : ''}`}
            >
              {isLoadingSession ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', minHeight: '320px' }}>
                  <div className="agent-working-spinner" style={{ width: '28px', height: '28px', borderTopColor: '#10b981' }} />
                  <span style={{ fontSize: '13px', color: '#a1a1aa' }}>Loading conversation history...</span>
                </div>
              ) : messages.length === 0 && !isVoiceModeActive ? (
                <PlaygroundHome onSelectPrompt={handleSendMessage} />
              ) : (
                <ChatTimeline
                  messages={messages}
                  isStreaming={isStreaming}
                  sessionId={sessionId}
                  isVoiceModeActive={isVoiceModeActive}
                  liveVoiceTranscript={voiceTranscript}
                  onCommitLiveVoice={commitTurn}
                  onDeployPlan={() => {
                    setIsWorkbenchOpen(true);
                    handleSendMessage('deploy active plan');
                  }}
                  onOpenCanvas={() => setIsWorkbenchOpen(true)}
                  onOpenWorkspace={() => setActiveView('workspaces')}
                  onRetryPrompt={handleSendMessage}
                />
              )}

              {activeCredentialRequest && (
                <CredentialInterceptionCard
                  data={activeCredentialRequest}
                  onConfirmResume={handleResumeFromCredentialInterception}
                  onDismiss={() => setActiveCredentialRequest(null)}
                />
              )}

              <PromptDock
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                activeProjectId={activeProjectId}
                isVoiceModeActive={isVoiceModeActive}
                onToggleVoiceMode={() => setIsVoiceModeActive((prev) => !prev)}
                voiceState={voiceState}
                isVoiceMuted={isVoiceMuted}
                onToggleVoiceMute={toggleVoiceMute}
                onInterruptVoice={interruptVoice}
                onCommitVoice={commitTurn}
                voiceTranscript={voiceTranscript}
                voiceAudioMode={voiceAudioMode}
                onToggleVoiceAudioMode={toggleVoiceAudioMode}
              />
            </div>

            {isWorkbenchOpen && (
              <div className="bolt-workbench-pane">
                <MedallionFlowCanvas
                  plan={currentPlan}
                  onDeploy={() => {
                    handleSendMessage('deploy active plan');
                  }}
                  onClose={() => setIsWorkbenchOpen(false)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Domain Feature Modals */}
      <ProjectEditModal
        isOpen={editingProject !== null}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        onSave={handleSaveEditedProject}
      />

      <SkillInspectorModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        onSelectSkillPrompt={handleSendMessage}
        skillName={inspectedSkillName}
      />

      <ConnectorModal
        isOpen={isConnectorsModalOpen}
        onClose={() => setIsConnectorsModalOpen(false)}
        onPlanGenerated={handlePlanGenerated}
      />

      <GovernanceModal
        isOpen={isGovernanceModalOpen}
        onClose={() => setIsGovernanceModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        status={status}
        onRefreshStatus={() => fetchFabricStatus().then(setStatus)}
      />

      <FabricConnectionModal
        isOpen={isFabricConnectionModalOpen}
        onClose={() => setIsFabricConnectionModalOpen(false)}
        status={status}
        onRefreshStatus={() => fetchFabricStatus().then(setStatus)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={handleUserChanged}
      />
    </div>
  );
};

export default App;
