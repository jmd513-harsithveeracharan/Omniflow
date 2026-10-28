/**
 * frontend/src/components/voice/FloatingVoiceOrb.tsx
 * ----------------------------------------------------
 * ChatGPT-style inline sky-and-cloud fluid orb with real-time acoustic
 * volume reverberation and lively pulsation.
 */

import React, { useState, useEffect, useRef } from 'react';

export type VoiceModeState = 'listening' | 'thinking' | 'speaking' | 'muted';

interface FloatingVoiceOrbProps {
  state: VoiceModeState;
  transcript?: string;
  onClick?: () => void;
  onInterrupt?: () => void;
  onCommit?: () => void;
}

/**
 * Hook to analyze live microphone volume (0.0 to 1.0) using Web Audio API.
 * Provides organic reverberation when the user speaks.
 */
function useLiveAudioEnergy(isActive: boolean, isListening: boolean): number {
  const [energy, setEnergy] = useState<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !isListening) {
      setEnergy(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        try { ctxRef.current.close(); } catch {}
        ctxRef.current = null;
      }
      return;
    }

    let active = true;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextClass) return;

          const ctx = new AudioContextClass();
          ctxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.45;
          source.connect(analyser);

          const buffer = new Uint8Array(analyser.frequencyBinCount);
          let currentEnergy = 0;

          const check = () => {
            if (!active) return;
            analyser.getByteFrequencyData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
              sum += buffer[i];
            }
            const avg = sum / buffer.length;
            // Noise gate at 10, normalize to 0..1
            const normalized = Math.max(0, (avg - 10) / 90);
            const target = Math.min(1.0, normalized);
            // Smooth lerp for liquid, reverberating feel
            currentEnergy = currentEnergy * 0.65 + target * 0.35;
            setEnergy(currentEnergy);
            animRef.current = requestAnimationFrame(check);
          };
          check();
        })
        .catch(() => {
          // Graceful fallback if dual capture not supported
        });
    }

    return () => {
      active = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        try { ctxRef.current.close(); } catch {}
        ctxRef.current = null;
      }
    };
  }, [isActive, isListening]);

  return energy;
}

export const FloatingVoiceOrb: React.FC<FloatingVoiceOrbProps> = ({
  state,
  transcript,
  onClick,
  onInterrupt,
  onCommit,
}) => {
  const isListening = state === 'listening';
  const audioEnergy = useLiveAudioEnergy(state !== 'muted', isListening);

  // Dynamic voice modulation scaling:
  // Base scale is enhanced, and live speech volume swells the sphere up to 1.35
  const dynamicScale = audioEnergy > 0.02 ? 1.0 + audioEnergy * 0.35 : undefined;
  const dynamicGlow = audioEnergy > 0.02
    ? `0 0 ${Math.round(20 + audioEnergy * 42)}px rgba(59, 130, 246, ${Math.min(0.95, 0.4 + audioEnergy * 0.6)})`
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'muted' && onClick) {
      onClick();
    } else if (transcript && transcript.trim().length > 0 && onCommit) {
      onCommit();
    } else if (onInterrupt) {
      onInterrupt();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="chatgpt-floating-orb-wrapper" onClick={handleClick}>
      <div
        className={`floating-orb-sphere state-${state} ${audioEnergy > 0.05 ? 'is-reverbing' : ''}`}
        style={{
          transform: dynamicScale ? `scale(${dynamicScale.toFixed(3)})` : undefined,
          boxShadow: dynamicGlow,
        }}
        title={
          state === 'speaking'
            ? 'Tenali is speaking — speak or click to interrupt'
            : state === 'thinking'
            ? 'Tenali is thinking...'
            : state === 'muted'
            ? 'Microphone muted — click to unmute'
            : transcript && transcript.trim().length > 0
            ? 'Listening... (Click orb to send immediately)'
            : 'Listening... (Speak anytime)'
        }
      >
        <div className="orb-cloud-base" />
        <div className="orb-cloud-wisp orb-cloud-1" />
        <div className="orb-cloud-wisp orb-cloud-2" />
        <div className="orb-cloud-wisp orb-cloud-3" />
      </div>
    </div>
  );
};
