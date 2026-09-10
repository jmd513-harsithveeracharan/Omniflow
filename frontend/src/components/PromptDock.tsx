import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PromptDockProps {
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
}

export const PromptDock: React.FC<PromptDockProps> = ({
  onSendMessage,
  isStreaming,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('Gemini 3.6 Flash');
  const [selectedEffort, setSelectedEffort] = useState('Medium');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'effort' | 'models'>('none');
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const leftControlsRef = useRef<HTMLDivElement>(null);
  const modelPillWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (leftControlsRef.current && !leftControlsRef.current.contains(target)) {
        setIsTuningOpen(false);
        setIsToolsOpen(false);
      }
      if (modelPillWrapperRef.current && !modelPillWrapperRef.current.contains(target)) {
        setIsModelDropdownOpen(false);
        setActiveSubmenu('none');
      }
    };
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTuningOpen(false);
        setIsToolsOpen(false);
        setIsModelDropdownOpen(false);
        setActiveSubmenu('none');
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = () => {
    // Type definition for speech recognition API
    type WebkitWindow = Window & {
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
        start: () => void;
      };
    };

    const w = window as unknown as WebkitWindow;
    const SpeechRecognitionClass = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const ALL_MODELS = [
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Most efficient for everyday tasks', tag: '' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '1M+ context window for complex DAGs', tag: 'Pro' },
    { id: 'groq-120b', name: 'Groq 120B', desc: '70B parameter open weights with deep reasoning', tag: 'Pro' },
    { id: 'groq-20b', name: 'Groq 20B', desc: 'Ultra-low latency instant open weights', tag: '' },
    { id: 'claude-mix', name: 'Claude Mix', desc: 'Dynamic router: Opus for PySpark/AST + Sonnet for speed', tag: 'Mix' },
    { id: 'claude-opus-5', name: 'Claude Opus', desc: 'Deep reasoning & complex SQL AST transpilation', tag: 'Pro' },
    { id: 'claude-3-5-sonnet', name: 'Claude Sonnet', desc: 'High-precision schema mapping & PySpark', tag: '' },
    { id: 'claude-3-5-haiku', name: 'Claude Haiku', desc: 'Ultra-fast metadata discovery & intent', tag: '' },
    { id: 'gpt-4o', name: 'GPT-4o', desc: 'Advanced reasoning & SQL AST transpilation', tag: 'Pro' },
  ];

  return (
    <div className="chat-dock-container" id="chatDockContainer">
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
          <div className="dock-left-controls" ref={leftControlsRef} style={{ position: 'relative' }}>
            {/* Model Tuning Button */}
            <button
              type="button"
              className={`dock-tool-pill ${isTuningOpen ? 'active' : ''}`}
              id="btnTuneModel"
              onClick={() => {
                setIsTuningOpen(!isTuningOpen);
                setIsToolsOpen(false);
              }}
              title="System Prompt & Model Tuning"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </button>

            {/* Tuning Popover */}
            {isTuningOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '44px',
                  left: 0,
                  width: '280px',
                  background: '#1e1f20',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  padding: '14px',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.65)',
                  zIndex: 100,
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
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
                <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
                  Lower temperature produces deterministic, idempotent PySpark code. Higher values increase creative exploration.
                </div>
              </div>
            )}

            {/* Tools Button */}
            <button
              type="button"
              className={`dock-tool-pill ${isToolsOpen ? 'active' : ''}`}
              id="btnToolsMenu"
              onClick={() => {
                setIsToolsOpen(!isToolsOpen);
                setIsTuningOpen(false);
              }}
              title="Active Model Tools"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>Tools</span>
            </button>

            {/* Tools Popover */}
            {isToolsOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '44px',
                  left: '42px',
                  width: '260px',
                  background: '#1e1f20',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.65)',
                  zIndex: 100,
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Active Tools</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Microsoft Fabric REST API',
                    'PySpark Code Synthesizer',
                    'SQLGlot AST Transpiler',
                    'SQLite Multi-Turn Memory',
                    'OneLake ABFSS Storage',
                  ].map((tool, ti) => (
                    <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#d4d4d8' }}>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                      <span>{tool}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dock-right-controls">
            {/* Model & Effort Selector Pill (Exact Previous Iteration Layout) */}
            <div className="dock-model-pill-wrapper" ref={modelPillWrapperRef}>
              <button
                type="button"
                className={`dock-model-pill ${isModelDropdownOpen ? 'dropdown-open' : ''}`}
                id="btnDockModelSelect"
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setActiveSubmenu('none');
                }}
                title="Select Model & Effort"
              >
                <span className="model-pill-name" id="dockModelName">{selectedModel}</span>
                <span className="model-pill-effort" id="dockModelEffort">{selectedEffort}</span>
                <svg className="pill-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Main Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="dock-model-dropdown" id="dockModelDropdown">
                  <div
                    className="dock-model-primary-option"
                    id="btnModelOptionPrimary"
                    onClick={() => {
                      setSelectedModel('Gemini 3.6 Flash');
                      setIsModelDropdownOpen(false);
                      setActiveSubmenu('none');
                    }}
                  >
                    <div className="dock-model-info">
                      <span className="dock-model-name" id="menuPrimaryModelName">Gemini 3.6 Flash</span>
                      <span className="dock-model-desc" id="menuPrimaryModelDesc">Most efficient for everyday tasks</span>
                    </div>
                    {selectedModel === 'Gemini 3.6 Flash' && <span className="dock-model-check">✓</span>}
                  </div>

                  <div className="dock-model-divider" />

                  {/* Effort Row */}
                  <div
                    className="dock-model-row-item"
                    id="btnModelEffortRow"
                    onClick={() => setActiveSubmenu(activeSubmenu === 'effort' ? 'none' : 'effort')}
                  >
                    <span>Effort</span>
                    <span className="dock-row-val">
                      <span id="menuEffortVal">{selectedEffort}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>

                  {/* Effort Attached Flyout Submenu */}
                  {activeSubmenu === 'effort' && (
                    <div className="dock-model-submenu dock-effort-submenu" id="dockModelEffortSubmenu">
                      <div className="submenu-model-list">
                        {['High', 'Medium', 'Low'].map((eff) => (
                          <div
                            key={eff}
                            className={`submenu-model-item ${selectedEffort === eff ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedEffort(eff);
                              setActiveSubmenu('none');
                            }}
                          >
                            <div className="submenu-item-left">
                              <span className="submenu-item-name">{eff}</span>
                            </div>
                            <span className="submenu-item-check">✓</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* More Models Row */}
                  <div
                    className="dock-model-row-item"
                    id="btnMoreModelsRow"
                    onClick={() => setActiveSubmenu(activeSubmenu === 'models' ? 'none' : 'models')}
                  >
                    <span>More models</span>
                    <span className="dock-row-val">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>

                  {/* More Models Attached Flyout Submenu */}
                  {activeSubmenu === 'models' && (
                    <div className="dock-model-submenu" id="dockModelSubmenu">
                      <div className="submenu-model-list" id="submenuModelList">
                        {ALL_MODELS.map((m) => (
                          <div
                            key={m.id}
                            className={`submenu-model-item ${selectedModel === m.name ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedModel(m.name);
                              setIsModelDropdownOpen(false);
                              setActiveSubmenu('none');
                            }}
                          >
                            <div className="submenu-item-left">
                              <span className="submenu-item-name">{m.name}</span>
                              {m.tag && (
                                <span
                                  className="submenu-tag-pro"
                                  style={
                                    m.tag === 'Mix'
                                      ? { background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.4)' }
                                      : undefined
                                  }
                                >
                                  {m.tag}
                                </span>
                              )}
                            </div>
                            <span className="submenu-item-check">✓</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Voice Input Mic */}
            <button
              type="button"
              className={`dock-icon-btn ${isListening ? 'recording' : ''}`}
              id="btnVoiceInput"
              title="Voice Input"
              onClick={handleVoiceToggle}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            {/* Send Button or Live Audio Waveform */}
            {input.trim().length > 0 || isStreaming ? (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isStreaming}
                className="dock-icon-btn btn-chat-send"
                id="btnChatSend"
                title="Send Prompt (Enter)"
                style={{
                  background: '#ffffff',
                  color: '#09090b',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isStreaming ? (
                  <Loader2 width={14} height={14} className="animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="dock-icon-btn"
                id="btnAudioWave"
                title="Live Audio Mode"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="9" x2="4" y2="15" />
                  <line x1="8" y1="5" x2="8" y2="19" />
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <line x1="16" y1="5" x2="16" y2="19" />
                  <line x1="20" y1="9" x2="20" y2="15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="dock-disclaimer">Fabric.AI can make mistakes. Please double-check responses.</div>
    </div>
  );
};

export default PromptDock;
