import React, { useRef, useEffect } from 'react';
import { User, Copy, Check, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatTimelineProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export const ChatTimeline: React.FC<ChatTimelineProps> = ({
  messages,
  isStreaming,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="architect-chat-area">
      <div className="chat-thread-scroll">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`chat-message-row ${m.role === 'user' ? 'user-row' : 'assistant-row'}`}
          >
            {m.role !== 'user' && (
              <div className="assistant-avatar">
                <img
                  src="/assets/logos/abstract-shape(1).png"
                  alt="Fabric.AI"
                  className="w-5 h-5 rounded-md"
                />
              </div>
            )}

            <div className={`message-bubble ${m.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              <div className="message-content markdown-body">
                {m.content}
              </div>

              {m.role !== 'user' && (
                <button
                  type="button"
                  onClick={() => handleCopy(m.content, idx)}
                  className="message-copy-btn"
                  title="Copy message"
                >
                  {copiedIdx === idx ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                </button>
              )}
            </div>

            {m.role === 'user' && (
              <div className="user-avatar">
                <User width={14} height={14} />
              </div>
            )}
          </div>
        ))}

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
