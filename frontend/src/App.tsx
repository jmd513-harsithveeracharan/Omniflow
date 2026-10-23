import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PlaygroundHome } from './components/PlaygroundHome';
import { ChatTimeline } from './components/ChatTimeline';
import { PromptDock } from './components/PromptDock';
import { MedallionFlowCanvas } from './components/MedallionFlowCanvas';
import { SkillInspectorModal } from './components/SkillInspectorModal';
import { ConnectorModal } from './components/ConnectorModal';
import { GovernanceModal } from './components/GovernanceModal';
import { SettingsModal } from './components/SettingsModal';
import { FabricConnectionModal } from './components/modals/FabricConnectionModal';
import { ProjectEditModal } from './components/ProjectEditModal';
import { SkillsView } from './components/SkillsView';
import { ProjectsView } from './components/ProjectsView';
import { WorkspaceExplorerView } from './components/WorkspaceExplorerView';
import { IngestionStudioView } from './components/IngestionStudioView';
import {
  fetchFabricStatus,
  streamChatTurn,
  fetchSessions,
  fetchSessionDetail,
  deleteSession,
  renameSession,
  fetchProjects,
  fetchProjectDetail,
  updateProject,
  deleteProject,
} from './services/api';
import { FabricStatus, ChatMessage, IngestionPlan, WorkspaceItem, ChatSession, ProjectRecord } from './types';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<string>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false);
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Projects State
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  // Modals
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState<boolean>(false);
  const [inspectedSkillName, setInspectedSkillName] = useState<string>('using_fabric_skills');
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState<boolean>(false);
  const [isGovernanceModalOpen, setIsGovernanceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFabricConnectionModalOpen, setIsFabricConnectionModalOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<IngestionPlan | null>(null);

  const generateNewSessionId = () => 'sess_' + Math.random().toString(36).substring(2, 11);

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessList = await fetchSessions();
      setSessions(sessList);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadProjectsList = async () => {
    try {
      setIsLoadingProjects(true);
      const projs = await fetchProjects();
      if (projs && projs.length > 0) {
        setProjects(projs);
        const defaultProj = projs.find((p) => p.name.toLowerCase().includes('delivery')) || projs[0];
        handleSelectProject(defaultProj.id);
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

    loadSessions();
    loadProjectsList();

    const initialSid = generateNewSessionId();
    setSessionId(initialSid);
    setMessages([]);
  }, []);

  const handleNewSession = () => {
    if (isStreaming) return;
    const newSid = generateNewSessionId();
    setSessionId(newSid);
    setMessages([]);
    setActiveView('chat');
  };

  const handleSelectSession = async (sid: string) => {
    if (isStreaming) return;
    if (sid === sessionId && messages.length > 0) return;
    try {
      setIsLoadingSession(true);
      setActiveView('chat');
      setSessionId(sid);
      const detail = await fetchSessionDetail(sid);
      if (detail && Array.isArray(detail.messages)) {
        setMessages(
          detail.messages.map((m) => ({
            role: m.role,
            content: m.content,
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

  // Projects Handlers
  const handleSelectProject = async (projectId: string) => {
    setActiveProjectId(projectId);
    if (projectId === 'playground') {
      setCurrentPlan(null);
      setActiveView('chat');
      setSessionId('sess_playground');
      setMessages([
        {
          role: 'assistant',
          content: '### 🚀 OmniFlow Playground Active\n\nThis is your scratchpad for rapid experimentation. You can attach an intake spec using the **Intake Spec** button or type any natural language data engineering prompt below.',
        },
      ]);
      return;
    }

    try {
      setIsLoadingSession(true);
      setActiveView('chat');
      const detail = await fetchProjectDetail(projectId);
      if (detail) {
        if (detail.plan) {
          setCurrentPlan(detail.plan);
          setIsWorkbenchOpen(true);
        }
        if (detail.messages && detail.messages.length > 0) {
          setMessages(detail.messages.map((m) => ({ role: m.role, content: m.content })));
        } else {
          setMessages([]);
        }
        setSessionId(`proj_${projectId}`);
      }
    } catch (e) {
      console.error('Failed to load project detail', e);
      setActiveView('chat');
    } finally {
      setIsLoadingSession(false);
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
    updates: { name: string; description: string }
  ) => {
    await updateProject(projectId, updates);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, name: updates.name, description: updates.description, updated_at: new Date().toISOString() }
          : p
      )
    );
  };

  const handleSendMessage = async (
    text: string,
    model?: string,
    effort?: string,
    mode?: 'auto' | 'general' | 'project'
  ) => {
    if (!text.trim() || isStreaming) return;

    if (activeView !== 'chat') {
      setActiveView('chat');
    }

    const userMsg: ChatMessage = { role: 'user', content: text };
    const placeholderAssistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      isStreaming: true,
      thoughtSteps: [],
      thoughtElapsed: '0.0',
    };
    setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setIsStreaming(true);

    let assistantContent = '';

    await streamChatTurn(
      text,
      sessionId,
      (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent, isStreaming: true }];
          }
          return prev;
        });
      },
      (plan) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            const closedSteps = (last.thoughtSteps || []).map((s) =>
              s.status === 'in_progress' ? { ...s, status: 'completed' as const } : s
            );
            return [...prev.slice(0, -1), { ...last, isStreaming: false, thoughtSteps: closedSteps }];
          }
          return prev;
        });
        if (plan) {
          setCurrentPlan(plan as unknown as IngestionPlan);
          setIsWorkbenchOpen(true);
        }
        loadSessions();
      },
      (err) => {
        console.error('Stream error:', err);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const errMsg = `⚠️ Error communicating with agent: ${err}`;
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: errMsg, isStreaming: false }];
            const closedSteps = (last.thoughtSteps || []).map((s) =>
              s.status === 'in_progress' ? { ...s, status: 'failed' as const } : s
            );
            return [...prev.slice(0, -1), { ...last, content: errMsg, isStreaming: false, thoughtSteps: closedSteps }];
          }
          return [...prev, { role: 'assistant', content: errMsg }];
        });
        setIsStreaming(false);
      },
      model,
      effort,
      (stage) => {
        console.log('[STAGE]', stage);
      },
      (thoughtStep) => {
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
      mode
    );
  };

  const handleSelectView = (view: string) => {
    if (view === 'settings') {
      setIsSettingsModalOpen(true);
    } else {
      setActiveView(view);
    }
  };

  const handlePlanGenerated = (plan: IngestionPlan) => {
    setCurrentPlan(plan);
    setActiveView('chat');
    setIsWorkbenchOpen(true);
    const msg = `Generated Medallion Ingestion Plan for source: **${plan.sourceName}** (${plan.schedule}). Target Lakehouses: \`lh_enterprise_bronze\`, \`lh_enterprise_silver\`, \`lh_enterprise_gold\`.`;
    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  };

  const handleInspectSkill = (skillName: string) => {
    setInspectedSkillName(skillName);
    setIsSkillsModalOpen(true);
  };

  const handleInspectWorkspaceItem = (_item: WorkspaceItem) => {
    setActiveView('chat');
    setIsWorkbenchOpen(true);
  };

  const handleDeleteWorkspaceItem = (_item: WorkspaceItem) => {
    setIsGovernanceModalOpen(true);
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'projects':
        return 'Projects';
      case 'skills':
        return 'Skills & Grounding Engine';
      case 'workspaces':
        return 'Workspace Explorer';
      case 'apps':
        return 'Apps & Ingestion Studio';
      default:
        return messages.length === 0 ? 'Playground' : 'Architect Orders Medallion Flow';
    }
  };

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
        userName={status?.userIdentity ? status.userIdentity.split('@')[0].replace('.', ' ') : 'Harsith Veer'}
        userEmail={status?.userIdentity || 'Bheesetti.Harsith@Pelibiothermal.com'}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onTogglePinProject={handleTogglePinProject}
        onEditProject={handleEditProject}
        onArchiveProject={handleArchiveProject}
        onDeleteProject={handleDeleteProject}
        onRefreshStatus={() => fetchFabricStatus().then(setStatus)}
      />

      {/* 2. Main Studio Canvas */}
      <main className="studio-main" id="mainCanvas">
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
        />

        {/* View Routing */}
        {activeView === 'projects' && (
          <ProjectsView
            onOpenProject={(id) => {
              setActiveView('chat');
              handleSendMessage(`Load and focus on project context: ${id}`);
            }}
            onNewChatWithContext={(_name) => {
              setActiveView('chat');
              handleNewSession();
            }}
            onProjectsChanged={loadProjectsList}
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

        {activeView === 'chat' && (
          <div className={`bolt-workspace-split ${isWorkbenchOpen ? 'split-active' : ''}`}>
            <div
              className={`bolt-chat-pane ${messages.length === 0 ? 'is-landing' : 'in-chat'} ${
                isWorkbenchOpen ? 'with-workbench' : 'full-width'
              }`}
            >
              {isLoadingSession ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', minHeight: '320px' }}>
                  <div className="agent-working-spinner" style={{ width: '28px', height: '28px', borderTopColor: '#10b981' }} />
                  <span style={{ fontSize: '13px', color: '#a1a1aa' }}>Loading conversation history...</span>
                </div>
              ) : messages.length === 0 ? (
                <PlaygroundHome onSelectPrompt={handleSendMessage} />
              ) : (
                <ChatTimeline
                  messages={messages}
                  isStreaming={isStreaming}
                  sessionId={sessionId}
                  onDeployPlan={() => {
                    setIsWorkbenchOpen(true);
                    handleSendMessage('deploy active plan');
                  }}
                  onOpenCanvas={() => setIsWorkbenchOpen(true)}
                  onOpenWorkspace={() => setActiveView('workspaces')}
                  onRetryPrompt={handleSendMessage}
                />
              )}

              <PromptDock onSendMessage={handleSendMessage} isStreaming={isStreaming} />
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
    </div>
  );
};

export default App;
