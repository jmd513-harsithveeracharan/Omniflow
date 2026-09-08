import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Wrench,
  ChevronDown,
  ArrowUp,
  Loader2,
  Check,
  ChevronRight,
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
  const [selectedEffort, setSelectedEffort] = useState('Medium');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'effort' | 'models'>('none');
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.2);

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

  const MODELS = [
    { id: 'claude-mix', name: 'Claude Mix', desc: 'Dynamic router: Opus for AST + Sonnet for speed', tag: 'Mix' },
    { id: 'claude-opus-5', name: 'Claude Opus', desc: 'Deep reasoning & complex SQL transpilation', tag: 'Pro' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'High-precision schema mapping & PySpark', tag: 'Pro' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', desc: 'Ultra-fast metadata discovery & intent', tag: 'Fast' },
    { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', desc: '1M+ context window for complex DAGs', tag: 'Pro' },
    { id: 'gemini-1-5-flash', name: 'Gemini 1.5 Flash', desc: 'Most efficient for everyday tasks', tag: 'Fast' },
    { id: 'groq-120b', name: 'Groq OSS 120B', desc: 'Ultra-low latency streaming inference', tag: 'Open' },
    { id: 'gpt-4o', name: 'GPT-4o', desc: 'Advanced reasoning & SQL AST transpilation', tag: 'Pro' },
  ];

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
          <div className="dock-left-controls" style={{ position: 'relative' }}>
            {/* Model Tuning Button */}
            <button
              type="button"
              className={`dock-tool-pill ${isTuningOpen ? 'active' : ''}`}
              onClick={() => {
                setIsTuningOpen(!isTuningOpen);
                setIsToolsOpen(false);
              }}
              title="System Prompt & Model Tuning"
            >
              <Sliders width={14} height={14} />
            </button>

            {/* Tuning Popover */}
            {isTuningOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '40px',
                  left: 0,
                  width: '280px',
                  background: '#18181b',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: '14px',
                  boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
                  zIndex: 200,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                  Model Temperature: {temperature}
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', marginBottom: '10px' }}
                />
                <div style={{ fontSize: '11px', color: '#71717a' }}>
                  Lower temperature produces deterministic, idempotent PySpark code. Higher values increase creative exploration.
                </div>
              </div>
            )}

            {/* Tools Button */}
            <button
              type="button"
              className={`dock-tool-pill ${isToolsOpen ? 'active' : ''}`}
              onClick={() => {
                setIsToolsOpen(!isToolsOpen);
                setIsTuningOpen(false);
              }}
              title="Active Model Tools"
            >
              <Wrench width={14} height={14} />
              <span>Tools</span>
            </button>

            {/* Tools Popover */}
            {isToolsOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '40px',
                  left: '40px',
                  width: '260px',
                  background: '#18181b',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: '12px',
                  boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
                  zIndex: 200,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Active Tools</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Microsoft Fabric REST API',
                    'PySpark Code Synthesizer',
                    'SQLGlot AST Transpiler',
                    'SQLite Multi-Turn Memory',
                    'OneLake ABFSS Storage',
                  ].map((tool, ti) => (
                    <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#d4d4d8' }}>
                      <Check width={12} height={12} style={{ color: '#10b981' }} />
                      <span>{tool}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dock-right-controls">
            {/* Model & Effort Selector Pill */}
            <div className="dock-model-pill-wrapper" style={{ position: 'relative' }}>
              <button
                type="button"
                className="dock-model-pill"
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setActiveSubmenu('none');
                }}
                title="Select Model & Effort"
              >
                <span className="model-pill-name">{selectedModel}</span>
                <span className="model-pill-effort">{selectedEffort}</span>
                <ChevronDown width={11} height={11} className="pill-chevron" />
              </button>

              {/* Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="dock-model-dropdown" style={{ position: 'absolute', bottom: '40px', right: 0, width: '280px', background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '6px', boxShadow: '0 16px 32px rgba(0,0,0,0.5)', zIndex: 200 }}>
                  <div
                    className="dock-model-primary-option"
                    onClick={() => {
                      setSelectedModel('Claude 3.5 Sonnet');
                      setIsModelDropdownOpen(false);
                    }}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selectedModel === 'Claude 3.5 Sonnet' ? 'rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>Claude 3.5 Sonnet</div>
                      <div style={{ fontSize: '11px', color: '#71717a' }}>High precision & DAG synthesis</div>
                    </div>
                    {selectedModel === 'Claude 3.5 Sonnet' && <Check width={14} height={14} style={{ color: '#38bdf8' }} />}
                  </div>

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                  {/* Effort Row */}
                  <div
                    onClick={() => setActiveSubmenu(activeSubmenu === 'effort' ? 'none' : 'effort')}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#e4e4e7' }}
                  >
                    <span>Effort</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                      <span>{selectedEffort}</span>
                      <ChevronRight width={12} height={12} />
                    </div>
                  </div>

                  {activeSubmenu === 'effort' && (
                    <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', margin: '2px 0' }}>
                      {['High', 'Medium', 'Low'].map((eff) => (
                        <div
                          key={eff}
                          onClick={() => {
                            setSelectedEffort(eff);
                            setActiveSubmenu('none');
                          }}
                          style={{ padding: '4px 8px', fontSize: '11.5px', color: selectedEffort === eff ? '#38bdf8' : '#a1a1aa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                        >
                          <span>{eff}</span>
                          {selectedEffort === eff && <Check width={12} height={12} />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* More Models Row */}
                  <div
                    onClick={() => setActiveSubmenu(activeSubmenu === 'models' ? 'none' : 'models')}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#e4e4e7' }}
                  >
                    <span>More models</span>
                    <ChevronRight width={12} height={12} />
                  </div>

                  {activeSubmenu === 'models' && (
                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      {MODELS.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.name);
                            setIsModelDropdownOpen(false);
                          }}
                          style={{ padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#fff' }}>{m.name}</div>
                            <div style={{ fontSize: '10.5px', color: '#71717a' }}>{m.desc}</div>
                          </div>
                          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '3px', color: '#38bdf8' }}>
                            {m.tag}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
      <div className="dock-disclaimer" style={{ textAlign: 'center', fontSize: '11px', color: '#52525b', marginTop: '6px' }}>
        Fabric.AI can make mistakes. Please double-check responses.
      </div>
    </div>
  );
};

export default PromptDock;
