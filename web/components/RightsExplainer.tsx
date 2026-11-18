// "How rights work" on the homepage: what each content type (lib/rights.ts, clips.json contentType) allows.

const USES = ["Editorial", "Social", "Commercial"] as const;

const ROWS = [
  {
    title: "Original content",
    examples: "Podcasts, talks",
    text: "The creator owns everything in the clip, so all three uses are available.",
    locked: [] as string[],
    icon: (
      // microphone
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0M12 17v4m-3 0h6" />
    ),
  },
  {
    title: "Gameplay",
    examples: "Streams, game clips",
    text: "The creator owns the commentary and play; the game publisher owns the footage.",
    locked: ["Commercial"],
    icon: (
      // game controller
      <path d="M7 9h10a4 4 0 0 1 3.9 4.9l-.6 2.6a2 2 0 0 1-3.5.8L15 15H9l-1.8 2.3a2 2 0 0 1-3.5-.8l-.6-2.6A4 4 0 0 1 7 9Zm1 2v3m-1.5-1.5h3M15.5 12h.01M17.5 13.5h.01" />
    ),
  },
];

export function RightsExplainer() {
  return (
    <section aria-labelledby="how-rights-work" className="flex flex-col gap-3">
      <h2 id="how-rights-work" className="font-display text-lg font-bold">
        How rights work
      </h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {ROWS.map((row) => (
          <li key={row.title} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary-text">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {row.icon}
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {row.title} <span className="font-normal text-muted">· {row.examples}</span>
                </p>
                <p className="text-xs text-muted">{row.text}</p>
              </div>
            </div>
            <ul className="flex shrink-0 gap-1.5 pl-12 sm:pl-0" aria-label={`Uses available for ${row.title}`}>
              {USES.map((use) => {
                const locked = row.locked.includes(use);
                return (
                  <li
                    key={use}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                      locked ? "border-dashed border-line text-muted" : "border-success/40 bg-success/10 text-success"
                    }`}
                    title={locked ? "Needs the game publisher’s permission" : undefined}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 fill-current">
                      {locked ? (
                        <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
                      ) : (
                        <path d="M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6.6 9.6l5.3-5.3a1 1 0 0 1 1.4 0Z" />
                      )}
                    </svg>
                    {use}
                    <span className="sr-only">{locked ? " locked" : " available"}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
