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
