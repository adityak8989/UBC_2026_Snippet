// "Submit a clip" (/submit): the shape of a submission, its validation (the same limits as the database
// checks in supabase/clip_submissions.sql), and our listing rules for the Snippet Ops Bot.

export interface SubmissionInput {
  creatorName: string;
  title: string;
  show: string; // game or show
  publisher?: string;
  contentType: "gameplay" | "original";
  videoUrl: string;
  lengthSeconds: number;
  rightsConfirmed: boolean;
}

/** Returns a cleaned submission, or the first problem as a short message for the form. */
export function validateSubmission(raw: unknown): { ok: true; value: SubmissionInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const creatorName = text(r.creatorName);
  const title = text(r.title);
  const show = text(r.show);
  const publisher = text(r.publisher);
  const videoUrl = text(r.videoUrl);
  const lengthSeconds = Number(r.lengthSeconds);
  if (creatorName.length < 1 || creatorName.length > 60) return { ok: false, error: "Add your creator name (up to 60 characters)." };
  if (title.length < 1 || title.length > 80) return { ok: false, error: "Add a clip title (up to 80 characters)." };
  if (show.length < 1 || show.length > 80) return { ok: false, error: "Add the game or show (up to 80 characters)." };
  if (publisher.length > 80) return { ok: false, error: "Keep the publisher under 80 characters." };
  if (r.contentType !== "gameplay" && r.contentType !== "original") return { ok: false, error: "Choose Gameplay or Original." };
  try {
    const u = new URL(videoUrl);
    if (!/^https?:$/.test(u.protocol) || videoUrl.length > 500) throw new Error();
  } catch {
    return { ok: false, error: "Add a video link that starts with https://" };
  }
  if (!Number.isInteger(lengthSeconds) || lengthSeconds < 1 || lengthSeconds > 600) {
    return { ok: false, error: "Length must be a whole number of seconds (clips we list are 5 to 60)." };
  }
  if (r.rightsConfirmed !== true) return { ok: false, error: "Please confirm you own this clip or have the rights to sell it." };
  return {
    ok: true,
    value: {
      creatorName,
      title,
      show,
      ...(publisher ? { publisher } : {}),
      contentType: r.contentType,
      videoUrl,
      lengthSeconds,
      rightsConfirmed: true,
    },
  };
}

/** Our listing rules, served to the ops bot with the submissions (/api/ops/submissions). */
export const LISTING_RULES = {
  contentTypes: {
    gameplay: "Gameplay: the game footage belongs to its publisher, so Commercial is not for sale (price 0, the contract refuses it). Editorial and Social only. A publisher is required.",
    original: "Original: the creator owns everything in the clip, so all three uses are for sale (Editorial, Social, Commercial).",
  },
  titleRequired: true,
  lengthSeconds: { min: 5, max: 60 },
  defaultPricesUsdc: { gameplay: { editorial: 5, social: 15, commercial: 0 }, original: { editorial: 5, social: 15, commercial: 50 } },
  defaultSplitBps: {
    noContributor: { rightsHolder: 9000, contributor: 0, platform: 1000 },
    withContributor: { rightsHolder: 7000, contributor: 2000, platform: 1000 },
  },
  rightsConfirmationRequired: true,
  approval: "A human reviews and lists every clip with npm run add-clip and the ListClips script. The bot only proposes; it never holds keys or lists clips.",
} as const;
