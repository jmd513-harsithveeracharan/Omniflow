import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, ChevronDown, Mic, MicOff, ArrowUp } from 'lucide-react';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  IBrowserSpeechRecognition,
} from '../voice/speechService';
import { normalizeDataEngineeringTerms } from '../voice/termNormalizer';

interface ProjectPromptBoxProps {
  projectName: string;
  onSubmit: (prompt: string, model: string, effort?: string) => void;
  disabled?: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'Tenali AI', name: 'Tenali AI', desc: 'OmniFlow Multi-Agent Core Engine' },
  { id: 'Claude Sonnet', name: 'Claude Sonnet', desc: 'PySpark & schema mapping' },
  { id: 'Claude Opus', name: 'Claude Opus', desc: 'Deep reasoning & SQL AST transpilation' },
  { id: 'Gemini 3.6 Flash', name: 'Gemini 3.6 Flash', desc: 'Ultra-fast metadata discovery' },
  { id: 'Gemini 1.5 Pro', name: 'Gemini 1.5 Pro', desc: '1M+ context for large DAGs' },
  { id: 'GPT-4o', name: 'GPT-4o', desc: 'Advanced reasoning & Lakehouse DDL' },
];

const EFFORT_LEVELS = ['High', 'Medium', 'Low'];

export const ProjectPromptBox: React.FC<ProjectPromptBoxProps> = ({
  projectName,
  onSubmit,
  disabled = false,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Tenali AI');
  const [selectedEffort, setSelectedEffort] = useState<string>('Medium');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'models' | 'effort'>('models');
  const [isTuningOpen, setIsTuningOpen] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(0.2);

  // Dedicated speech-to-text dictation
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const dictationRecRef = useRef<IBrowserSpeechRecognition | null>(null);
  const baseInputRef = useRef<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tuningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 60), 220)}px`;
    }
  }, [prompt]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
      if (tuningRef.current && !tuningRef.current.contains(target)) {
        setIsTuningOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    return () => {
      if (dictationRecRef.current) {
        try {
          dictationRecRef.current.abort();
        } catch {
          // ignore
        }
        dictationRecRef.current = null;
      }
    };
  }, []);

  const handleToggleDictation = () => {
    if (!isSpeechRecognitionSupported()) {
      alert(
        'Speech Recognition is not supported by your browser engine.\nPlease use Google Chrome or Microsoft Edge for voice dictation.'
      );
      return;
    }

    if (isDictating) {
      if (dictationRecRef.current) {
        try {
          dictationRecRef.current.stop();
        } catch {
          // ignore
        }
        dictationRecRef.current = null;
      }
      setIsDictating(false);
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) return;

    baseInputRef.current = prompt.trim().length > 0 ? `${prompt.trim()} ` : '';
    let sessionTranscript = '';

    rec.onstart = () => {
      setIsDictating(true);
    };

    rec.onresult = (event) => {
      let interim = '';
      let finalized = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const piece = res[0]?.transcript || '';
        if (res.isFinal) {
          finalized += `${piece} `;
        } else {
          interim += piece;
        }
      }
      sessionTranscript = normalizeDataEngineeringTerms(`${finalized}${interim}`.trim());
      setPrompt(`${baseInputRef.current}${sessionTranscript}`);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[Dictation] Speech recognition notice:', e.error);
      }
      setIsDictating(false);
    };

    rec.onend = () => {
      setIsDictating(false);
      dictationRecRef.current = null;
    };

    dictationRecRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setIsDictating(false);
    }
  };

  const handleSubmit = () => {
    if (dictationRecRef.current) {
      try {
        dictationRecRef.current.stop();
      } catch {
        // ignore
      }
      dictationRecRef.current = null;
      setIsDictating(false);
    }
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, selectedModel, selectedEffort.toLowerCase());
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '60px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full rounded-2xl bg-[#1a1a1c] border border-[#2a2b30] hover:border-[#34353a] transition-all duration-200 shadow-xl overflow-hidden flex flex-col justify-between">
      {/* Textarea Input */}
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

      {/* Dock Controls Footer */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-1">
        {/* Left: Model Tuning Popover */}
        <div className="relative" ref={tuningRef}>
          <button
            type="button"
            onClick={() => setIsTuningOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg text-[#8e918f] hover:text-[#f0f0f2] hover:bg-[#222225] transition-colors ${
              isTuningOpen ? 'bg-[#222225] text-emerald-400' : ''
            }`}
            title="System prompt & model temperature tuning"
          >
            <SlidersHorizontal width={15} height={15} />
          </button>

          {isTuningOpen && (
            <div className="absolute left-0 bottom-full mb-2 w-64 p-3.5 bg-[#1a1a1c] border border-[#2a2b30] rounded-xl shadow-2xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#f0f0f2]">Model Temperature</span>
                <span className="text-xs font-mono text-emerald-400 font-medium">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 mb-2 cursor-pointer"
              />
              <p className="text-[11px] text-[#8e918f] leading-relaxed">
                Lower values produce deterministic PySpark code; higher values increase architectural exploration.
              </p>
            </div>
          )}
        </div>

        {/* Right: Model & Effort Pill + Mic + Submit */}
        <div className="flex items-center gap-2">
          {/* Model & Effort Selector */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#222225] hover:bg-[#28282c] border border-[#2a2b30] text-xs font-normal text-[#f0f0f2] transition-colors"
            >
              <span>{selectedModel}</span>
              <span className="text-[10px] text-[#8e918f] font-mono">{selectedEffort}</span>
              <ChevronDown width={12} height={12} className="text-[#8e918f]" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-60 bg-[#1a1a1c] border border-[#2a2b30] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95">
                {/* Tabs: Models vs Effort */}
                <div className="flex border-b border-[#232326] bg-[#141416]">
                  <button
                    type="button"
                    onClick={() => setActiveMenuTab('models')}
                    className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                      activeMenuTab === 'models'
                        ? 'text-white border-b-2 border-emerald-500'
                        : 'text-[#8e918f] hover:text-[#c4c7c5]'
                    }`}
                  >
                    Models
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMenuTab('effort')}
                    className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                      activeMenuTab === 'effort'
                        ? 'text-white border-b-2 border-emerald-500'
                        : 'text-[#8e918f] hover:text-[#c4c7c5]'
                    }`}
                  >
                    Effort ({selectedEffort})
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-1 max-h-56 overflow-y-auto">
                  {activeMenuTab === 'models' ? (
                    AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          selectedModel === m.id
                            ? 'bg-[#222225] text-emerald-400'
                            : 'text-[#c4c7c5] hover:bg-[#222225] hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-medium">{m.name}</span>
                        <span className="text-[10px] text-[#8e918f] truncate w-full">{m.desc}</span>
                      </button>
                    ))
                  ) : (
                    EFFORT_LEVELS.map((eff) => (
                      <button
                        key={eff}
                        type="button"
                        onClick={() => {
                          setSelectedEffort(eff);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          selectedEffort === eff
                            ? 'bg-[#222225] text-emerald-400 font-medium'
                            : 'text-[#c4c7c5] hover:bg-[#222225] hover:text-white'
                        }`}
                      >
                        <span>{eff} Effort</span>
                        {selectedEffort === eff && <span>✓</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Voice Input / Dictation Button */}
          <button
            type="button"
            onClick={handleToggleDictation}
            title={isDictating ? 'Listening... click to stop' : 'Speech-to-text voice dictation'}
            className={`p-1.5 rounded-lg text-[#8e918f] hover:text-[#f0f0f2] hover:bg-[#222225] transition-colors ${
              isDictating ? 'text-red-400 bg-red-500/10 animate-pulse' : ''
            }`}
          >
            {isDictating ? <MicOff width={16} height={16} /> : <Mic width={16} height={16} />}
          </button>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !prompt.trim()}
            aria-label="Send prompt"
            className={`p-1.5 rounded-lg transition-all ${
              prompt.trim() && !disabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md'
                : 'text-[#5f6368] cursor-not-allowed'
            }`}
          >
            <ArrowUp width={16} height={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
};
