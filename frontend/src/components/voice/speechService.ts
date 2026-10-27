/**
 * frontend/src/components/voice/speechService.ts
 * ------------------------------------------------
 * Browser-native zero-cost speech synthesis & recognition utilities.
 * Pure Web APIs (Web Speech API) with zero external subscriptions.
 */

// Window speech recognition typings
export interface SpeechRecognitionEvent {
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

export interface IBrowserSpeechRecognition {
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
 * so that spoken text sounds conversational, crisp, and natural.
 */
export const cleanTextForSpeech = (rawText: string): string => {
  return rawText
    // Remove multi-agent tags and headers
    .replace(/###\s*[^\n]+/g, '')
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
    // Remove markdown tables
    .replace(/\|[^\n]+\|/g, '')
    // Collapse excess spaces & newlines
    .replace(/\s+/g, ' ')
    .trim();
};

let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Picks the highest-fidelity natural neural voice available on the device.
 * Prioritizes Microsoft Natural / Azure Neural voices (Windows/Edge) & Google US English (Chrome).
 */
export const getBestSpeechVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // 1. Microsoft Online / Natural neural voices (Jenny, Aria, Guy) - sounds human
  const msNatural = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online')) &&
      (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Guy'))
  );
  if (msNatural) return msNatural;

  // 2. Any Natural / Neural voice
  const anyNatural = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online'))
  );
  if (anyNatural) return anyNatural;

  // 3. Google US English (Chrome)
  const googleVoice = voices.find((v) => v.name.includes('Google US English') || v.name.includes('Google UK English Female'));
  if (googleVoice) return googleVoice;

  // 4. Apple Samantha / Siri
  const samantha = voices.find((v) => v.name.includes('Samantha') || v.name.includes('Ava'));
  if (samantha) return samantha;

  // 5. Any English voice
  const anyEnglish = voices.find((v) => v.lang === 'en-US' || v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  return voices[0] || null;
};

/**
 * Speaks one sentence with the best natural voice and calls onDone exactly once
 * when it finishes, errors, or is cancelled.
 *
 * Notes on browser quirks this guards against:
 * - We never call cancel() right before speak(); Chrome can silently drop the
 *   utterance when the two happen back to back.
 * - Chrome sometimes never fires onend. A watchdog completes the sentence once
 *   the engine reports it is no longer speaking.
 */
export const speakSentence = (text: string, onDone: () => void): SpeechSynthesisUtterance | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onDone();
    return null;
  }
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = getBestSpeechVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  utter.rate = 1.07;
  utter.pitch = 1.0;

  let finished = false;
  let started = false;
  const queuedAt = Date.now();
  const watchdog = window.setInterval(() => {
    if (finished) return;
    if (started && !synth.speaking && !synth.pending) done();
    else if (!started && Date.now() - queuedAt > 6000) done();
  }, 400);

  function done(): void {
    if (finished) return;
    finished = true;
    window.clearInterval(watchdog);
    onDone();
  }

  utter.onstart = () => {
    started = true;
  };
  utter.onend = done;
  utter.onerror = done;

  if (synth.paused) synth.resume();
  synth.speak(utter);
  return utter;
};

/**
 * Instantly silences any ongoing speech synthesis.
 */
export const stopSpeaking = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};
