import React, { useState } from 'react';
import { Send, Bot, Database, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askOmniFlowChatbot } from '../../services/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export const OmniFlowChatbotPane: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '👋 Welcome! I am your **OmniFlow Database Assistant**. Ask me anything about projects, database schemas, PII attributes, deployed Fabric assets, or engineering standards from our live Neon catalog.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const quickPills = [
    'Which tables contain sensitive PII?',
    'Show deployed Fabric lakehouses & warehouses',
    'What engineering standards govern Silver Delta MERGE?',
    'What is the blast radius for changing primary keys?',
  ];

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askOmniFlowChatbot(text);
      const botMsg: ChatMessage = {
        role: 'assistant',
        content: res.answer,
        sources: res.sources_inspected,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Chat error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error querying database catalog**: ${err}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
      <div className="px-4 py-3 bg-[#202023] border-b border-[#27272a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-sm text-zinc-100">Live PostgreSQL Catalog Intelligence</span>
        </div>
        <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
          Neon DB (47 tables)
        </span>
      </div>

      <div className="p-3 bg-[#1e1e22] border-b border-[#27272a] flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-400 flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Suggestions:
        </span>
        {quickPills.map((pill, i) => (
          <button
            key={i}
            onClick={() => handleSend(pill)}
            disabled={loading}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full border border-zinc-700/60 transition-colors"
          >
            {pill}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 text-sm ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-[#27272a] text-zinc-200 rounded-bl-none border border-zinc-700/50'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-600/40 text-[11px] text-zinc-400 flex items-center gap-1">
                  <span>Inspected catalog tables:</span>
                  <span className="font-mono text-zinc-300">{m.sources.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 items-center text-xs text-zinc-400 animate-pulse">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span>Querying PostgreSQL catalog and formulating response...</span>
          </div>
        )}
      </div>

      <div className="p-3 bg-[#202023] border-t border-[#27272a]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about project entities, lineage, Fabric lakehouses, or compliance..."
            className="flex-1 bg-[#18181b] border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
