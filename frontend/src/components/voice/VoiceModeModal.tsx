/**
 * frontend/src/components/voice/VoiceModeModal.tsx
 * --------------------------------------------------
 * Fullscreen ChatGPT-style Voice Mode for OmniFlow Tenali AI.
 * Uses Browser Speech Recognition + Native Neural TTS + OmniFlow Tenali API.
 * Zero external cost, ultra-low latency, and fully project-aware.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceOrb, VoiceState } from './VoiceOrb';
import { VoiceControls } from './VoiceControls';
import {
  createSpeechRecognition,
  cleanTextForSpeech,
  getBestSpeechVoice,
  isSpeechRecognitionSupported,
} from './speechService';
import { streamChatTurn } from '../../services/api';
import { Sparkles, Layers, Zap } from 'lucide-react';

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId?: string | null;
  projectName?: string;
  model?: string;
  effort?: string;
  mode?: 'auto' | 'general' | 'project';
  sessionId?: string;
  onAddMessageToTimeline?: (role: 'user' | 'assistant', content: string) => void;
}

export const VoiceModeModal: React.FC<VoiceModeModalProps> = ({
  isOpen,
  onClose,
  activeProjectId,
  projectName = 'Fintech Platform',
  model = 'Tenali AI',
  effort = 'medium',
  mode = 'project',
  sessionId,
  onAddMessageToTimeline,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');
  const [agentSpokenText, setAgentSpokenText] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References for recognition & silence detection
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef<boolean>(true);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
    }
  }, []);

  const speakResponse = useCallback(
    (textToSpeak: string, onFinish: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onFinish();
        return;
      }

      stopSpeaking();
      const clean = cleanTextForSpeech(textToSpeak);
      if (!clean) {
        onFinish();
        return;
      }

      const utter = new SpeechSynthesisUtterance(clean);
      const voice = getBestSpeechVoice();
      if (voice) utter.voice = voice;
      utter.rate = 1.05; // Natural conversational cadence
      utter.pitch = 1.0;

      utter.onend = () => {
        currentUtteranceRef.current = null;
        onFinish();
      };
      utter.onerror = () => {
        currentUtteranceRef.current = null;
        onFinish();
      };

      currentUtteranceRef.current = utter;
      setVoiceState('speaking');
      window.speechSynthesis.speak(utter);
    },
    [stopSpeaking]
  );

  const startListening = useCallback(() => {
    if (isMuted || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setVoiceState('listening');
    } catch {
      // Already running
      setVoiceState('listening');
    }
  }, [isMuted]);

  const submitSpokenQuery = useCallback(
    (promptText: string) => {
      if (!promptText.trim()) {
        startListening();
        return;
      }

      setVoiceState('thinking');
      setLastUserPrompt(promptText);
      setLiveTranscript('');
      setAgentSpokenText('');

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // pass
        }
      }

      onAddMessageToTimeline?.('user', promptText);

      let accumulated = '';
      streamChatTurn(
        promptText,
        sessionId || 'sess_voice_mode',
        (chunk: string) => {
          accumulated += chunk;
          if (isComponentMounted.current) {
            setAgentSpokenText(accumulated);
          }
        },
        (_plan?: unknown) => {
          if (!isComponentMounted.current) return;
          onAddMessageToTimeline?.('assistant', accumulated);
          speakResponse(accumulated, () => {
            if (isComponentMounted.current && !isMuted) {
              setVoiceState('listening');
              startListening();
            }
          });
        },
        (err: string) => {
          if (!isComponentMounted.current) return;
          const fallbackErr = `Sorry, I ran into an error: ${err}`;
          setAgentSpokenText(fallbackErr);
          speakResponse(fallbackErr, () => {
            if (isComponentMounted.current) {
              setVoiceState('listening');
              startListening();
            }
          });
        },
        model,
        effort,
        undefined,
        undefined,
        mode
      );
    },
    [sessionId, model, effort, mode, speakResponse, startListening, onAddMessageToTimeline, isMuted]
  );

  // Initialize Speech Recognition when modal opens
  useEffect(() => {
    isComponentMounted.current = true;
    if (!isOpen) {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // pass
        }
      }
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setErrorMsg('Speech recognition is not available in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) return;

    rec.onstart = () => {
      setVoiceState('listening');
    };

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        interim += event.results[i][0].transcript;
      }
      setLiveTranscript(interim);

      // Auto-commit on silence (1.3s pause)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (interim.trim().length > 1) {
          submitSpokenQuery(interim.trim());
        }
      }, 1300);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('[VoiceMode] Recognition notice:', e.error);
      }
    };

    rec.onend = () => {
      // Auto restart if still in listening state and not muted
      if (voiceState === 'listening' && !isMuted && isComponentMounted.current) {
        try {
          rec.start();
        } catch {
          // pass
        }
      }
    };

    recognitionRef.current = rec;
    startListening();

    return () => {
      isComponentMounted.current = false;
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        rec.abort();
      } catch {
        // pass
      }
    };
  }, [isOpen, isMuted, startListening, stopSpeaking, submitSpokenQuery, voiceState]);

  if (!isOpen) return null;

  const getStatusText = (): string => {
    switch (voiceState) {
      case 'listening':
        return liveTranscript ? `Hearing: "${liveTranscript}"` : 'Listening to your voice...';
      case 'thinking':
        return 'Tenali AI is thinking...';
      case 'speaking':
        return 'Tenali AI is speaking...';
      case 'muted':
        return 'Microphone Muted';
      default:
        return 'Ready to talk';
    }
  };

  return (
    <div className="voice-mode-overlay" onClick={stopSpeaking}>
      <div className="voice-mode-backdrop" />

      {/* Top Meta Bar */}
      <div className="voice-mode-header" onClick={(e) => e.stopPropagation()}>
        <div className="voice-project-badge">
          <Layers width={14} height={14} style={{ color: '#10b981' }} />
          <span>{activeProjectId ? `${projectName} (${activeProjectId})` : 'General OmniFlow Mode'}</span>
        </div>

        <div className="voice-meta-tags">
          <span className="voice-pill-tag">
            <Sparkles width={12} height={12} />
            {mode === 'general' ? 'General Chat' : 'Project Q&A'}
          </span>
          <span className="voice-pill-tag effort-tag">
            <Zap width={12} height={12} />
            {effort.toUpperCase()} Effort
          </span>
          <span className="voice-pill-tag zero-cost">Zero Extra Cost</span>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="voice-mode-stage" onClick={(e) => e.stopPropagation()}>
        <VoiceOrb
          state={voiceState}
          statusText={getStatusText()}
          onOrbClick={() => {
            if (voiceState === 'speaking') {
              stopSpeaking();
              setVoiceState('listening');
              startListening();
            }
          }}
        />

        {/* Live Conversation Subtitle Card */}
        <div className="voice-subtitle-card">
          {errorMsg ? (
            <div className="voice-error-text">{errorMsg}</div>
          ) : voiceState === 'speaking' || agentSpokenText ? (
            <div className="voice-agent-reply">
              <span className="speaker-label">Tenali:</span> {agentSpokenText}
            </div>
          ) : lastUserPrompt ? (
            <div className="voice-user-prompt">
              <span className="speaker-label">You:</span> "{lastUserPrompt}"
            </div>
          ) : (
            <div className="voice-hint-text">
              Speak naturally. Ask about your Microsoft Fabric architecture, Lakehouses, or PySpark logic.
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Controls */}
      <div onClick={(e) => e.stopPropagation()}>
        <VoiceControls
          state={voiceState}
          isMuted={isMuted}
          onToggleMute={() => {
            if (!isMuted) {
              stopSpeaking();
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch {
                  // pass
                }
              }
              setIsMuted(true);
              setVoiceState('muted');
            } else {
              setIsMuted(false);
              setVoiceState('listening');
              startListening();
            }
          }}
          onInterrupt={() => {
            stopSpeaking();
            setVoiceState('listening');
            startListening();
          }}
          onSwitchToChat={onClose}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

