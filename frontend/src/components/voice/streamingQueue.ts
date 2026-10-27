/**
 * frontend/src/components/voice/streamingQueue.ts
 * -------------------------------------------------
 * Real-time sentence-by-sentence streaming speech playback queue.
 * Enables ChatGPT-style low-latency voice responses:
 * Starts speaking the moment the first sentence arrives from the LLM stream,
 * without waiting for the full response to finish generating.
 */

import { cleanTextForSpeech, speakNaturalVoice, stopSpeaking } from './speechService';

export interface StreamingSpeechQueueOptions {
  onStartSpeaking?: (sentence: string) => void;
  onFinishedAll?: () => void;
  onInterrupted?: () => void;
}

export class StreamingSpeechQueue {
  private buffer: string = '';
  private queue: string[] = [];
  private isPlaying: boolean = false;
  private currentSentence: string = '';
  private options: StreamingSpeechQueueOptions;
  private isCancelled: boolean = false;

  constructor(options: StreamingSpeechQueueOptions = {}) {
    this.options = options;
  }

  /**
   * Pushes a new token/text chunk from the LLM SSE stream.
   * Splits into completed sentences and plays them sequentially.
   */
  public push(chunk: string): void {
    if (this.isCancelled) return;
    this.buffer += chunk;

    // Look for sentence terminators: . ? ! followed by whitespace or newline
    // Or double newline paragraphs
    const sentenceEndRegex = /([.?!]+(?:\s+|\n)|(?:\n\n+)|(?::\n+))/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = sentenceEndRegex.exec(this.buffer)) !== null) {
      const sentence = this.buffer.slice(lastIndex, match.index + match[1].length).trim();
      lastIndex = match.index + match[1].length;

      if (sentence.length > 0) {
        const cleaned = cleanTextForSpeech(sentence);
        // Avoid queuing tiny isolated symbols
        if (cleaned.length >= 3) {
          this.queue.push(cleaned);
        }
      }
    }

    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    // If not currently playing and we have sentences ready, start immediately!
    if (!this.isPlaying && this.queue.length > 0) {
      this.playNext();
    }
  }

  /**
   * Called when the LLM stream is finished.
   * Flushes any remaining incomplete sentence in the buffer.
   */
  public flush(): void {
    if (this.isCancelled) return;
    const remaining = this.buffer.trim();
    this.buffer = '';

    if (remaining.length > 0) {
      const cleaned = cleanTextForSpeech(remaining);
      if (cleaned.length >= 2) {
        this.queue.push(cleaned);
      }
    }

    if (!this.isPlaying && this.queue.length > 0) {
      this.playNext();
    } else if (!this.isPlaying && this.queue.length === 0) {
      this.options.onFinishedAll?.();
    }
  }

  /**
   * Plays the next sentence in the queue.
   */
  private playNext(): void {
    if (this.isCancelled) return;

    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentSentence = '';
      this.options.onFinishedAll?.();
      return;
    }

    this.isPlaying = true;
    const nextSentence = this.queue.shift()!;
    this.currentSentence = nextSentence;

    this.options.onStartSpeaking?.(nextSentence);

    speakNaturalVoice(
      nextSentence,
      () => {
        // onStart
      },
      () => {
        // onEnd -> advance to next sentence in queue
        if (!this.isCancelled) {
          this.playNext();
        }
      },
      () => {
        // onError -> try next
        if (!this.isCancelled) {
          this.playNext();
        }
      }
    );
  }

  /**
   * Instantly stops playback and cancels the queue (e.g. for user barge-in).
   */
  public cancel(): void {
    this.isCancelled = true;
    this.isPlaying = false;
    this.queue = [];
    this.buffer = '';
    this.currentSentence = '';
    stopSpeaking();
    this.options.onInterrupted?.();
  }

  /**
   * Resets the queue state for a new turn.
   */
  public reset(): void {
    this.cancel();
    this.isCancelled = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentSentence(): string {
    return this.currentSentence;
  }
}
