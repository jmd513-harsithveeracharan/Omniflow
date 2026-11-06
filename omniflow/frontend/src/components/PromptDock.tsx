import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Globe, Layers, X, Mic, MicOff, Volume2, Headphones, ImagePlus } from 'lucide-react';
import { FloatingVoiceOrb, VoiceModeState } from './voice/FloatingVoiceOrb';
import {
  unlockSpeechEngine,
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  IBrowserSpeechRecognition,
} from './voice/speechService';
import { normalizeDataEngineeringTerms } from './voice/termNormalizer';
import { ALL_MODELS } from './dock/dockConstants';
import { ImagePreviewTray } from './dock/ImagePreviewTray';

interface PromptDockProps {
  onSendMessage: (text: string, model?: string, effort?: string, mode?: 'auto' | 'general' | 'project', images?: string[]) => void;
  isStreaming: boolean;
  activeProjectId?: string | null;
  isVoiceModeActive?: boolean;
  onToggleVoiceMode?: () => void;
  voiceState?: VoiceModeState;
  isVoiceMuted?: boolean;
  onToggleVoiceMute?: () => void;
  onInterruptVoice?: () => void;
  onCommitVoice?: () => void;
  voiceTranscript?: string;
  voiceAudioMode?: 'speaker' | 'headphone';
  onToggleVoiceAudioMode?: () => void;
}

export const PromptDock: React.FC<PromptDockProps> = ({
  onSendMessage,
  isStreaming,
  activeProjectId,
  isVoiceModeActive = false,
  onToggleVoiceMode,
  voiceState = 'listening',
  isVoiceMuted = false,
  onToggleVoiceMute,
  onInterruptVoice,
  onCommitVoice,
  voiceTranscript = '',
  voiceAudioMode = 'speaker',
  onToggleVoiceAudioMode,
}) => {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState<'general' | 'project'>(activeProjectId ? 'project' : 'general');
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (activeProjectId) {
      setChatMode('project');
    } else {
      setChatMode('general');
    }
  }, [activeProjectId]);
  const [selectedModel, setSelectedModel] = useState('Tenali AI');
  const [selectedEffort, setSelectedEffort] = useState('Medium');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'effort' | 'models'>('none');
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.2);

  // Image attachments (Multimodal)
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    valid.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        if (res) {
          setAttachedImages((prev) => [...prev, res]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData && e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith('image/'));
      if (items.length > 0) {
        const files: File[] = [];
        for (const item of items) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
        if (files.length > 0) {
          e.preventDefault();
          handleFiles(files);
        }
      }
    }
  };

  // Dedicated speech-to-text dictation state (Microphone only)
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const dictationRecRef = useRef<IBrowserSpeechRecognition | null>(null);
  const baseInputRef = useRef<string>('');

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
        'Zen Browser and Firefox (Gecko engine) do not support the Web Speech Recognition API.\n\nPlease open OmniFlow in Google Chrome or Microsoft Edge to use microphone speech-to-text dictation.'
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

    // If interactive voice mode was active, exit it
    if (isVoiceModeActive && onToggleVoiceMode) {
      onToggleVoiceMode();
    }

    const rec = createSpeechRecognition();
    if (!rec) return;

    baseInputRef.current = input.trim().length > 0 ? `${input.trim()} ` : '';
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
      setInput(`${baseInputRef.current}${sessionTranscript}`);
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

  const handleLaunchVoiceMode = () => {
    if (dictationRecRef.current) {
      try {
        dictationRecRef.current.stop();
      } catch {
        // ignore
      }
      dictationRecRef.current = null;
      setIsDictating(false);
    }

    if (!isSpeechRecognitionSupported()) {
      alert(
        'Zen Browser and Firefox (Gecko engine) do not support the Web Speech Recognition API.\n\nPlease open OmniFlow in Google Chrome or Microsoft Edge to use Hands-Free Voice Mode.'
      );
      return;
    }
    unlockSpeechEngine();
    if (onToggleVoiceMode) {
      onToggleVoiceMode();
    }
  };

  const handleToggleMode = () => {
    setIsFlipping(true);
    setChatMode((prev) => (prev === 'project' ? 'general' : 'project'));
    setTimeout(() => setIsFlipping(false), 280);
  };

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
      }
      if (modelPillWrapperRef.current && !modelPillWrapperRef.current.contains(target)) {
        setIsModelDropdownOpen(false);
        setActiveSubmenu('none');
      }
    };
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTuningOpen(false);
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

  const handleSubmit = (textOverride?: string) => {
    if (dictationRecRef.current) {
      try {
        dictationRecRef.current.stop();
      } catch {
        // ignore
      }
      dictationRecRef.current = null;
      setIsDictating(false);
    }
    const val = (typeof textOverride === 'string' ? textOverride : '') || input;
    if ((!val.trim() && attachedImages.length === 0) || isStreaming) return;
    onSendMessage(
      val.trim() || 'Analyze the attached image/diagram',
      selectedModel,
      selectedEffort.toLowerCase(),
      chatMode,
      attachedImages
    );
    setInput('');
    setAttachedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className={`chat-dock-container ${isVoiceModeActive ? 'voice-mode-active' : ''}`} id="chatDockContainer">
      {isVoiceModeActive && (
        <FloatingVoiceOrb
          state={voiceState}
          transcript={voiceTranscript}
          onClick={onToggleVoiceMute}
          onInterrupt={onInterruptVoice}
          onCommit={onCommitVoice}
        />
      )}

      <div className="google-prompt-dock">
        {/* Text Input Wrapper */}
        <div className="dock-textarea-wrapper">
          <ImagePreviewTray
            images={attachedImages}
            onRemoveImage={(idx) => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
          />
          <textarea
            ref={textareaRef}
            id="chatInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isVoiceModeActive
                ? isVoiceMuted
                  ? 'Microphone muted. Tap unmute or start typing...'
                  : voiceTranscript
                  ? 'Speaking live into conversation above... (or type here)'
                  : 'Voice mode active — speak freely (words grow in chat above)...'
                : 'Start typing a prompt to see what our models can do...'
            }
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

                {/* Single Mode Toggle Button with Flip Animation (General vs Project) */}
                <button
                  type="button"
                  className={`dock-mode-toggle-pill ${chatMode} ${isFlipping ? 'flipping' : ''}`}
                  id="btnDockModeToggle"
                  onClick={handleToggleMode}
                  title={`Active: ${chatMode === 'project' ? 'Project' : 'General'} Mode — Click to switch to ${chatMode === 'project' ? 'General' : 'Project'} Mode`}
                >
                  <div className="mode-toggle-inner">
                    {chatMode === 'project' ? (
                      <>
                        <Layers size={13} strokeWidth={1.8} className="mode-icon" />
                        <span className="mode-label">Project</span>
                      </>
                    ) : (
                      <>
                        <Globe size={13} strokeWidth={1.8} className="mode-icon" />
                        <span className="mode-label">General</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Hidden File Input for Image Upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />

                {/* Attach Image Tool Pill */}
                <button
                  type="button"
                  className={`dock-tool-pill ${attachedImages.length > 0 ? 'active' : ''}`}
                  id="btnDockAttachImage"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image or diagram (or paste with Ctrl+V)"
                >
                  <ImagePlus size={13} strokeWidth={1.8} />
                  <span>Image</span>
                  {attachedImages.length > 0 && (
                    <span className="dock-attachment-badge">
                      {attachedImages.length}
                    </span>
                  )}
                </button>
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
                          setSelectedModel('Tenali AI');
                          setIsModelDropdownOpen(false);
                          setActiveSubmenu('none');
                        }}
                      >
                        <div className="dock-model-info">
                          <span className="dock-model-name" id="menuPrimaryModelName">Tenali AI</span>
                          <span className="dock-model-desc" id="menuPrimaryModelDesc">OmniFlow GPT-6 Luna • Multi-Agent Core Engine (Default)</span>
                        </div>
                        {selectedModel === 'Tenali AI' && <span className="dock-model-check">✓</span>}
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

                {isVoiceModeActive ? (
                  <>
                    {/* Audio Output Mode Toggle (Speaker vs Headphone) */}
                    {onToggleVoiceAudioMode && (
                      <button
                        type="button"
                        className={`voice-dock-mode-pill ${voiceAudioMode === 'headphone' ? 'is-headphone' : 'is-speaker'}`}
                        id="btnVoiceAudioModeToggle"
                        title={
                          voiceAudioMode === 'headphone'
                            ? 'Headphones Active: Full duplex hands-free barge-in enabled. (Click to switch to Speakers)'
                            : 'Laptop Speakers Active: Echo Guard prevents self-interruption. (Click if using Headphones)'
                        }
                        onClick={onToggleVoiceAudioMode}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          border: voiceAudioMode === 'headphone'
                            ? '1px solid rgba(59, 130, 246, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          background: voiceAudioMode === 'headphone'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: voiceAudioMode === 'headphone' ? '#60a5fa' : '#a1a1aa',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {voiceAudioMode === 'headphone' ? (
                          <>
                            <Headphones width={13} height={13} />
                            <span>Headphones</span>
                          </>
                        ) : (
                          <>
                            <Volume2 width={13} height={13} />
                            <span>Speakers</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Live Voice Microphone Mute Toggle */}
                    <button
                      type="button"
                      className={`voice-dock-mic-btn ${isVoiceMuted ? 'is-muted' : 'is-listening'}`}
                      id="btnVoiceMuteToggle"
                      title={isVoiceMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                      onClick={onToggleVoiceMute}
                    >
                      {isVoiceMuted ? <MicOff width={15} height={15} /> : <Mic width={15} height={15} />}
                    </button>

                    {/* Round Blue Exit Button */}
                    <button
                      type="button"
                      className="btn-voice-exit"
                      id="btnExitVoiceMode"
                      title="End Voice Mode"
                      onClick={onToggleVoiceMode}
                    >
                      <X width={16} height={16} />
                    </button>
                  </>
                ) : (
                  <>
                    {/* Microphone Dictation (Audio to Text Only) */}
                    <button
                      type="button"
                      className={`dock-icon-btn ${isDictating ? 'recording' : ''}`}
                      id="btnVoiceInput"
                      title={isDictating ? 'Stop microphone dictation' : 'Dictate with microphone (Audio to text)'}
                      onClick={handleToggleDictation}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>

                    {/* Send Button or Live Audio Waveform (Interactive Voice Mode) */}
                    {input.trim().length > 0 || attachedImages.length > 0 || isStreaming ? (
                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={(!input.trim() && attachedImages.length === 0) || isStreaming}
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
                        title="Start Voice Mode (Hands-Free Conversation)"
                        onClick={handleLaunchVoiceMode}
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
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="dock-disclaimer">Omniflow can make mistakes. Please double-check responses.</div>
    </div>
  );
};

export default PromptDock;
