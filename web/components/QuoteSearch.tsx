"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { formatTime, searchTranscripts } from "@/lib/captions";
import { LISTED_CLIPS, getClipById } from "@/lib/clips";

const EXAMPLES = ["just go do it", "losing to", "oh my god"];

/** "Search what's said": finds a quote in every listed clip's ElevenLabs transcript and links to that moment. */
export function QuoteSearch() {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const results = useMemo(
    () => searchTranscripts(query, LISTED_CLIPS.map((c) => c.id)).slice(0, 8),
    [query],
  );
  const searching = query.trim().length > 0;

  return (
    <section aria-labelledby={`${inputId}-label`} className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <label id={`${inputId}-label`} htmlFor={inputId} className="font-display text-sm font-semibold">
        Search what&apos;s said
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a quote, e.g. “just go do it”"
        autoComplete="off"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {!searching ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              className="cursor-pointer rounded-full border border-line px-2.5 py-1 hover:border-muted/60 hover:text-ink"
            >
              “{ex}”
            </button>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted" role="status">
          Nobody says “{query.trim()}” in these clips.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" role="status">
          {results.map((r) => {
            const clip = getClipById(r.clipId)!;
            return (
              <li key={`${r.clipId}-${r.start}`}>
                <Link
                  href={`/clips/${r.clipId}?t=${r.start}&end=${r.end}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                    {formatTime(r.start)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm">
                      {r.before && <span className="text-muted">…{r.before} </span>}
                      <mark className="rounded bg-primary/20 px-0.5 font-semibold text-ink">{r.match}</mark>
                      {r.after && <span className="text-muted"> {r.after}…</span>}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {clip.title} · {clip.show}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
