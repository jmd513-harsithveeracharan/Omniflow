import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PlaygroundHome } from './components/PlaygroundHome';
import { ChatTimeline } from './components/ChatTimeline';
import { PromptDock } from './components/PromptDock';
import { MedallionFlowCanvas } from './components/MedallionFlowCanvas';
import { DeploymentWorkbench } from './components/DeploymentWorkbench';
import { SkillInspectorModal } from './components/SkillInspectorModal';
import { ConnectorModal } from './components/ConnectorModal';
import { GovernanceModal } from './components/GovernanceModal';
import { SettingsModal } from './components/SettingsModal';
import { FabricConnectionModal } from './components/modals/FabricConnectionModal';
import { SkillsView } from './components/SkillsView';
import { ProjectsView } from './components/ProjectsView';
import { WorkspaceExplorerView } from './components/WorkspaceExplorerView';
import { IngestionStudioView } from './components/IngestionStudioView';
import {
  fetchFabricStatus,
  createNewSession,
  streamChatTurn,
  fetchSessions,
  fetchSessionDetail,
  deleteSession,
  renameSession,
} from './services/api';
import { FabricStatus, ChatMessage, IngestionPlan, WorkspaceItem, ChatSession } from './types';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<string>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false);
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Modals
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState<boolean>(false);
  const [inspectedSkillName, setInspectedSkillName] = useState<string>('using_fabric_skills');
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState<boolean>(false);
  const [isGovernanceModalOpen, setIsGovernanceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFabricConnectionModalOpen, setIsFabricConnectionModalOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<IngestionPlan | null>(null);

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

  useEffect(() => {
    fetchFabricStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

    loadSessions();

    createNewSession()
      .then((sid) => {
        setSessionId(sid);
      })
      .catch((e) => console.error('Failed to init session', e));
  }, []);

  const handleNewSession = async () => {
    try {
      const newSid = await createNewSession(status?.workspaceId);
      setSessionId(newSid);
      setMessages([]);
      setActiveView('chat');
      loadSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = async (sid: string) => {
    try {
      setSessionId(sid);
      setActiveView('chat');
      const detail = await fetchSessionDetail(sid);
      setMessages(
        detail.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))
      );
    } catch (e) {
      console.error('Failed to load session detail', e);
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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    if (activeView !== 'chat') {
      setActiveView('chat');
    }

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
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
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [...prev, { role: 'assistant', content: assistantContent, isStreaming: true }];
        });
      },
      () => {
        setIsStreaming(false);
      },
      (err) => {
        console.error('Stream error:', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ Error communicating with agent: ${err}` },
        ]);
        setIsStreaming(false);
      }
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
          <div className="bolt-workspace-split">
            <div
              className={`bolt-chat-pane ${messages.length === 0 ? 'is-landing' : 'in-chat'} ${
                isWorkbenchOpen ? 'with-workbench' : 'full-width'
              }`}
            >
              {messages.length === 0 ? (
                <PlaygroundHome onSelectPrompt={handleSendMessage} />
              ) : (
                <ChatTimeline
                  messages={messages}
                  isStreaming={isStreaming}
                  onDeployPlan={() => {
                    if (currentPlan) {
                      setIsWorkbenchOpen(true);
                    } else {
                      handleSendMessage('deploy active plan');
                    }
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
                {currentPlan ? (
                  <DeploymentWorkbench plan={currentPlan} />
                ) : (
                  <MedallionFlowCanvas
                    plan={currentPlan}
                    onClose={() => setIsWorkbenchOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Domain Feature Modals */}
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
