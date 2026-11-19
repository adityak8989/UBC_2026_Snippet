"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { validateSubmission } from "@/lib/submissions";

// "Submit a clip": a creator proposes a clip. It is saved to clip_submissions for review (the Snippet Ops
// Bot drafts a listing proposal; a human approves and lists it). No email or personal data is collected.

const INPUT =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function SubmitPage() {
  const [form, setForm] = useState({
    creatorName: "",
    title: "",
    show: "",
    publisher: "",
    contentType: "" as "" | "gameplay" | "original",
    videoUrl: "",
    lengthSeconds: "",
    rightsConfirmed: false,
  });
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, lengthSeconds: Number(form.lengthSeconds), publisher: form.publisher || undefined };
    const checked = validateSubmission(payload);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Your submission could not be saved. Try again in a moment.");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Submit a clip</h1>
          <p className="mt-1 text-sm text-muted">
            Propose a short clip for Snippet. We review every submission before it is listed; nothing goes on sale
            automatically.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/40 bg-success/5 p-8 text-center" role="status">
            <p className="font-display text-xl font-bold text-success">Thanks, we&apos;ll review it</p>
            <p className="text-sm text-muted">If it fits our listing rules, we&apos;ll list it with you as the creator.</p>
            <Link href="/" className="mt-3 text-sm text-primary-text underline">
              Back to clips
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5" noValidate>
            <Field label="Creator name" htmlFor="creatorName">
              <input id="creatorName" className={INPUT} value={form.creatorName} onChange={set("creatorName")} maxLength={60} placeholder="The name buyers will see" />
            </Field>
            <Field label="Clip title" htmlFor="title">
              <input id="title" className={INPUT} value={form.title} onChange={set("title")} maxLength={80} placeholder="e.g. The Final Push" />
            </Field>
            <Field label="Game or show" htmlFor="show">
              <input id="show" className={INPUT} value={form.show} onChange={set("show")} maxLength={80} placeholder="e.g. Valorant, or your podcast's name" />
            </Field>
            <Field label="Publisher (optional)" htmlFor="publisher" hint="For gameplay: the company that owns the game, e.g. Riot Games.">
              <input id="publisher" className={INPUT} value={form.publisher} onChange={set("publisher")} maxLength={80} />
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold">Content type</legend>
              {(
                [
                  ["gameplay", "Gameplay", "Game footage you played. Editorial and Social only; Commercial needs the publisher's permission."],
                  ["original", "Original", "You own everything in it, like a podcast or a talk. All three uses."],
                ] as const
              ).map(([value, label, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${form.contentType === value ? "border-primary bg-primary/10" : "border-line"}`}
                >
                  <input
                    type="radio"
                    name="contentType"
                    value={value}
                    checked={form.contentType === value}
                    onChange={() => setForm((f) => ({ ...f, contentType: value }))}
                    className="mt-1 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="font-semibold">{label}</span>
                    <span className="block text-xs text-muted">{desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Field label="Video link" htmlFor="videoUrl" hint="Where we can watch the original file, e.g. a Drive or YouTube link.">
              <input id="videoUrl" type="url" inputMode="url" className={INPUT} value={form.videoUrl} onChange={set("videoUrl")} placeholder="https://" />
            </Field>
            <Field label="Length in seconds" htmlFor="lengthSeconds" hint="Clips we list are 5 to 60 seconds.">
              <input id="lengthSeconds" type="number" inputMode="numeric" min={1} max={600} className={INPUT} value={form.lengthSeconds} onChange={set("lengthSeconds")} />
            </Field>

            <label className="flex cursor-pointer gap-3 rounded-xl bg-surface-2 p-3 text-sm">
              <input type="checkbox" checked={form.rightsConfirmed} onChange={set("rightsConfirmed")} className="mt-0.5 accent-[var(--color-primary)]" required />
              <span>I own this clip or have the rights to sell it</span>
            </label>

            {error && (
              <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full cursor-pointer rounded-xl bg-primary-strong px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Submit for review"}
            </button>
            <p className="text-center text-[11px] text-muted">We don&apos;t ask for email or any personal data. Submissions are public.</p>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
