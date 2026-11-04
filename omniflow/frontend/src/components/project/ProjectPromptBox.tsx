import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Mic, MicOff, ArrowUp, AudioWaveform } from 'lucide-react';

interface ProjectPromptBoxProps {
  projectName: string;
  onSubmit: (prompt: string, model: string, mode: 'chat' | 'cowork') => void;
  disabled?: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'Sonnet 3.5 Medium', name: 'Sonnet 3.5', tier: 'Medium' },
  { id: 'Claude 3.7 Sonnet', name: 'Claude 3.7', tier: 'Thinking' },
  { id: 'Tenali AI Medium', name: 'Tenali AI', tier: 'Medium' },
  { id: 'Gemini 3.6 Flash', name: 'Gemini 3.6', tier: 'Flash' },
  { id: 'GPT-4o Omniflow', name: 'GPT-4o', tier: 'Omni' },
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 64), 220)}px`;
    }
  }, [prompt]);

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
      textareaRef.current.style.height = '64px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeModelObj = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <div className="w-full rounded-2xl bg-[#1a1a1c] border border-[#2a2b30] hover:border-[#34353a] transition-all duration-200 shadow-xl overflow-hidden flex flex-col justify-between">
      {/* Textarea Input without separator lines */}
      <div className="p-4 pt-4 pb-1">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          aria-label={`Prompt for ${projectName}`}
          rows={2}
          disabled={disabled}
          className="w-full bg-transparent resize-none text-[15px] leading-relaxed text-[#f0f0f2] placeholder-[#71717a] outline-none border-none focus:ring-0 selection:bg-emerald-500/30"
          style={{ minHeight: '60px', maxHeight: '220px' }}
        />
      </div>

      {/* Seamless Dock Controls Footer (No top border line!) */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-1">
        {/* Left: + icon followed by Chat & Cowork pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="p-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
            title="Add attachment"
          >
            <Plus width={17} height={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`px-3 py-1 rounded-lg text-xs font-normal transition-all ${
              activeMode === 'chat'
                ? 'bg-[#28282c] text-[#f0f0f2] shadow-sm'
                : 'text-[#8e918f] hover:text-[#f0f0f2]'
            }`}
          >
            Chat
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('cowork')}
            className={`px-3 py-1 rounded-lg text-xs font-normal transition-all ${
              activeMode === 'cowork'
                ? 'bg-[#28282c] text-[#f0f0f2] shadow-sm'
                : 'text-[#8e918f] hover:text-[#f0f0f2]'
            }`}
          >
            Cowork
          </button>
        </div>

        {/* Right: Model Name, Voice Icon, Audio / Submit */}
        <div className="flex items-center gap-2.5">
          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setIsModelMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-normal text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
            >
              <span>{activeModelObj.name} <span className="text-[#5f6368]">{activeModelObj.tier}</span></span>
              <ChevronDown width={12} height={12} className="text-[#5f6368]" />
            </button>

            {isModelMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 py-1 bg-[#1a1a1c] border border-[#2a2b30] rounded-xl shadow-2xl z-50 animate-in fade-in-50 zoom-in-95">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id);
                      setIsModelMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      selectedModel === m.id
                        ? 'bg-[#222225] text-emerald-400 font-medium'
                        : 'text-[#c4c7c5] hover:bg-[#222225] hover:text-white'
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] text-[#5f6368]">{m.tier}</span>
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
            className={`p-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors ${
              isRecording ? 'text-red-400 animate-pulse' : ''
            }`}
          >
            {isRecording ? <MicOff width={16} height={16} /> : <Mic width={16} height={16} strokeWidth={1.8} />}
          </button>

          {/* Audio Waveform / Submit Button */}
          {prompt.trim() ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              aria-label="Send prompt"
              className="p-1 text-[#f0f0f2] hover:text-white transition-colors"
            >
              <ArrowUp width={17} height={17} strokeWidth={2.2} />
            </button>
          ) : (
            <button
              type="button"
              className="p-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
              title="Voice waveform"
            >
              <AudioWaveform width={16} height={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
