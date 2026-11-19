import { createClient } from "@supabase/supabase-js";
import { validateSubmission } from "@/lib/submissions";

// POST /api/submissions: saves a "Submit a clip" proposal to clip_submissions (supabase/clip_submissions.sql).
// Inserts with the publishable key, which Row Level Security limits to adding pending rows; the database
// checks repeat these limits. No email or personal data is collected.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  }
  const checked = validateSubmission(body);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "Submissions are not available right now." }, { status: 503 });

  const s = checked.value;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("clip_submissions").insert({
    creator_name: s.creatorName,
    title: s.title,
    show: s.show,
    publisher: s.publisher ?? null,
    content_type: s.contentType,
    video_url: s.videoUrl,
    length_seconds: s.lengthSeconds,
    rights_confirmed: s.rightsConfirmed,
  });
  if (error) {
    console.error("submissions: insert failed", error.code, error.message);
    return Response.json({ error: "Your submission could not be saved. Try again in a moment." }, { status: 502 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
