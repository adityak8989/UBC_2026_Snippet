import { TRANSCRIPTS } from "./transcripts/manifest";

// Transcripts come from ElevenLabs Speech to Text (scripts/transcribe.mjs), one JSON file per clip in
// lib/transcripts/. Times are seconds from the start of the master file; previews share its timeline.
export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "audio_event";
}

export interface Transcript {
  clipId: string;
  fileHash: string; // sha256 of the transcribed master, the clip's on-chain fileHash
  model: string;
  language: string | null;
  languageProbability: number | null;
  hasSpeech: boolean;
  text: string;
  words: TranscriptWord[];
}

/** The clip's transcript and the sha256 of its JSON file, or undefined if it has none. */
export function getTranscript(clipId: string) {
  return TRANSCRIPTS[clipId];
}

/** Transcript only when it contains speech: clips with no speech show no captions or transcript. */
export function getSpokenTranscript(clipId: string): Transcript | undefined {
  const t = TRANSCRIPTS[clipId]?.transcript;
  return t?.hasSpeech ? t : undefined;
}

export interface Cue {
  start: number;
  end: number;
  words: TranscriptWord[];
}

/** Groups words into caption lines: a new line after a pause, at the end of a sentence, or every 8 words. */
export function buildCues(words: TranscriptWord[]): Cue[] {
  const cues: Cue[] = [];
  let current: TranscriptWord[] = [];
  const flush = () => {
    if (current.length) cues.push({ start: current[0].start, end: current[current.length - 1].end, words: current });
    current = [];
  };
  for (const w of words) {
    const prev = current[current.length - 1];
    const pause = prev && w.start - prev.end > 0.8;
    const sentenceEnd = prev && /[.!?]$/.test(prev.text) && current.length >= 3;
    // Audio events ([laughs], [gunshots]) get their own line.
    if (pause || sentenceEnd || current.length >= 8 || w.type === "audio_event" || prev?.type === "audio_event") flush();
    current.push(w);
  }
  flush();
  return cues;
}

/** "0:07" */
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface QuoteMatch {
  clipId: string;
  start: number; // seconds: where the quote starts in the clip
  end: number;
  before: string; // a few words of context
  match: string;
  after: string;
}

/** Finds `query` as a run of consecutive spoken words in each clip's transcript (case and punctuation ignored). */
export function searchTranscripts(query: string, clipIds: string[]): QuoteMatch[] {
  const q = normalize(query).split(" ").filter(Boolean);
  if (q.length === 0) return [];
  const results: QuoteMatch[] = [];
  for (const clipId of clipIds) {
    const t = getSpokenTranscript(clipId);
    if (!t) continue;
    const words = t.words.filter((w) => w.type === "word");
    const norm = words.map((w) => normalize(w.text));
    for (let i = 0; i + q.length <= words.length; i++) {
      // Every query word must equal the transcript word, except the last, which may be a prefix (typing).
      const hit = q.every((qw, j) => (j === q.length - 1 ? norm[i + j].startsWith(qw) : norm[i + j] === qw));
      if (!hit) continue;
      const text = (a: number, b: number) => words.slice(Math.max(0, a), b).map((w) => w.text).join(" ");
      results.push({
        clipId,
        start: words[i].start,
        end: words[i + q.length - 1].end,
        before: text(i - 4, i),
        match: text(i, i + q.length),
        after: text(i + q.length, i + q.length + 4),
      });
    }
  }
  return results;
}
