/**
 * frontend/src/components/voice/streamingQueue.ts
 * -------------------------------------------------
 * Speaks an LLM response sentence by sentence while it is still streaming,
 * so the assistant starts talking after the first sentence instead of after
 * the whole answer.
 *
 * Lifecycle per response:  startResponse() -> push(chunk)* -> flush()
 * cancel() silences playback and ignores further chunks until the next
 * startResponse(), which is what makes barge-in stick.
 */

import { cleanTextForSpeech, speakSentence, stopSpeaking } from './speechService';

export interface SpeechQueueEvents {
  onSentenceStart?: (sentence: string) => void;
  /** Fired once the response has fully streamed and every sentence was spoken. */
  onDrained?: () => void;
}

const SENTENCE_BOUNDARY = /[.!?]+\s+|\n+/g;
const MERGE_UNDER_CHARS = 160;
const CODE_PLACEHOLDER = '\nThe code is shown in the chat.\n';

export class StreamingSpeechQueue {
  private buffer = '';
  private pending: string[] = [];
  private playing = false;
  private suppressed = false;
  private streamEnded = false;
  private current = '';
  private spokenHistory: string[] = [];
  private generation = 0;
  // Holding a reference stops Chrome from garbage-collecting the utterance mid-speech.
  private utterance: SpeechSynthesisUtterance | null = null;

  constructor(private readonly events: SpeechQueueEvents = {}) {}

  startResponse(): void {
    this.resetPlayback();
    this.spokenHistory = [];
    this.suppressed = false;
    this.streamEnded = false;
  }

  push(chunk: string): void {
    if (this.suppressed) return;
    this.buffer += chunk;
    this.extractSentences();
    if (!this.playing) this.playNext();
  }

  flush(): void {
    if (this.suppressed) return;
    this.streamEnded = true;
    const rest = this.buffer.replace(/```[\s\S]*$/, CODE_PLACEHOLDER);
    this.buffer = '';
    this.enqueue(rest);
    if (!this.playing) this.playNext();
  }

  cancel(): void {
    this.resetPlayback();
    this.suppressed = true;
  }

  isSpeaking(): boolean {
    const engineBusy = typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    return this.playing || (engineBusy && !this.suppressed && this.utterance !== null);
  }

  getCurrentSentence(): string {
    return this.current;
  }

  getSpokenText(): string {
    return this.spokenHistory.join(' ');
  }

  private resetPlayback(): void {
    this.generation += 1;
    this.pending = [];
    this.buffer = '';
    this.playing = false;
    this.current = '';
    this.utterance = null;
    stopSpeaking();
  }

  private extractSentences(): void {
    // Hold back an unfinished ``` block so code is never read aloud line by line.
    const fences = (this.buffer.match(/```/g) || []).length;
    let workable = this.buffer;
    let held = '';
    if (fences % 2 === 1) {
      const idx = this.buffer.lastIndexOf('```');
      workable = this.buffer.slice(0, idx);
      held = this.buffer.slice(idx);
    }
    workable = workable.replace(/```[\s\S]*?```/g, CODE_PLACEHOLDER);

    let last = 0;
    SENTENCE_BOUNDARY.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SENTENCE_BOUNDARY.exec(workable)) !== null) {
      const end = match.index + match[0].length;
      this.enqueue(workable.slice(last, end));
      last = end;
    }
    this.buffer = workable.slice(last) + held;
  }

  private enqueue(raw: string): void {
    const text = cleanTextForSpeech(raw);
    if (text.length < 2 || !/[a-z0-9]/i.test(text)) return;
    // Merge short fragments so the voice doesn't stop and restart every few words.
    const lastIdx = this.pending.length - 1;
    if (lastIdx >= 0 && this.pending[lastIdx].length < MERGE_UNDER_CHARS) {
      this.pending[lastIdx] = `${this.pending[lastIdx]} ${text}`;
    } else {
      this.pending.push(text);
    }
  }

  private playNext(): void {
    if (this.suppressed) return;
    const next = this.pending.shift();
    if (!next) {
      this.playing = false;
      this.current = '';
      this.utterance = null;
      if (this.streamEnded) this.events.onDrained?.();
      return;
    }
    this.playing = true;
    this.current = next;
    this.spokenHistory.push(next);
    const gen = this.generation;
    this.events.onSentenceStart?.(next);
    this.utterance = speakSentence(next, () => {
      if (gen === this.generation) this.playNext();
    });
  }
}
