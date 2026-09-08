import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Volume2, ThumbsUp, ThumbsDown, RotateCcw, Loader2, Play, LayoutGrid } from 'lucide-react';
import { ChatMessage } from '../types';
import { MarkdownRenderer } from './chat/MarkdownRenderer';
import { ThoughtTrace } from './chat/ThoughtTrace';
import { parseThoughtMeta } from './chat/thoughtUtils';

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

  return (
    <div className="architect-chat-area">
      <div className="chat-thread-scroll" style={{ paddingBottom: '160px' }}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          const { thoughtMeta, cleanContent } = parseThoughtMeta(m.content);
          const hasPlan =
            !isUser &&
            (cleanContent.includes('Architecture Deployed') ||
              cleanContent.includes('Target Folder') ||
              cleanContent.includes('Proposed Fabric Architecture'));
          const isDeployed =
            cleanContent.includes('Architecture Deployed') ||
            cleanContent.includes('Deployment Run ID');

          if (isUser) {
            return (
              <div key={idx} className="chat-bubble user">
                <div className="chat-content-card">
                  <div className="chat-card-text">{cleanContent}</div>
                </div>
                <div className="chat-bubble-actions">
                  <button
                    type="button"
                    onClick={() => handleCopy(cleanContent, idx)}
                    className="chat-action-btn"
                    title="Copy message"
                  >
                    {copiedIdx === idx ? (
                      <Check width={12} height={12} style={{ color: '#10b981' }} />
                    ) : (
                      <Copy width={12} height={12} />
                    )}
                  </button>
                  {onRetryPrompt && (
                    <button
                      type="button"
                      onClick={() => onRetryPrompt(cleanContent)}
                      className="chat-action-btn"
                      title="Edit / Resend"
                    >
                      <RotateCcw width={12} height={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="chat-bubble assistant">
              <div
                className="assistant-header-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <div
                  className="assistant-avatar"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: '#1a1b1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                    <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
                    <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
                    <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#e3e3e3',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Fabric.AI
                </span>
              </div>

              <div className="chat-content-card">
                {thoughtMeta && <ThoughtTrace meta={thoughtMeta} />}

                <div className="markdown-body">
                  <MarkdownRenderer content={cleanContent} />
                </div>

                {/* Plan Action Bar Buttons */}
                {hasPlan && (
                  <div
                    className="plan-action-bar"
                    style={{
                      marginTop: '14px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {!isDeployed && onDeployPlan && (
                      <button
                        type="button"
                        className="btn-plan-action btn-deploy-plan"
                        onClick={onDeployPlan}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
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
                          padding: '6px 14px',
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
                          padding: '6px 14px',
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
              </div>

              {/* Assistant Message Actions Toolbar */}
              <div
                className="chat-bubble-actions assistant-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  opacity: 0.85,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleCopy(cleanContent, idx)}
                  className="chat-action-btn"
                  title="Copy response"
                >
                  {copiedIdx === idx ? (
                    <Check width={12} height={12} style={{ color: '#10b981' }} />
                  ) : (
                    <Copy width={12} height={12} />
                  )}
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
                  onClick={() => setLikedIdxs((p) => ({ ...p, [idx]: !p[idx] }))}
                  className={`chat-action-btn ${likedIdxs[idx] ? 'active' : ''}`}
                  title="Good response"
                >
                  <ThumbsUp width={12} height={12} />
                </button>

                <button
                  type="button"
                  onClick={() => setDislikedIdxs((p) => ({ ...p, [idx]: !p[idx] }))}
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
                    title="Regenerate response"
                  >
                    <RotateCcw width={12} height={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="chat-bubble assistant">
            <div
              className="assistant-header-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <div
                className="assistant-avatar"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#1a1b1e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
                  <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
                  <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
                </svg>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e3e3e3' }}>
                Fabric.AI
              </span>
            </div>
            <div
              className="chat-content-card"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)',
                width: 'fit-content',
              }}
            >
              <Loader2 width={14} height={14} className="animate-spin" style={{ color: '#10b981' }} />
              <span style={{ fontSize: '13px', color: '#10b981', fontFamily: 'var(--font-mono, monospace)' }}>
                Fabric.AI synthesizing response...
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatTimeline;
