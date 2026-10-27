/**
 * frontend/src/components/voice/useVoiceMode.ts
 * -----------------------------------------------
 * Clean React hook managing the hands-free conversational voice loop:
 * - Continuous Speech Recognition with Silence Detection (auto-turn taking)
 * - Barge-in Interruption: cuts off Tenali's speech the moment user speaks
 * - High-Fidelity Natural Neural TTS playback
 * - Zero external cost ($0.00)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceModeState } from './FloatingVoiceOrb';
import {
  createSpeechRecognition,
  speakNaturalVoice,
  stopSpeaking,
  isSpeechRecognitionSupported,
} from './speechService';

interface UseVoiceModeProps {
  isActive: boolean;
  onSendMessage: (text: string) => void;
  lastAssistantMessage?: string;
  isStreaming: boolean;
}

export function useVoiceMode({
  isActive,
  onSendMessage,
  lastAssistantMessage,
  isStreaming,
}: UseVoiceModeProps) {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenMsgRef = useRef<string>('');
  const isComponentMounted = useRef<boolean>(true);

  // Interrupt / stop speech
  const interrupt = useCallback(() => {
    stopSpeaking();
    if (voiceState === 'speaking') {
      setVoiceState('listening');
    }
  }, [voiceState]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopSpeaking();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // pass
          }
        }
        setVoiceState('muted');
      } else {
        setVoiceState('listening');
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // pass
          }
        }
      }
      return next;
    });
  }, []);

  // When a new assistant message completes streaming, read it aloud with natural voice
  useEffect(() => {
    if (!isActive) return;

    if (isStreaming) {
      setVoiceState('thinking');
      return;
    }

    if (
      lastAssistantMessage &&
      lastAssistantMessage !== lastSpokenMsgRef.current &&
      lastAssistantMessage.trim().length > 0
    ) {
      lastSpokenMsgRef.current = lastAssistantMessage;
      setVoiceState('speaking');

      speakNaturalVoice(
        lastAssistantMessage,
        () => {
          if (isComponentMounted.current) setVoiceState('speaking');
        },
        () => {
          if (isComponentMounted.current && !isMuted) {
            setVoiceState('listening');
          }
        },
        () => {
          if (isComponentMounted.current) setVoiceState('listening');
        }
      );
    }
  }, [isActive, isStreaming, lastAssistantMessage, isMuted]);

  // Setup Continuous Speech Recognition
  useEffect(() => {
    isComponentMounted.current = true;

    if (!isActive) {
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) return;

    rec.onstart = () => {
      if (!isMuted) setVoiceState('listening');
    };

    rec.onresult = (event) => {
      // ⚡ BARGE-IN INTERRUPTION: If Tenali is currently speaking and user speaks, immediately cut off speech!
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        stopSpeaking();
        setVoiceState('listening');
      }

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        interim += event.results[i][0].transcript;
      }

      if (interim.trim().length > 0) {
        setVoiceTranscript(interim);

        // Auto-commit on silence (1.1s pause)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (interim.trim().length > 1) {
            onSendMessage(interim.trim());
            setVoiceTranscript('');
            setVoiceState('thinking');
          }
        }, 1100);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('[VoiceMode] Notice:', e.error);
      }
    };

    rec.onend = () => {
      // Automatically keep listening in background if still active and not muted
      if (isActive && !isMuted && isComponentMounted.current) {
        try {
          rec.start();
        } catch {
          // pass
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // pass
    }

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
  }, [isActive, isMuted, onSendMessage]);

  return {
    voiceState,
    voiceTranscript,
    isMuted,
    toggleMute,
    interrupt,
  };
}
