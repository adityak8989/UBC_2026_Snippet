"use client";

import { licensedTimesLabel, useLicensedCount } from "@/lib/useSales";

/** "Licensed 3 times" for a clip, live from QuickNode Streams (lib/useSales.ts). Nothing while loading. */
export function LicensedCount({ clipIdBytes32, className = "" }: { clipIdBytes32: string; className?: string }) {
  const n = useLicensedCount(clipIdBytes32);
  if (n === undefined) return null;
  return <span className={className}>{licensedTimesLabel(n)}</span>;
}
