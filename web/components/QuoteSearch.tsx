"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { formatTime, searchTranscripts } from "@/lib/captions";
import { LISTED_CLIPS, getClipById } from "@/lib/clips";
import { getCreator } from "@/lib/creators";
import { contentTypeLabel } from "@/lib/rights";
import { searchClips } from "@/lib/search";

const EXAMPLES = ["Valorant", "SpaceLofi", "just go do it"];

/**
 * "Search clips or what's said": matching clips (title, game, publisher, creator, content type,
 * description) link to the clip page; quotes found in the ElevenLabs transcripts jump to that moment.
 */
export function QuoteSearch() {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const clips = useMemo(() => searchClips(query, LISTED_CLIPS), [query]);
  const quotes = useMemo(() => searchTranscripts(query, LISTED_CLIPS.map((c) => c.id)).slice(0, 8), [query]);
  const searching = query.trim().length > 0;

  return (
    <section aria-labelledby={`${inputId}-label`} className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <label id={`${inputId}-label`} htmlFor={inputId} className="font-display text-sm font-semibold">
        Search clips or what&apos;s said
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try a game, creator or quote"
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
              {ex === "just go do it" ? `“${ex}”` : ex}
            </button>
          ))}
        </div>
      ) : clips.length === 0 && quotes.length === 0 ? (
        <p className="text-sm text-muted" role="status">
          No clips or quotes match
        </p>
      ) : (
        <div className="flex flex-col gap-3" role="status">
          {clips.length > 0 && (
            <ResultGroup title="Clips">
              {clips.map((clip) => {
                const creator = getCreator(clip);
                return (
                  <li key={clip.id}>
                    <Link href={`/clips/${clip.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                      <span className="aspect-video w-16 shrink-0 overflow-hidden rounded bg-black">
                        {clip.posterUrl && (
                          // Small static poster; next/image would add nothing here.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={clip.posterUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold">{clip.title}</span>
                        <span className="truncate text-xs text-muted">
                          {clip.show}
                          {creator ? ` · ${creator.name}` : ""} · {contentTypeLabel(clip)}
                        </span>
                      </span>
                      <span aria-hidden="true" className="ml-auto shrink-0 text-primary-text">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ResultGroup>
          )}

          {quotes.length > 0 && (
            <ResultGroup title="Said in clips">
              {quotes.map((r) => {
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
            </ResultGroup>
          )}
        </div>
      )}
    </section>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</ul>
    </div>
  );
}
