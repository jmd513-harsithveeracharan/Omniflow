import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatThread } from './components/ChatThread';
import { MedallionFlowCanvas } from './components/MedallionFlowCanvas';
import { TranspilerStudio } from './components/TranspilerStudio';
import { fetchFabricStatus, createNewSession, streamChatTurn } from './services/api';
import { FabricStatus, ChatMessage } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('architect');
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  useEffect(() => {
    // 1. Fetch live Fabric REST API connectivity status
    fetchFabricStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

    // 2. Initialize fresh session
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

    // Append user message immediately
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Top Application Bar */}
      <Header
        status={status}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewSession={handleNewSession}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Real-Time Chat & Intent Agent (380px) */}
        <div className="w-[380px] shrink-0 h-full flex flex-col">
          <ChatThread
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
          />
        </div>

        {/* Right Stage: Interactive Canvas or Tools */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {activeTab === 'architect' && <MedallionFlowCanvas />}
          {activeTab === 'transpiler' && <TranspilerStudio />}
          {activeTab === 'lineage' && <MedallionFlowCanvas />}
        </div>
      </div>
    </div>
  );
};

export default App;
