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
import { fetchFabricStatus, createNewSession, streamChatTurn } from './services/api';
import { FabricStatus, ChatMessage, IngestionPlan } from './types';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<string>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false);
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Modals
  const [isSkillsOpen, setIsSkillsOpen] = useState<boolean>(false);
  const [isConnectorsOpen, setIsConnectorsOpen] = useState<boolean>(false);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<IngestionPlan | null>(null);

  useEffect(() => {
    fetchFabricStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

    createNewSession()
      .then(setSessionId)
      .catch((e) => console.error('Failed to init session', e));
  }, []);

  const handleNewSession = async () => {
    try {
      const newSid = await createNewSession(status?.workspaceId);
      setSessionId(newSid);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

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
    setActiveView(view);
    if (view === 'skills') setIsSkillsOpen(true);
    if (view === 'apps') setIsConnectorsOpen(true);
    if (view === 'governance') setIsGovernanceOpen(true);
  };

  const handlePlanGenerated = (plan: IngestionPlan) => {
    setCurrentPlan(plan);
    setIsWorkbenchOpen(true);
    const msg = `Generated Medallion Ingestion Plan for source: **${plan.sourceName}** (${plan.schedule}). Target Lakehouses: \`lh_enterprise_bronze\`, \`lh_enterprise_silver\`, \`lh_enterprise_gold\`.`;
    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  };

  return (
    <div className="studio-app-container">
      {/* 1. Left Sidebar with Claude Styling */}
      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onNewChat={handleNewSession}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* 2. Main Studio Canvas */}
      <main className="studio-main" id="mainCanvas">
        {/* Google AI Studio TopBar */}
        <TopBar
          viewTitle={messages.length === 0 ? 'Playground' : 'Architect Orders Medallion Flow'}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isWorkbenchOpen={isWorkbenchOpen}
          onToggleWorkbench={() => setIsWorkbenchOpen(!isWorkbenchOpen)}
          onNewSession={handleNewSession}
          onRefreshWorkspace={() => fetchFabricStatus().then(setStatus)}
          status={status}
        />

        {/* Workspace Split (Chat Timeline + Optional Interactive Workbench Canvas) */}
        <div className="bolt-workspace-split">
          {/* Left Chat / Landing Center */}
          <div className={`bolt-chat-pane ${messages.length === 0 ? 'is-landing' : ''} ${isWorkbenchOpen ? 'with-workbench' : 'full-width'}`}>
            {messages.length === 0 ? (
              <PlaygroundHome onSelectPrompt={handleSendMessage} />
            ) : (
              <ChatTimeline messages={messages} isStreaming={isStreaming} />
            )}

            {/* Floating Prompt Input Dock */}
            <PromptDock onSendMessage={handleSendMessage} isStreaming={isStreaming} />
          </div>

          {/* Right Visual Workbench Pane (When toggled open) */}
          {isWorkbenchOpen && (
            <div className="bolt-workbench-pane">
              {currentPlan ? <DeploymentWorkbench plan={currentPlan} /> : <MedallionFlowCanvas />}
            </div>
          )}
        </div>
      </main>

      {/* Domain Feature Modals */}
      <SkillInspectorModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        onSelectSkillPrompt={handleSendMessage}
      />

      <ConnectorModal
        isOpen={isConnectorsOpen}
        onClose={() => setIsConnectorsOpen(false)}
        onPlanGenerated={handlePlanGenerated}
      />

      <GovernanceModal
        isOpen={isGovernanceOpen}
        onClose={() => setIsGovernanceOpen(false)}
      />
    </div>
  );
};

export default App;
