/**
 * frontend/src/components/voice/speechService.ts
 * ------------------------------------------------
 * Browser-native zero-cost speech synthesis & recognition utilities.
 * Pure Web APIs (Web Speech API) with zero external subscriptions.
 */

// Window speech recognition typings
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
  };
}

interface IBrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => IBrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => IBrowserSpeechRecognition;
};

export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as WindowWithSpeech;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
};

export const createSpeechRecognition = (): IBrowserSpeechRecognition | null => {
  if (!isSpeechRecognitionSupported()) return null;
  const w = window as WindowWithSpeech;
  const RecognitionClass = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!RecognitionClass) return null;

  const recognition = new RecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  return recognition;
};

/**
 * Strips markdown code blocks, backticks, asterisks, URLs, and table artifacts
 * so that spoken text sounds conversational and natural.
 */
export const cleanTextForSpeech = (rawText: string): string => {
  return rawText
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italics
    .replace(/(\*\*|\*|__|_)(.*?)\1/g, '$2')
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove bullet dashes / numbers
    .replace(/^[\s*-]+(?=[a-zA-Z])/gm, '')
    // Collapse excess spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Picks the highest-fidelity natural neural voice available on the device.
 */
export const getBestSpeechVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // 1. Natural / Online high quality English voices (Edge / Windows 11 / Chrome)
  const naturalVoice = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural'))
  );
  if (naturalVoice) return naturalVoice;

  // 2. Google US English
  const googleVoice = voices.find((v) => v.name.includes('Google US English') || v.name.includes('Google UK'));
  if (googleVoice) return googleVoice;

  // 3. Samantha (macOS / iOS)
  const samantha = voices.find((v) => v.name.includes('Samantha'));
  if (samantha) return samantha;

  // 4. Any English voice
  const anyEnglish = voices.find((v) => v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  return voices[0] || null;
};

