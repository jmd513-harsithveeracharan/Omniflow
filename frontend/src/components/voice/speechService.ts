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

const isEdgeBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Edg\//i.test(navigator.userAgent);
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Pre-warms the SpeechSynthesis engine during a user click or key gesture.
 * This unlocks browser autoplay permissions so async SSE streamed speech can play.
 */
export const unlockSpeechEngine = (): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    if (synth.paused) synth.resume();
  } catch {
    // ignore
  }
};

/**
 * Picks the highest-fidelity natural voice supported by the current browser.
 * Edge: uses Microsoft Online Natural neural voices (Jenny, Aria, Guy).
 * Chrome: filters out Edge Online voices (which throw 'not-allowed' in Chrome)
 * and uses Google US/UK English or local Windows/Mac desktop neural voices.
 */
export const getBestSpeechVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const rawVoices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (rawVoices.length === 0) return null;

  const isEdge = isEdgeBrowser();

  // Non-Edge browsers (Chrome, Brave, Firefox) CANNOT invoke Edge's private Azure Online voices!
  // Filtering out 'Online' voices for Chrome prevents immediate "not-allowed" / "synthesis-failed" errors.
  const voices = isEdge
    ? rawVoices
    : rawVoices.filter((v) => !v.name.includes('Online'));

  if (isEdge) {
    // 1. Edge Online Natural neural voices (Jenny, Aria, Guy)
    const edgeNatural = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Online')) &&
        (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Guy'))
    );
    if (edgeNatural) return edgeNatural;
  }

  // 2. Google High-Quality English voices (Chrome)
  const googleVoice = voices.find(
    (v) =>
      v.name.includes('Google US English') ||
      v.name.includes('Google UK English Female') ||
      v.name.includes('Google UK English Male')
  );
  if (googleVoice) return googleVoice;

  // 3. Local Natural / Neural voices
  const localNatural = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Neural'))
  );
  if (localNatural) return localNatural;

  // 4. Windows Local Desktop Voices (Zira / David / Mark)
  const winDesktop = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Zira') || v.name.includes('David') || v.name.includes('Mark'))
  );
  if (winDesktop) return winDesktop;

  // 5. Apple Samantha / Ava / Daniel
  const appleVoice = voices.find((v) => v.name.includes('Samantha') || v.name.includes('Ava'));
  if (appleVoice) return appleVoice;

  // 6. Any English voice that is safe
  const anyEnglish = voices.find((v) => v.lang === 'en-US' || v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  return voices[0] || null;
};

/**
 * Speaks one sentence with the best natural voice and calls onDone exactly once
 * when it finishes, errors, or is cancelled. Includes automatic retry with default voice
 * and a 15-second keepalive to prevent Chrome's background freeze bug.
 */
export const speakSentence = (text: string, onDone: () => void): SpeechSynthesisUtterance | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onDone();
    return null;
  }
  const synth = window.speechSynthesis;
  // If Chrome has any stale or hung utterances in queue, cancel them so speech starts immediately
  if (synth.pending) {
    synth.cancel();
  }
  let finished = false;
  let retried = false;

  const utter = new SpeechSynthesisUtterance(text);
  const voice = getBestSpeechVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  utter.rate = 1.05;
  utter.pitch = 1.0;

  let startedAt = 0;
  const queuedAt = Date.now();

  function done(): void {
    if (finished) return;
    finished = true;
    window.clearInterval(watchdog);
    window.clearInterval(keepAlive);
    onDone();
  }

  // Chrome 15s freeze prevention: periodically resume speech
  const keepAlive = window.setInterval(() => {
    if (finished) return;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      synth.resume();
    }
  }, 10000);

  // Watchdog guards against hung utterances without prematurely killing startup
  const watchdog = window.setInterval(() => {
    if (finished) return;
    const now = Date.now();
    if (startedAt > 0 && now - startedAt > 800) {
      if (!synth.speaking && !synth.pending) done();
    } else if (startedAt === 0 && now - queuedAt > 7000) {
      done();
    }
  }, 400);

  utter.onstart = () => {
    startedAt = Date.now();
  };
  utter.onend = done;
  utter.onerror = (e) => {
    console.warn('[SpeechSynthesis] Utterance notice:', e.error, 'Voice:', utter.voice?.name);
    // If voice rejected (e.g. Chrome not-allowed on an Edge voice) and not user cancelled, retry with system default
    if (!retried && e.error !== 'canceled' && e.error !== 'interrupted') {
      retried = true;
      try {
        const fallback = new SpeechSynthesisUtterance(text);
        fallback.voice = null; // Browser system default voice always works
        fallback.rate = 1.05;
        fallback.pitch = 1.0;
        fallback.onstart = () => { startedAt = Date.now(); };
        fallback.onend = done;
        fallback.onerror = () => done();
        synth.speak(fallback);
        return;
      } catch {
        // Fallback failed, finish gracefully
      }
    }
    done();
  };

  try {
    if (synth.paused) synth.resume();
    synth.speak(utter);
  } catch (err) {
    console.error('[SpeechSynthesis] Failed to initiate speak:', err);
    done();
  }

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
