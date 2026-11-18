"use client";

import { Fragment, useEffect, useMemo, useState, type RefObject } from "react";
import { buildCues, formatTime, type Transcript, type TranscriptWord } from "@/lib/captions";

/** The video's current time, updated every animation frame while it plays (timeupdate alone is ~4 Hz). */
function useVideoTime(videoRef: RefObject<HTMLVideoElement | null>) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let frame = 0;
    const tick = () => {
      setTime(video.currentTime);
      if (!video.paused && !video.ended) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const events = ["play", "seeked", "timeupdate", "loadedmetadata"] as const;
    events.forEach((e) => video.addEventListener(e, start));
    return () => {
      cancelAnimationFrame(frame);
      events.forEach((e) => video.removeEventListener(e, start));
    };
  }, [videoRef]);
  return time;
}

/**
 * Captions under the video, synced word by word to the ElevenLabs timestamps, and a "Transcript" toggle
 * with the full text (click a word to jump there). Renders nothing for clips without speech.
 * `highlight` marks a quote that was searched for (seconds range).
 */
export function SyncedCaptions({
  transcript,
  videoRef,
  highlight,
}: {
  transcript: Transcript | undefined;
  videoRef: RefObject<HTMLVideoElement | null>;
  highlight?: { start: number; end: number };
}) {
  const time = useVideoTime(videoRef);
  const [showTranscript, setShowTranscript] = useState(false);
  const cues = useMemo(() => (transcript?.hasSpeech ? buildCues(transcript.words) : []), [transcript]);

  if (!transcript?.hasSpeech || cues.length === 0) return null;

  // The line on screen: the latest one that has started, held for 1.5 s after it ends.
  const index = cues.findLastIndex((c) => c.start <= time + 0.05);
  const cue = index >= 0 && time <= cues[index].end + 1.5 ? cues[index] : undefined;

  const seek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
    video.play().catch(() => {});
  };

  const wordClass = (w: TranscriptWord) => {
    const active = w.start <= time && time < w.end;
    const spoken = w.end <= time;
    const searched = highlight && w.start >= highlight.start - 0.01 && w.end <= highlight.end + 0.01;
    return [
      "rounded px-0.5 transition-colors",
      w.type === "audio_event" ? "italic" : "",
      active ? "bg-primary text-white" : spoken ? "text-ink" : "text-muted",
      searched && !active ? "underline decoration-primary decoration-2 underline-offset-4" : "",
    ].join(" ");
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Live captions */}
      <div
        className="flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface px-4 py-3 text-center"
        aria-live="off"
      >
        {cue ? (
          <p className="font-display text-lg leading-snug sm:text-xl">
            {cue.words.map((w, i) => (
              <span key={`${w.start}-${i}`} className={wordClass(w)}>
                {w.text}{" "}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-muted">{time === 0 ? "Press play: captions follow the speech." : "…"}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Captions and transcript by ElevenLabs Speech to Text</span>
        <button
          type="button"
          onClick={() => setShowTranscript((s) => !s)}
          aria-expanded={showTranscript}
          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 font-semibold text-ink hover:border-muted/60"
        >
          {showTranscript ? "Hide transcript" : "Transcript"}
        </button>
      </div>

      {showTranscript && (
        <ol className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4 text-sm">
          {cues.map((c, ci) => (
            <li key={ci} className="flex gap-3">
              <button
                type="button"
                onClick={() => seek(c.start)}
                className="shrink-0 cursor-pointer font-mono text-xs leading-6 text-muted hover:text-primary-text"
                aria-label={`Play from ${formatTime(c.start)}`}
              >
                {formatTime(c.start)}
              </button>
              <p className="leading-6">
                {c.words.map((w, i) => (
                  <Fragment key={`${w.start}-${i}`}>
                    <button type="button" onClick={() => seek(w.start)} className={`cursor-pointer ${wordClass(w)}`}>
                      {w.text}
                    </button>{" "}
                  </Fragment>
                ))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
