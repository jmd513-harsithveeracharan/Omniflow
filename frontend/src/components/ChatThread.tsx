import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatThreadProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  isStreaming,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-surface/50 border-r border-border backdrop-blur-glass">
      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-3 text-brand-cyan">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-medium text-slate-200 mb-1">Architect Your Medallion Platform</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              Ask to ingest tables into Bronze, write Silver Delta MERGE notebooks, or audit schema blast zones.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
              {[
                'Ingest Orders to Bronze',
                'Build SCD2 Silver MERGE',
                'Analyze blast radius of CustomerID drop',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSendMessage(suggestion)}
                  className="px-2.5 py-1 rounded-md bg-surface-hover hover:bg-slate-700/60 border border-border text-[11px] text-slate-300 transition-all text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role !== 'user' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-primary to-brand-cyan flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`relative group max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-brand-primary text-white rounded-tr-none shadow-md shadow-brand-primary/20'
                    : 'bg-surface-card border border-border text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans break-words">{m.content}</div>

                {m.role !== 'user' && (
                  <button
                    onClick={() => handleCopy(m.content, idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}

        {isStreaming && (
          <div className="flex gap-3 items-center text-xs text-brand-cyan">
            <div className="w-7 h-7 rounded-lg bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center shrink-0 animate-spin">
              <Loader2 className="w-4 h-4 text-brand-cyan" />
            </div>
            <span className="font-mono text-[11px] animate-pulse">Claude CLI thinking & streaming...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-surface-card">
        <div className="flex items-center gap-2 bg-surface rounded-lg border border-border px-3 py-1.5 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type an architectural instruction..."
            className="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none placeholder:text-slate-500"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="p-1.5 rounded-md bg-brand-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all active:scale-95 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
