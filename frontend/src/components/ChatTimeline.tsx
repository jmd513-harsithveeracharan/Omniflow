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
  isVoiceModeActive?: boolean;
  onDeployPlan?: () => void;
  onOpenCanvas?: () => void;
  onOpenWorkspace?: () => void;
  onRetryPrompt?: (prompt: string) => void;
}

export const ChatTimeline: React.FC<ChatTimelineProps> = ({
  messages,
  isStreaming,
  sessionId,
  isVoiceModeActive = false,
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
  const activeAssistantRef = useRef<HTMLDivElement | null>(null);

  // User manual scroll detection
  const handleScroll = () => {
    if (!threadRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // If the user has scrolled up more than 80px from bottom, pause autoscroll
    isUserScrolledUpRef.current = distanceFromBottom > 80;
  };

  // Reset scroll to top on mount or session switch
  // Reset scroll to top on mount
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = 0;
    }
  }, []);

  // Handle session switches
  useEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId || '';
      isUserScrolledUpRef.current = false;
      prevCountRef.current = messages.length;
      if (threadRef.current) {
        threadRef.current.scrollTo({ top: 0, behavior: 'instant' });
        if (messages.length > 0) {
          requestAnimationFrame(() => {
            if (threadRef.current) {
              threadRef.current.scrollTop = threadRef.current.scrollHeight;
            }
          });
        } else {
          threadRef.current.scrollTop = 0;
        }
      }
    }
  }, [sessionId, messages.length]);

  // Handle message changes & streaming autoscroll
  useEffect(() => {
    // A. Detect newly added user message (e.g. user submitted a prompt)
    const isNewMessageBatch = messages.length > prevCountRef.current;
    const hasNewUserMsg =
      isNewMessageBatch && messages.slice(prevCountRef.current).some((m) => m.role === 'user');

    if (hasNewUserMsg) {
      isUserScrolledUpRef.current = false;
      requestAnimationFrame(() => {
        if (!threadRef.current) return;
        const currentThread = threadRef.current;
        if (messages.length <= 2) {
          // First turn in the thread: start smoothly at top
          currentThread.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lastUserRef.current) {
          const threadRect = currentThread.getBoundingClientRect();
          const userRect = lastUserRef.current.getBoundingClientRect();
          // Position user prompt 24px below container top
          const targetScroll = currentThread.scrollTop + (userRect.top - threadRect.top) - 24;
          currentThread.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }
      });
    }
    // B. Assistant Streaming Progress - autoscroll ONLY when content extends below visible viewport
    else if (isStreaming && !isUserScrolledUpRef.current) {
      requestAnimationFrame(() => {
        if (!threadRef.current) return;
        const currentThread = threadRef.current;
        const targetEl =
          activeAssistantRef.current || (currentThread.lastElementChild as HTMLElement | null);
        if (!targetEl) return;

        const threadRect = currentThread.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        // Floating prompt dock height reserved at the bottom (~160px normal, ~290px when voice mode orb is active)
        const dockReserved = isVoiceModeActive ? 290 : 160;
        const visibleBottom = threadRect.bottom - dockReserved;

        if (targetRect.bottom > visibleBottom) {
          const overflow = targetRect.bottom - visibleBottom;
          currentThread.scrollTop += overflow;
        }
      });
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

          const isCurrentlyStreaming = Boolean(m.isStreaming || (isStreaming && idx === messages.length - 1));

          const liveThoughtMeta: import('../types').ThoughtMeta | null =
            m.thoughtSteps && m.thoughtSteps.length > 0
              ? { steps: m.thoughtSteps, elapsed: m.thoughtElapsed || thoughtMeta?.elapsed || '0.0' }
              : thoughtMeta && thoughtMeta.steps && thoughtMeta.steps.length > 0
              ? thoughtMeta
              : null;

          const isLatestAssistant = idx === messages.length - 1 && !isUser;

          return (
            <div
              key={idx}
              ref={isLatestAssistant ? activeAssistantRef : undefined}
              className="chat-bubble assistant"
              data-raw-content={cleanContent}
            >
              {liveThoughtMeta && liveThoughtMeta.steps.length > 0 && (
                <ThoughtTrace meta={liveThoughtMeta} isStreaming={isCurrentlyStreaming} />
              )}

              {!cleanContent && isCurrentlyStreaming && (!liveThoughtMeta || liveThoughtMeta.steps.length === 0) && (
                <div className="chat-content-card" style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#a1a1aa', fontSize: '13px' }}>
                    <div className="chat-three-dots-loader">
                      <span className="chat-loading-dot" />
                      <span className="chat-loading-dot" />
                      <span className="chat-loading-dot" />
                    </div>
                    <span style={{ fontWeight: 500, color: '#9ca3af', letterSpacing: '0.01em' }}>Thinking...</span>
                  </div>
                </div>
              )}

              {cleanContent ? (
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
              ) : null}

              {/* Assistant Message Actions Toolbar */}
              {cleanContent && (
                <div className="chat-bubble-actions assistant-actions" style={{ display: 'flex', alignItems: 'center' }}>
                  {liveThoughtMeta?.elapsed && liveThoughtMeta.elapsed !== '0.0' && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#71717a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginRight: 'auto',
                        paddingLeft: '2px',
                        fontWeight: 500,
                      }}
                      title={`Execution completed in ${liveThoughtMeta.elapsed} seconds`}
                    >
                      <span style={{ color: '#10b981' }}>⚡</span>
                      <span>
                        Worked for {Number(liveThoughtMeta.elapsed) >= 60
                          ? `${Math.floor(Number(liveThoughtMeta.elapsed) / 60)}m ${Math.round(Number(liveThoughtMeta.elapsed) % 60)}s`
                          : `${liveThoughtMeta.elapsed}s`}
                      </span>
                    </span>
                  )}

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
              )}
            </div>
          );
        })}

        <div id="chatBottomSpacer" className="chat-thread-bottom-spacer" style={{ height: '16px', flexShrink: 0 }} />
      </div>
    </div>
  );
};

export default ChatTimeline;
