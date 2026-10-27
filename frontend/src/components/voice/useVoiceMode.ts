/**
 * frontend/src/components/voice/useVoiceMode.ts
 * -----------------------------------------------
 * Hands-free conversational voice mode hook:
 * - Stable SpeechRecognition lifecycle (never tears down on transcript re-renders)
 * - Full-utterance transcript accumulation across interim + final segments
 * - Sentence-by-sentence streaming TTS playback via StreamingSpeechQueue
 * - Hands-free vocal barge-in with longest-common-run echo filtering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceModeState } from './FloatingVoiceOrb';
import {
  createSpeechRecognition,
  stopSpeaking,
  isSpeechRecognitionSupported,
  unlockSpeechEngine,
} from './speechService';
import { StreamingSpeechQueue } from './streamingQueue';
import { isLikelyEcho, countWords } from './echoFilter';

interface UseVoiceModeProps {
  isActive: boolean;
  onSendMessage: (text: string) => void;
  isStreaming?: boolean;
}

const INTERRUPT_KEYWORDS = new Set([
  'stop',
  'wait',
  'pause',
  'cancel',
  'enough',
  'hold',
  'quiet',
  'okay',
  'ok',
]);

export function useVoiceMode({
  isActive,
  onSendMessage,
  isStreaming = false,
}: UseVoiceModeProps) {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Refs prevent re-render teardowns of the active SpeechRecognition session
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Tracks where the current uncommitted user turn starts inside event.results
  const turnStartIndexRef = useRef<number>(0);
  const lastResultsLenRef = useRef<number>(0);
  const carryOverTextRef = useRef<string>('');
  const latestTranscriptRef = useRef<string>('');

  const queueRef = useRef<StreamingSpeechQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new StreamingSpeechQueue({
      onSentenceStart: () => {
        if (isMountedRef.current && isActiveRef.current) {
          setVoiceState('speaking');
        }
      },
      onDrained: () => {
        if (isMountedRef.current && isActiveRef.current && !isMutedRef.current) {
          setVoiceState('listening');
        }
      },
    });
  }

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const resetTurnBuffer = useCallback(() => {
    turnStartIndexRef.current = lastResultsLenRef.current;
    carryOverTextRef.current = '';
    latestTranscriptRef.current = '';
    setVoiceTranscript('');
  }, []);

  const commitTurnNow = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const textToSend = latestTranscriptRef.current.trim();
    resetTurnBuffer();
    if (textToSend.length > 0 && !isStreamingRef.current) {
      queueRef.current?.startResponse();
      setVoiceState('thinking');
      onSendMessageRef.current(textToSend);
    }
  }, [resetTurnBuffer]);

  const startVoiceResponse = useCallback(() => {
    if (!isActiveRef.current || isMutedRef.current) return;
    queueRef.current?.startResponse();
    setVoiceState('thinking');
  }, []);

  const feedStreamingChunk = useCallback((chunk: string) => {
    if (!isActiveRef.current || isMutedRef.current) return;
    queueRef.current?.push(chunk);
  }, []);

  const finishStreaming = useCallback(() => {
    if (!isActiveRef.current || isMutedRef.current) return;
    queueRef.current?.flush();
  }, []);

  const interrupt = useCallback(() => {
    queueRef.current?.cancel();
    stopSpeaking();
    if (latestTranscriptRef.current.trim().length > 1 && !isStreamingRef.current) {
      commitTurnNow();
      return;
    }
    if (!isMutedRef.current) {
      setVoiceState('listening');
    }
  }, [commitTurnNow]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        queueRef.current?.cancel();
        stopSpeaking();
        resetTurnBuffer();
        try {
          recognitionRef.current?.stop();
        } catch {
          // ignore
        }
        setVoiceState('muted');
      } else {
        setVoiceState('listening');
        try {
          recognitionRef.current?.start();
        } catch {
          // ignore if already running
        }
      }
      return next;
    });
  }, [resetTurnBuffer]);

  // Reflect streaming state onto orb when waiting for first sentence
  useEffect(() => {
    if (!isActive) return;
    if (isStreaming && !queueRef.current?.isSpeaking()) {
      setVoiceState('thinking');
    } else if (!isStreaming && !queueRef.current?.isSpeaking() && !isMuted) {
      setVoiceState('listening');
    }
  }, [isActive, isStreaming, isMuted]);

  // Main SpeechRecognition lifecycle — ONLY depends on [isActive]
  useEffect(() => {
    isMountedRef.current = true;

    if (!isActive) {
      clearTimers();
      queueRef.current?.cancel();
      stopSpeaking();
      resetTurnBuffer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      console.warn('[VoiceMode] Web Speech API is not supported in this browser.');
      return;
    }

    const rec = createSpeechRecognition();
    if (!rec) return;

    unlockSpeechEngine();
    turnStartIndexRef.current = 0;
    lastResultsLenRef.current = 0;
    carryOverTextRef.current = '';
    latestTranscriptRef.current = '';
    setIsMuted(false);
    isMutedRef.current = false;
    setVoiceState('listening');

    rec.onstart = () => {
      turnStartIndexRef.current = 0;
      lastResultsLenRef.current = 0;
      if (!isMutedRef.current && !queueRef.current?.isSpeaking() && !isStreamingRef.current) {
        setVoiceState('listening');
      }
    };

    rec.onresult = (event) => {
      if (!isActiveRef.current || isMutedRef.current) return;

      lastResultsLenRef.current = event.results.length;
      const isAssistantSpeaking = Boolean(queueRef.current?.isSpeaking());
      const spokenSoFar = isAssistantSpeaking ? (queueRef.current?.getSpokenText() || '') : '';

      // If assistant is speaking, skip any finalized segments that are confirmed speaker echo
      if (isAssistantSpeaking && spokenSoFar) {
        while (turnStartIndexRef.current < event.results.length) {
          const seg = event.results[turnStartIndexRef.current];
          const segText = seg?.[0]?.transcript || '';
          if (seg?.isFinal && isLikelyEcho(segText, spokenSoFar)) {
            turnStartIndexRef.current += 1;
          } else {
            break;
          }
        }
      }

      let sessionText = '';
      let hasInterim = false;
      for (let i = turnStartIndexRef.current; i < event.results.length; i++) {
        const res = event.results[i];
        const piece = res[0]?.transcript || '';
        if (res.isFinal) {
          sessionText += `${piece} `;
        } else {
          sessionText += piece;
          hasInterim = true;
        }
      }

      const fullSpoken = [carryOverTextRef.current, sessionText.trim()]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!fullSpoken) return;

      // Check if assistant is currently speaking (barge-in vs speaker echo)
      if (isAssistantSpeaking) {
        if (isLikelyEcho(fullSpoken, spokenSoFar)) {
          // Only advance turnStartIndex if all segments are finalized echo;
          // never skip an in-progress interim segment!
          if (!hasInterim) {
            turnStartIndexRef.current = event.results.length;
            carryOverTextRef.current = '';
            latestTranscriptRef.current = '';
          }
          return;
        }

        const words = fullSpoken.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
        const hasKeyword = words.some((w) => INTERRUPT_KEYWORDS.has(w));
        if (countWords(fullSpoken) >= 2 || hasKeyword) {
          // Real user barge-in: silence assistant immediately while keeping word 1..N intact!
          queueRef.current?.cancel();
          stopSpeaking();
          setVoiceState('listening');
        } else {
          // Hold word 1 in place without advancing turnStartIndex so word 1 is preserved when word 2 arrives
          latestTranscriptRef.current = fullSpoken;
          return;
        }
      }

      // Do not accumulate new user turns while waiting for LLM unless barging in
      if (isStreamingRef.current && !queueRef.current?.isSpeaking()) {
        return;
      }

      latestTranscriptRef.current = fullSpoken;
      setVoiceTranscript(fullSpoken);

      // Schedule auto-send after natural silence pause (snappy 900ms once segment finalized)
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      const wordsCount = countWords(fullSpoken);
      const delayMs = wordsCount <= 1 ? 1800 : hasInterim ? 1350 : 900;

      silenceTimerRef.current = setTimeout(() => {
        commitTurnNow();
      }, delayMs);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        console.error('[VoiceMode] Microphone access is blocked. Allow microphone permission in browser settings.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[VoiceMode] SpeechRecognition notice:', e.error);
      }
    };

    rec.onend = () => {
      if (!isActiveRef.current || isMutedRef.current || !isMountedRef.current) {
        return;
      }
      // Preserve any uncommitted speech across browser session auto-restarts
      if (latestTranscriptRef.current.trim().length > 0) {
        carryOverTextRef.current = latestTranscriptRef.current.trim();
      }
      turnStartIndexRef.current = 0;
      lastResultsLenRef.current = 0;

      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current || isMutedRef.current || !isMountedRef.current) return;
        try {
          rec.start();
        } catch {
          // already started
        }
      }, 100);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // ignore
    }

    return () => {
      isMountedRef.current = false;
      clearTimers();
      queueRef.current?.cancel();
      stopSpeaking();
      try {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [isActive, clearTimers, resetTurnBuffer, commitTurnNow]);

  return {
    voiceState,
    voiceTranscript,
    isMuted,
    toggleMute,
    interrupt,
    startVoiceResponse,
    feedStreamingChunk,
    finishStreaming,
  };
}
