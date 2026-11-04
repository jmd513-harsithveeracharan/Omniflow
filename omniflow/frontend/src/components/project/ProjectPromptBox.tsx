import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Mic, MicOff, ArrowUp, Sparkles } from 'lucide-react';

interface ProjectPromptBoxProps {
  projectName: string;
  onSubmit: (prompt: string, model: string, mode: 'chat' | 'cowork') => void;
  disabled?: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'Sonnet 3.5 Medium', name: 'Sonnet 3.5 Medium', provider: 'Anthropic' },
  { id: 'Claude 3.7 Sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
  { id: 'Tenali AI Medium', name: 'Tenali AI Medium', provider: 'Tenali' },
  { id: 'Gemini 3.6 Flash', name: 'Gemini 3.6 Flash', provider: 'Google' },
  { id: 'GPT-4o Omniflow', name: 'GPT-4o Omniflow', provider: 'OpenAI' },
];

export const ProjectPromptBox: React.FC<ProjectPromptBoxProps> = ({
  projectName,
  onSubmit,
  disabled = false,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Sonnet 3.5 Medium');
  const [activeMode, setActiveMode] = useState<'chat' | 'cowork'>('chat');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea as text grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 72), 240)}px`;
    }
  }, [prompt]);

  // Close model menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, selectedModel, activeMode);
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '72px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full rounded-2xl bg-[#1e1e24]/90 border border-[#303038] hover:border-[#3e3e48] transition-all duration-200 shadow-xl overflow-hidden focus-within:border-[#4f4f5a] focus-within:ring-1 focus-within:ring-[#5c5c6b]/30">
      {/* Textarea Input */}
      <div className="p-4 pt-4 pb-2">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          aria-label={`Prompt for ${projectName}`}
          rows={2}
          disabled={disabled}
          className="w-full bg-transparent resize-none text-[15px] leading-relaxed text-[#ececf1] placeholder-[#71717a] outline-none border-none focus:ring-0 selection:bg-emerald-500/30"
          style={{ minHeight: '64px', maxHeight: '240px' }}
        />
      </div>

      {/* Dock Controls Footer */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#18181d]/80 border-t border-[#2a2a32]">
        {/* Left: Mode Switchers (+ Chat / Cowork) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeMode === 'chat'
                ? 'bg-[#2b2b34] text-white shadow-sm'
                : 'text-[#8e8ea0] hover:text-[#d1d1db] hover:bg-[#23232b]'
            }`}
          >
            <Plus width={13} height={13} className="text-[#a1a1aa]" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('cowork')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeMode === 'cowork'
                ? 'bg-[#2b2b34] text-white shadow-sm'
                : 'text-[#8e8ea0] hover:text-[#d1d1db] hover:bg-[#23232b]'
            }`}
          >
            <Sparkles width={12} height={12} className="text-emerald-400" />
            <span>Cowork</span>
          </button>
        </div>

        {/* Right: Model Selector, Voice, and Submit */}
        <div className="flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#b4b4c2] hover:text-white hover:bg-[#262630] transition-colors"
            >
              <span>{selectedModel}</span>
              <ChevronDown width={12} height={12} className="text-[#71717a]" />
            </button>

            {isModelMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1.5 w-52 py-1 bg-[#1c1c22] border border-[#32323c] rounded-xl shadow-2xl z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-[#71717a]">
                  Execution Model
                </div>
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id);
                      setIsModelMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                      selectedModel === m.id
                        ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                        : 'text-[#d1d1db] hover:bg-[#262630]'
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] text-[#71717a]">{m.provider}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={() => setIsRecording((prev) => !prev)}
            title={isRecording ? 'Listening...' : 'Voice mode'}
            className={`p-1.5 rounded-lg text-[#8e8ea0] hover:text-[#ececf1] hover:bg-[#262630] transition-colors ${
              isRecording ? 'text-red-400 bg-red-500/15 animate-pulse' : ''
            }`}
          >
            {isRecording ? <MicOff width={15} height={15} /> : <Mic width={15} height={15} />}
          </button>

          {/* Submit Arrow Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!prompt.trim() || disabled}
            aria-label="Send prompt"
            className={`p-1.5 rounded-lg transition-all ${
              prompt.trim() && !disabled
                ? 'bg-white text-black hover:bg-[#ececf1] shadow-md'
                : 'bg-[#2b2b34] text-[#5c5c6b] cursor-not-allowed opacity-60'
            }`}
          >
            <ArrowUp width={15} height={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
