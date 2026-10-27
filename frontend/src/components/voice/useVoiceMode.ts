/**
 * frontend/src/components/voice/useVoiceMode.ts
 * -----------------------------------------------
 * Hands-free conversational voice mode hook with:
 * 1. Low-latency sentence-by-sentence streaming TTS playback
 * 2. True hands-free Barge-In (interrupt by speaking alone, zero clicks needed)
 * 3. Continuous microphone listening with WebRTC Acoustic Echo Cancellation (AEC)
 * 4. Dual-layer Echo Filter (prevents AI from interrupting itself)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceModeState } from './FloatingVoiceOrb';
import {
  createSpeechRecognition,
  stopSpeaking,
  isSpeechRecognitionSupported,
  enableEchoCancellation,
  disableEchoCancellation,
} from './speechService';
import { StreamingSpeechQueue } from './streamingQueue';

interface UseVoiceModeProps {
  isActive: boolean;
  onSendMessage: (text: string) => void;
  isStreaming?: boolean;
}

export function useVoiceMode({
  isActive,
  onSendMessage,
  isStreaming: _isStreaming,
}: UseVoiceModeProps) {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  // Streaming speech playback queue
  const queueRef = useRef<StreamingSpeechQueue>(
    new StreamingSpeechQueue({
      onStartSpeaking: () => {
        if (isComponentMounted.current) setVoiceState('speaking');
      },
      onFinishedAll: () => {
        if (isComponentMounted.current && !isMuted) {
          setVoiceState('listening');
        }
      },
      onInterrupted: () => {
        if (isComponentMounted.current) setVoiceState('listening');
      },
    })
  );

  // Feeds token chunks directly from SSE into the speech queue
  const feedStreamingChunk = useCallback((chunk: string) => {
    if (!isActive || isMuted) return;
    queueRef.current.push(chunk);
  }, [isActive, isMuted]);

  // Signals that LLM stream completed
  const finishStreaming = useCallback(() => {
    if (!isActive || isMuted) return;
    queueRef.current.flush();
  }, [isActive, isMuted]);

  // Interrupt / stop speech
  const interrupt = useCallback(() => {
    queueRef.current.cancel();
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
        queueRef.current.cancel();
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

  // WebRTC Hardware Acoustic Echo Cancellation (AEC) Lifecycle
  useEffect(() => {
    if (isActive) {
      enableEchoCancellation();
    } else {
      disableEchoCancellation();
    }
    return () => {
      disableEchoCancellation();
    };
  }, [isActive]);

  // Setup Continuous Speech Recognition & Hands-Free Barge-In
  useEffect(() => {
    isComponentMounted.current = true;

    if (!isActive) {
      queueRef.current.cancel();
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
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
      if (!isMuted && !queueRef.current.getIsPlaying()) {
        setVoiceState('listening');
      }
    };

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        interim += event.results[i][0].transcript;
      }
      const spoken = interim.trim();
      if (spoken.length === 0) return;

      // ⚡ SMART BARGE-IN INTERRUPTION:
      // If Tenali is currently speaking and user speaks, test for real speech vs echo
      const isCurrentlySpeaking =
        queueRef.current.getIsPlaying() ||
        (typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking));

      if (isCurrentlySpeaking) {
        const curSentence = queueRef.current.getCurrentSentence().toLowerCase();
        const spokenLower = spoken.toLowerCase();

        // Echo filter: Check if mic captured Tenali's own words from speaker
        const isEcho =
          curSentence.length > 0 &&
          (curSentence.includes(spokenLower) ||
            spokenLower.split(/\s+/).every((w) => w.length > 2 && curSentence.includes(w)));

        if (!isEcho && spoken.length >= 2) {
          // Real user vocal interruption! Immediately silence AI mid-sentence.
          queueRef.current.cancel();
          stopSpeaking();
          setVoiceState('listening');
        } else {
          // Ignore echo loopback
          return;
        }
      }

      setVoiceTranscript(spoken);

      // Auto-commit on silence (1.0s pause)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (spoken.length > 1) {
          queueRef.current.reset();
          onSendMessage(spoken);
          setVoiceTranscript('');
          setVoiceState('thinking');
        }
      }, 1000);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('[VoiceMode] Speech recognition notice:', e.error);
      }
    };

    rec.onend = () => {
      // Auto-restart continuous listening safely
      if (isActive && !isMuted && isComponentMounted.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          try {
            rec.start();
          } catch {
            // Already active or transitioning
          }
        }, 120);
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
      queueRef.current.cancel();
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
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
    feedStreamingChunk,
    finishStreaming,
  };
}
