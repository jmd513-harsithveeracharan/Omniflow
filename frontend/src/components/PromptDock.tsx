import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Wrench,
  ChevronDown,
  ArrowUp,
  Loader2,
} from 'lucide-react';

interface PromptDockProps {
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
}

export const PromptDock: React.FC<PromptDockProps> = ({
  onSendMessage,
  isStreaming,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('Claude 3.5 Sonnet');
  const [selectedEffort] = useState('Medium');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-dock-container">
      <div className="google-prompt-dock">
        {/* Text Input Wrapper */}
        <div className="dock-textarea-wrapper">
          <textarea
            ref={textareaRef}
            id="chatInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a prompt to see what our models can do..."
            rows={1}
            disabled={isStreaming}
          />
        </div>

        {/* Dock Controls Row */}
        <div className="dock-controls-row">
          <div className="dock-left-controls">
            <button
              type="button"
              className="dock-tool-pill"
              title="System Prompt & Model Tuning"
            >
              <Sliders width={14} height={14} />
            </button>
            <button
              type="button"
              className="dock-tool-pill"
              title="Active Model Tools"
            >
              <Wrench width={14} height={14} />
              <span>Tools</span>
            </button>
          </div>

          <div className="dock-right-controls">
            {/* Model & Effort Selector Pill */}
            <div className="dock-model-pill-wrapper" style={{ position: 'relative' }}>
              <button
                type="button"
                className="dock-model-pill"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                title="Select Model & Effort"
              >
                <span className="model-pill-name">{selectedModel}</span>
                <span className="model-pill-effort">{selectedEffort}</span>
                <ChevronDown width={11} height={11} className="pill-chevron" />
              </button>

              {/* Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="dock-model-dropdown">
                  {[
                    { name: 'Claude 3.5 Sonnet', desc: 'Highest complexity, PySpark code & DAG planning' },
                    { name: 'GPT-4o', desc: 'Advanced reasoning & SQL AST transpilation' },
                    { name: 'Gemini 1.5 Flash', desc: 'Fast intent classification & JIT context' },
                    { name: 'Groq OSS 120B', desc: 'Ultra-low latency streaming inference' },
                  ].map((m) => (
                    <div
                      key={m.name}
                      className={`dock-model-primary-option ${selectedModel === m.name ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedModel(m.name);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      <div className="dock-model-info">
                        <span className="dock-model-name">{m.name}</span>
                        <span className="dock-model-desc">{m.desc}</span>
                      </div>
                      {selectedModel === m.name && <span className="dock-model-check">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isStreaming}
              className="dock-send-btn"
              title="Send Prompt (Enter)"
            >
              {isStreaming ? (
                <Loader2 width={14} height={14} className="animate-spin" />
              ) : (
                <ArrowUp width={14} height={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
