import React, { useRef, useEffect, useState } from 'react';
import { Copy, Check, Volume2, ThumbsUp, ThumbsDown, RotateCcw, Play, LayoutGrid } from 'lucide-react';
import { ChatMessage } from '../types';
import { MarkdownRenderer } from './chat/MarkdownRenderer';
import { ThoughtTrace } from './chat/ThoughtTrace';
import { parseThoughtMeta } from './chat/thoughtUtils';

interface ChatTimelineProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId?: string;
  onDeployPlan?: () => void;
  onOpenCanvas?: () => void;
  onOpenWorkspace?: () => void;
  onRetryPrompt?: (prompt: string) => void;
}

export const ChatTimeline: React.FC<ChatTimelineProps> = ({
  messages,
  isStreaming,
  sessionId,
  onDeployPlan,
  onOpenCanvas,
  onOpenWorkspace,
  onRetryPrompt,
}) => {
  const threadRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(messages.length);
  const prevSessionIdRef = useRef<string>(sessionId || '');
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [likedIdxs, setLikedIdxs] = useState<Record<number, boolean>>({});
  const [dislikedIdxs, setDislikedIdxs] = useState<Record<number, boolean>>({});

  const lastUserRef = useRef<HTMLDivElement | null>(null);

  // User manual scroll detection
  const handleScroll = () => {
    if (!threadRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrolledUpRef.current = distanceFromBottom > 140;
  };

  // Reset scroll to top on mount or session switch
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId || '';
      isUserScrolledUpRef.current = false;
      prevCountRef.current = messages.length;
      if (threadRef.current) {
        threadRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [sessionId, messages.length]);

  // Handle message changes & streaming autoscroll
  useEffect(() => {
    if (!threadRef.current) return;
    const thread = threadRef.current;

    // A. New User Message Sent
    if (messages.length > prevCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        isUserScrolledUpRef.current = false;
        requestAnimationFrame(() => {
          if (thread) {
            if (messages.length > 1 && lastUserRef.current) {
              const topOffset = Math.max(0, lastUserRef.current.offsetTop - 20);
              thread.scrollTo({ top: topOffset, behavior: 'smooth' });
            } else {
              thread.scrollTo({ top: 0, behavior: 'instant' });
            }
          }
        });
      }
    }
    // B. Assistant Streaming Progress - only follow if content extends below visible viewport
    else if (isStreaming && !isUserScrolledUpRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = thread;
      const dockReserved = 110;
      const contentVisibleBottom = scrollTop + clientHeight - dockReserved;
      if (scrollHeight - 90 > contentVisibleBottom) {
        thread.scrollTop = scrollHeight - clientHeight;
      }
    }

    prevCountRef.current = messages.length;
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
    <div className="architect-chat-area" id="architectChatArea">
      <div className="chat-thread-scroll" id="chatThread" ref={threadRef} onScroll={handleScroll}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          const { thoughtMeta, cleanContent } = parseThoughtMeta(m.content);
          const hasPlan =
            !isUser &&
            (cleanContent.includes('Architecture Deployed') ||
              cleanContent.includes('Target Folder') ||
              cleanContent.includes('Proposed Fabric Architecture') ||
              cleanContent.includes('Microsoft Fabric Architecture Plan') ||
              cleanContent.includes('Medallion Lakehouses') ||
              cleanContent.includes('Architecture Plan:'));
          const isDeployed =
            cleanContent.includes('Architecture Deployed') ||
            cleanContent.includes('Deployment Run ID');

          if (isUser) {
            const isLatestUser = !messages.slice(idx + 1).some((x) => x.role === 'user');
            return (
              <div
                key={idx}
                ref={isLatestUser ? lastUserRef : undefined}
                className="chat-bubble user"
                data-raw-content={cleanContent}
              >
                <div className="chat-content-card">
                  <div className="chat-card-text">{cleanContent}</div>
                </div>
                <div className="chat-bubble-actions user-actions">
                  <button
                    type="button"
                    onClick={() => handleCopy(cleanContent, idx)}
                    className="chat-action-btn btn-copy-msg"
                    title="Copy prompt"
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
                      className="chat-action-btn btn-retry-msg"
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
            <div key={idx} className="chat-bubble assistant" data-raw-content={cleanContent}>
              {thoughtMeta && <ThoughtTrace meta={thoughtMeta} />}

              <div className="chat-content-card">
                <div className="markdown-body">
                  <MarkdownRenderer content={cleanContent} />
                </div>

                {/* Plan Action Bar Buttons */}
                {hasPlan && (
                  <div className="plan-action-bar" style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isDeployed && onDeployPlan && (
                      <button
                        type="button"
                        className="btn-plan-action btn-deploy-plan"
                        onClick={onDeployPlan}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          background: '#0078d4',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12.5px',
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
                          padding: '7px 14px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '6px',
                          fontSize: '12.5px',
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
                          padding: '7px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#e1e3e1',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          fontSize: '12.5px',
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
              <div className="chat-bubble-actions assistant-actions">
                <button
                  type="button"
                  onClick={() => handleCopy(cleanContent, idx)}
                  className="chat-action-btn btn-copy-msg"
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
                  className={`chat-action-btn btn-speak-msg ${speakingIdx === idx ? 'speaking' : ''}`}
                  title="Read aloud"
                >
                  <Volume2 width={12} height={12} />
                </button>

                <button
                  type="button"
                  onClick={() => setLikedIdxs((p) => ({ ...p, [idx]: !p[idx] }))}
                  className={`chat-action-btn btn-thumb-up ${likedIdxs[idx] ? 'active' : ''}`}
                  title="Good response"
                >
                  <ThumbsUp width={12} height={12} />
                </button>

                <button
                  type="button"
                  onClick={() => setDislikedIdxs((p) => ({ ...p, [idx]: !p[idx] }))}
                  className={`chat-action-btn btn-thumb-down ${dislikedIdxs[idx] ? 'active' : ''}`}
                  title="Bad response"
                >
                  <ThumbsDown width={12} height={12} />
                </button>

                {onRetryPrompt && idx > 0 && messages[idx - 1]?.role === 'user' && (
                  <button
                    type="button"
                    onClick={() => onRetryPrompt(messages[idx - 1].content)}
                    className="chat-action-btn btn-retry-msg"
                    title="Regenerate response"
                  >
                    <RotateCcw width={12} height={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && (!messages.length || messages[messages.length - 1]?.role === 'user') && (
          <div className="chat-bubble assistant chat-loading-bubble">
            <div className="agent-working-card">
              <div className="agent-working-header">
                <div className="agent-working-spinner" />
                <span className="agent-working-title">Working...</span>
              </div>
            </div>
          </div>
        )}

        <div id="chatBottomSpacer" className="chat-thread-bottom-spacer" style={{ height: '8px', flexShrink: 0 }} />
      </div>
    </div>
  );
};

export default ChatTimeline;
