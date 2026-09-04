import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatThread } from './components/ChatThread';
import { MedallionFlowCanvas } from './components/MedallionFlowCanvas';
import { TranspilerStudio } from './components/TranspilerStudio';
import { DeploymentWorkbench } from './components/DeploymentWorkbench';
import { SkillInspectorModal } from './components/SkillInspectorModal';
import { ConnectorModal } from './components/ConnectorModal';
import { GovernanceModal } from './components/GovernanceModal';
import { ThinkingDrawer } from './components/ThinkingDrawer';
import { fetchFabricStatus, createNewSession, streamChatTurn } from './services/api';
import { FabricStatus, ChatMessage, IngestionPlan } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('architect');
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Modal Dialog States
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

  const handlePlanGenerated = (plan: IngestionPlan) => {
    setCurrentPlan(plan);
    setActiveTab('deployment');
    const msg = `Generated Medallion Ingestion Plan for source: **${plan.sourceName}** (${plan.schedule}). Target Lakehouses: \`lh_enterprise_bronze\`, \`lh_enterprise_silver\`, \`lh_enterprise_gold\`.`;
    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Header Bar */}
      <Header
        status={status}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewSession={handleNewSession}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenConnectors={() => setIsConnectorsOpen(true)}
        onOpenGovernance={() => setIsGovernanceOpen(true)}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Real-Time Chat & Thinking Trace (400px) */}
        <div className="w-[400px] shrink-0 h-full flex flex-col border-r border-border overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ChatThread
              messages={messages}
              isStreaming={isStreaming}
              onSendMessage={handleSendMessage}
            />
          </div>
          {/* AI Thinking Stream & Intermediate Reasoning */}
          <ThinkingDrawer isThinking={isStreaming} />
        </div>

        {/* Right Stage: Interactive Canvas / Deployment / Transpiler */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {activeTab === 'architect' && <MedallionFlowCanvas />}
          {activeTab === 'deployment' && <DeploymentWorkbench plan={currentPlan} />}
          {activeTab === 'transpiler' && <TranspilerStudio />}
          {activeTab === 'lineage' && <MedallionFlowCanvas />}
        </div>
      </div>

      {/* Interactive Feature Modals */}
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
