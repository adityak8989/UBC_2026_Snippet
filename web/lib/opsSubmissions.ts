import "server-only";
import { createClient } from "@supabase/supabase-js";
import { OPS_TIMEZONE } from "./opsSales";
import { LISTING_RULES } from "./submissions";

// Ops data feed for the Snippet Ops Bot: the latest "Submit a clip" proposals and our listing rules, as JSON
// (/api/ops/submissions) and plain text (/api/ops/submissions.txt). Each submission comes with the issues it
// has against the rules and the defaults it would be listed with, so the bot can draft a proposal for a
// human to approve. Public and read only.

const LIMIT = 50;

export interface OpsSubmission {
  id: string;
  submittedAt: string; // ISO 8601, UTC
  status: string;
  creatorName: string;
  title: string;
  show: string;
  publisher: string | null;
  contentType: "gameplay" | "original";
  videoUrl: string;
  lengthSeconds: number;
  rightsConfirmed: boolean;
  issues: string[]; // problems against the listing rules; empty = ready to propose
  proposedPricesUsdc: { editorial: number; social: number; commercial: number };
  proposedSplitBps: { rightsHolder: number; contributor: number; platform: number };
}

export interface OpsSubmissions {
  generatedAt: string;
  available: boolean; // false if the clip_submissions table can't be read (see supabase/clip_submissions.sql)
  submissions: OpsSubmission[];
  rules: typeof LISTING_RULES;
}

interface Row {
  id: number | string;
  created_at: string;
  status: string;
  creator_name: string;
  title: string;
  show: string;
  publisher: string | null;
  content_type: "gameplay" | "original";
  video_url: string;
  length_seconds: number;
  rights_confirmed: boolean;
}

function issuesFor(r: Row): string[] {
  const issues: string[] = [];
  const { min, max } = LISTING_RULES.lengthSeconds;
  if (!r.title.trim()) issues.push("Title is required.");
  if (r.length_seconds < min || r.length_seconds > max) issues.push(`Length ${r.length_seconds} s is outside ${min} to ${max} s.`);
  if (r.content_type === "gameplay" && !r.publisher) issues.push("Gameplay clips need the game publisher.");
  if (!r.rights_confirmed) issues.push("Rights were not confirmed.");
  return issues;
}

export async function getOpsSubmissions(): Promise<OpsSubmissions> {
  const base = { generatedAt: new Date().toISOString(), rules: LISTING_RULES };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ...base, available: false, submissions: [] };
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("clip_submissions")
    .select("id, created_at, status, creator_name, title, show, publisher, content_type, video_url, length_seconds, rights_confirmed")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.warn("ops: clip_submissions unavailable", error.code);
    return { ...base, available: false, submissions: [] };
  }
  return {
    ...base,
    available: true,
    submissions: (data as Row[]).map((r) => ({
      id: String(r.id),
      submittedAt: new Date(r.created_at).toISOString(),
      status: r.status,
      creatorName: r.creator_name,
      title: r.title,
      show: r.show,
      publisher: r.publisher,
      contentType: r.content_type,
      videoUrl: r.video_url,
      lengthSeconds: r.length_seconds,
      rightsConfirmed: r.rights_confirmed,
      issues: issuesFor(r),
      proposedPricesUsdc: { ...LISTING_RULES.defaultPricesUsdc[r.content_type] },
      proposedSplitBps: { ...LISTING_RULES.defaultSplitBps.noContributor },
    })),
  };
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: OPS_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

/** The rules first, then one line per submission. */
export function opsSubmissionsText(data: OpsSubmissions): string {
  const r = data.rules;
  const p = r.defaultPricesUsdc;
  const sNo = r.defaultSplitBps.noContributor;
  const sWith = r.defaultSplitBps.withContributor;
  const lines = [
    `Snippet clip submissions · generated ${data.generatedAt}`,
    "",
    "LISTING RULES",
    `1. ${r.contentTypes.gameplay}`,
    `2. ${r.contentTypes.original}`,
    "3. A title is required.",
    `4. Length must be ${r.lengthSeconds.min} to ${r.lengthSeconds.max} seconds.`,
    `5. Default prices in USDC (Editorial / Social / Commercial): gameplay ${p.gameplay.editorial} / ${p.gameplay.social} / ${p.gameplay.commercial} (not for sale), original ${p.original.editorial} / ${p.original.social} / ${p.original.commercial}.`,
    `6. Default split in basis points (rights holder / contributor / platform): ${sNo.rightsHolder} / ${sNo.contributor} / ${sNo.platform} with no contributor, or ${sWith.rightsHolder} / ${sWith.contributor} / ${sWith.platform} with a contributor.`,
    "7. The creator must confirm they own the clip or have the rights to sell it.",
    `8. ${r.approval}`,
    "",
  ];
  if (!data.available) {
    lines.push("SUBMISSIONS: unavailable right now.");
  } else {
    lines.push(`SUBMISSIONS (${data.submissions.length}, newest first)`);
    if (data.submissions.length === 0) lines.push("No submissions yet.");
    for (const s of data.submissions) {
      const show = s.publisher ? `${s.show} (${s.publisher})` : s.show;
      const issues = s.issues.length ? `issues: ${s.issues.join(" ")}` : "ready to propose";
      const rights = s.rightsConfirmed ? "rights confirmed" : "rights NOT confirmed";
      lines.push(
        `#${s.id} · ${when(s.submittedAt)} · ${s.status} · "${s.title}" by ${s.creatorName} · ${show} · ${s.contentType === "gameplay" ? "Gameplay" : "Original"} · ${s.lengthSeconds} s · ${rights} · ${s.videoUrl} · ${issues}`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
