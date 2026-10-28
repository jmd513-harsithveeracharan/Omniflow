/**
 * frontend/src/components/voice/echoFilter.ts
 * --------------------------------------------
 * Detects when the microphone picked up the assistant's own voice from the
 * speakers. Browser SpeechRecognition cannot apply acoustic echo cancellation
 * against speechSynthesis output, so we compare the heard words against what
 * the assistant just said using both contiguous word runs and bag-of-words overlap.
 */

const MAX_REFERENCE_WORDS = 100;

export const toWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export const countWords = (text: string): number => toWords(text).length;

const longestCommonRun = (heard: string[], reference: string[]): number => {
  let best = 0;
  let prev: number[] = new Array(reference.length + 1).fill(0);
  for (let i = 1; i <= heard.length; i++) {
    const cur: number[] = new Array(reference.length + 1).fill(0);
    for (let j = 1; j <= reference.length; j++) {
      if (heard[i - 1] === reference[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
};

/**
 * Returns fraction of words in `heard` that appear anywhere in `reference`.
 */
const wordOverlapRatio = (heard: string[], reference: string[]): number => {
  if (heard.length === 0 || reference.length === 0) return 0;
  const refSet = new Set(reference);
  let matched = 0;
  for (const w of heard) {
    if (refSet.has(w)) matched += 1;
  }
  return matched / heard.length;
};

/**
 * True when `heard` is most likely the assistant's speech leaking into the mic.
 * Detects both exact contiguous runs and fragmented/distorted speaker bleed.
 */
export const isLikelyEcho = (heard: string, assistantSpeech: string): boolean => {
  const heardWords = toWords(heard);
  const refWords = toWords(assistantSpeech).slice(-MAX_REFERENCE_WORDS);
  if (heardWords.length === 0 || refWords.length === 0) return false;

  // 1. Contiguous matching run (>= 2 for short phrases, or 50%+ of heard)
  const run = longestCommonRun(heardWords, refWords);
  if (run >= 2 && run >= Math.ceil(heardWords.length * 0.5)) {
    return true;
  }

  // 2. Bag-of-words overlap for distorted mic capture
  if (heardWords.length >= 2) {
    const overlap = wordOverlapRatio(heardWords, refWords);
    if (overlap >= 0.6) {
      return true;
    }
  }

  return false;
};
