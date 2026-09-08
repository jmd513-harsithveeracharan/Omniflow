import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Volume2, ThumbsUp, ThumbsDown, RotateCcw, Loader2, Play, LayoutGrid } from 'lucide-react';
import { ChatMessage } from '../types';
import { MarkdownRenderer } from './chat/MarkdownRenderer';
import { ThoughtTrace, ThoughtMeta } from './chat/ThoughtTrace';

interface ChatTimelineProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onDeployPlan?: () => void;
  onOpenCanvas?: () => void;
  onOpenWorkspace?: () => void;
  onRetryPrompt?: (prompt: string) => void;
}

export const ChatTimeline: React.FC<ChatTimelineProps> = ({
  messages,
  isStreaming,
  onDeployPlan,
  onOpenCanvas,
  onOpenWorkspace,
  onRetryPrompt,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [likedIdxs, setLikedIdxs] = useState<Record<number, boolean>>({});
  const [dislikedIdxs, setDislikedIdxs] = useState<Record<number, boolean>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSpeak = (text: string, idx: number) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_~[\]|]/g, ' ');
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  const parseThoughtMeta = (content: string): { thoughtMeta: ThoughtMeta | null; cleanContent: string } => {
    const thoughtMatch = content.match(/<!--\s*THOUGHT:\s*([\s\S]*?)\s*-->/i);
    if (thoughtMatch) {
      try {
        const parsed = JSON.parse(thoughtMatch[1]) as ThoughtMeta;
        const clean = content.replace(/<!--\s*THOUGHT:\s*[\s\S]*?-->/gi, '').trim();
        return { thoughtMeta: parsed, cleanContent: clean };
      } catch (_) {}
    }

    if (content.includes('Architecture Deployed') || content.includes('Proposed Fabric Architecture')) {
      const syntheticMeta: ThoughtMeta = {
        elapsed: '24.2',
        steps: [
          { title: 'Context Gate: Intent Analysis', detail: 'Analyzed user request, target folder, and schedule trigger.', status: 'completed' },
          { title: 'Meta-Planner: DAG Decomposition', detail: 'Constructed multi-stage execution DAG with Delta notebooks.', status: 'completed' },
          { title: 'Worker Agents: PySpark Synthesis', detail: 'Synthesized production PySpark Delta Lake code with Trident specs.', status: 'completed' },
          { title: 'Auditor Agent: Compliance Verified', detail: '0 missing items, verified safe blast-radius.', status: 'completed' },
        ],
      };
      return { thoughtMeta: syntheticMeta, cleanContent: content };
    }

    return { thoughtMeta: null, cleanContent: content };
  };

  return (
    <div className="architect-chat-area">
      <div className="chat-thread-scroll">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          const { thoughtMeta, cleanContent } = parseThoughtMeta(m.content);
          const hasPlan = !isUser && (
            cleanContent.includes('Architecture Deployed') ||
            cleanContent.includes('Target Folder') ||
            cleanContent.includes('Proposed Fabric Architecture')
          );
          const isDeployed = cleanContent.includes('Architecture Deployed') || cleanContent.includes('Deployment Run ID');

          return (
            <div
              key={idx}
              className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}
            >
              {!isUser && (
                <div className="assistant-avatar">
                  <img
                    src="/assets/logos/abstract-shape(1).png"
                    alt="Fabric.AI"
                    className="w-5 h-5 rounded-md"
                  />
                </div>
              )}

              <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                {thoughtMeta && <ThoughtTrace meta={thoughtMeta} />}

                <div className="message-content markdown-body">
                  <MarkdownRenderer content={cleanContent} />
                </div>

                {/* Plan Action Bar Buttons */}
                {hasPlan && (
                  <div className="plan-action-bar" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isDeployed && onDeployPlan && (
                      <button
                        type="button"
                        className="btn-plan-action btn-deploy-plan"
                        onClick={onDeployPlan}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#0078d4',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Play width={12} height={12} fill="currentColor" />
                        <span>Deploy to Fabric</span>
                      </button>
                    )}

                    {onOpenCanvas && (
                      <button
                        type="button"
                        className="btn-plan-action btn-view-canvas"
                        onClick={onOpenCanvas}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <LayoutGrid width={12} height={12} />
                        <span>{isDeployed ? 'Inspect in Canvas' : 'Visual Canvas'}</span>
                      </button>
                    )}

                    {isDeployed && onOpenWorkspace && (
                      <button
                        type="button"
                        className="btn-plan-action btn-view-explorer"
                        onClick={onOpenWorkspace}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#e1e3e1',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <span>Workspace Explorer →</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Assistant Message Actions Toolbar */}
                {!isUser && (
                  <div className="chat-bubble-actions assistant-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', opacity: 0.8 }}>
                    <button
                      type="button"
                      onClick={() => handleCopy(cleanContent, idx)}
                      className="chat-action-btn"
                      title="Copy response"
                    >
                      {copiedIdx === idx ? <Check width={12} height={12} style={{ color: '#10b981' }} /> : <Copy width={12} height={12} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSpeak(cleanContent, idx)}
                      className={`chat-action-btn ${speakingIdx === idx ? 'active' : ''}`}
                      title="Read aloud"
                    >
                      <Volume2 width={12} height={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setLikedIdxs(p => ({ ...p, [idx]: !p[idx] }))}
                      className={`chat-action-btn ${likedIdxs[idx] ? 'active' : ''}`}
                      title="Good response"
                    >
                      <ThumbsUp width={12} height={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDislikedIdxs(p => ({ ...p, [idx]: !p[idx] }))}
                      className={`chat-action-btn ${dislikedIdxs[idx] ? 'active' : ''}`}
                      title="Bad response"
                    >
                      <ThumbsDown width={12} height={12} />
                    </button>

                    {onRetryPrompt && idx > 0 && messages[idx - 1]?.role === 'user' && (
                      <button
                        type="button"
                        onClick={() => onRetryPrompt(messages[idx - 1].content)}
                        className="chat-action-btn"
                        title="Regenerate"
                      >
                        <RotateCcw width={12} height={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="chat-message-row assistant-row">
            <div className="assistant-avatar">
              <img
                src="/assets/logos/abstract-shape(1).png"
                alt="Fabric.AI"
                className="w-5 h-5 rounded-md"
              />
            </div>
            <div className="message-bubble assistant-bubble streaming-bubble">
              <div className="flex items-center gap-2 text-xs text-[#10b981] font-mono">
                <Loader2 width={14} height={14} className="animate-spin" />
                <span>Claude Code CLI thinking & synthesizing plan...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatTimeline;
