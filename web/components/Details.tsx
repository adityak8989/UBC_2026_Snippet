"use client";

import { useState } from "react";

/** Technical details (addresses, transaction and file hashes, explorer links) folded behind "Show details". */
export function Details({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
      >
        <span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
        {open ? "Hide details" : "Show details"}
      </button>
      {open && <div className="mt-3 flex flex-col gap-3 text-xs">{children}</div>}
    </div>
  );
}
