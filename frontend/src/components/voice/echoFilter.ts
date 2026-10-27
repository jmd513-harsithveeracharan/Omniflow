/**
 * frontend/src/components/voice/echoFilter.ts
 * --------------------------------------------
 * Detects when the microphone picked up the assistant's own voice from the
 * speakers. Browser SpeechRecognition cannot apply acoustic echo cancellation
 * against speechSynthesis output, so we compare the heard words against what
 * the assistant just said.
 *
 * Echo shows up as a contiguous run of the assistant's words, while a real
 * follow-up question ("what about silver?") rarely matches a long run even if
 * it shares vocabulary. That is why we use the longest common word run rather
 * than plain word overlap.
 */

const MAX_REFERENCE_WORDS = 400;

const toWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

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

export const countWords = (text: string): number => toWords(text).length;

/** True when `heard` is most likely the assistant's speech leaking into the mic. */
export const isLikelyEcho = (heard: string, assistantSpeech: string): boolean => {
  const heardWords = toWords(heard);
  const refWords = toWords(assistantSpeech).slice(-MAX_REFERENCE_WORDS);
  if (heardWords.length === 0 || refWords.length === 0) return false;

  const run = longestCommonRun(heardWords, refWords);
  if (heardWords.length <= 2) return run === heardWords.length;
  return run >= Math.max(2, Math.ceil(heardWords.length * 0.6));
};

