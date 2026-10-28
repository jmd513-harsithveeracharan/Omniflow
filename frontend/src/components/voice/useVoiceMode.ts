/**
 * frontend/src/components/voice/useVoiceMode.ts
 * -----------------------------------------------
 * Hands-free conversational voice mode hook:
 * - Stable SpeechRecognition lifecycle (never tears down on transcript re-renders)
 * - Full-utterance transcript accumulation across interim + final segments
 * - Technical domain term phonetic normalizer (CLI, REST API, PySpark, OneLake)
 * - Sentence-by-sentence streaming TTS playback via StreamingSpeechQueue
 * - Speaker Mode (acoustic feedback safe) vs Headphone Mode (full duplex)
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
import { normalizeDataEngineeringTerms } from './termNormalizer';

export type VoiceAudioMode = 'speaker' | 'headphone';

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
  'shut',
  'hush',
]);

export function useVoiceMode({
  isActive,
  onSendMessage,
  isStreaming = false,
}: UseVoiceModeProps) {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioMode, setAudioMode] = useState<VoiceAudioMode>('speaker');

  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const audioModeRef = useRef<VoiceAudioMode>(audioMode);
  audioModeRef.current = audioMode;

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

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
    const raw = latestTranscriptRef.current.trim();
    const textToSend = normalizeDataEngineeringTerms(raw);
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

  const toggleAudioMode = useCallback(() => {
    setAudioMode((prev) => (prev === 'speaker' ? 'headphone' : 'speaker'));
  }, []);

  // Reflect streaming state onto orb when waiting for first sentence
  useEffect(() => {
    if (!isActive) return;
    if (isStreaming && !queueRef.current?.isSpeaking()) {
      setVoiceState('thinking');
    } else if (!isStreaming && !queueRef.current?.isSpeaking() && !isMuted) {
      setVoiceState('listening');
    }
  }, [isActive, isStreaming, isMuted]);

  // Main SpeechRecognition lifecycle
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

    if (!isSpeechRecognitionSupported()) return;

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

      // Skip finalized segments that are confirmed speaker echo
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

      // Handle acoustic leakage while assistant is speaking
      if (isAssistantSpeaking) {
        if (isLikelyEcho(fullSpoken, spokenSoFar)) {
          if (!hasInterim) {
            turnStartIndexRef.current = event.results.length;
            carryOverTextRef.current = '';
            latestTranscriptRef.current = '';
          }
          return;
        }

        const words = fullSpoken.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
        const hasKeyword = words.some((w) => INTERRUPT_KEYWORDS.has(w));

        // In Speaker Mode: ignore speaker acoustic bleed unless an explicit keyword is spoken
        // In Headphone Mode: countWords >= 2 or explicit keyword triggers barge-in
        const shouldBargeIn = audioModeRef.current === 'headphone'
          ? (countWords(fullSpoken) >= 2 || hasKeyword)
          : hasKeyword;

        if (shouldBargeIn) {
          queueRef.current?.cancel();
          stopSpeaking();
          setVoiceState('listening');
        } else {
          // Acoustic bleed in speaker mode: suppress without interrupting
          return;
        }
      }

      // Do not accumulate user turns during backend synthesis unless user barged in
      if (isStreamingRef.current && !queueRef.current?.isSpeaking()) {
        return;
      }

      const normalized = normalizeDataEngineeringTerms(fullSpoken);
      latestTranscriptRef.current = normalized;
      setVoiceTranscript(normalized);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Natural conversational pause buffer: 1.8s once finalized, 2.1s for interim, 2.4s for 1-2 words.
      // Gives comfortable time to pause and inhale while feeling snappy and prompt when done.
      const wordsCount = countWords(fullSpoken);
      const delayMs = wordsCount <= 2 ? 2400 : hasInterim ? 2100 : 1800;

      silenceTimerRef.current = setTimeout(() => {
        commitTurnNow();
      }, delayMs);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[VoiceMode] SpeechRecognition notice:', e.error);
      }
    };

    rec.onend = () => {
      if (!isActiveRef.current || isMutedRef.current || !isMountedRef.current) return;
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
          // already running
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
    audioMode,
    toggleMute,
    toggleAudioMode,
    interrupt,
    commitTurn: commitTurnNow,
    startVoiceResponse,
    feedStreamingChunk,
    finishStreaming,
  };
}
