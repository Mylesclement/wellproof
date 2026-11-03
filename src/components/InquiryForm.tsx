"use client";

import { useActionState } from "react";
import { submitInquiry, type InquiryResult } from "@/app/(site)/actions";
import { TRACKS, type InquiryKind } from "@/lib/inquiry";

const field = "flex flex-col gap-1 text-sm font-semibold";

export function InquiryForm({ kind }: { kind: InquiryKind }) {
  const [result, action, pending] = useActionState<InquiryResult, FormData>(submitInquiry.bind(null, kind), null);
  const track = kind === "contact" ? null : TRACKS[kind];
  // After a refused submit, refill what was typed (React clears the form).
  const typed = result?.ok === false ? result.values : undefined;
  const v = (k: string) => typed?.[k]?.[0] ?? "";

  if (result?.ok) {
    return (
      <div role="status" className="panel border-ok bg-ok-soft text-ok font-semibold">
        {result.message}
      </div>
    );
  }

  return (
    // A new key after each refused submit rebuilds the form, so every box,
    // dropdown and checkbox shows what was typed.
    <form key={JSON.stringify(typed ?? {})} action={action} className="panel">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        <label className={field}>
          Name
          <input className="input font-sans" name="name" autoComplete="name" required maxLength={120} defaultValue={v("name")} />
        </label>
        <label className={field}>
          Email
          <input className="input font-sans" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={v("email")} />
        </label>
        <label className={field}>
          Organization <small className="font-normal text-muted">Optional</small>
          <input className="input font-sans" name="organization" autoComplete="organization" maxLength={160} defaultValue={v("organization")} />
        </label>
        <label className={field}>
          Your role <small className="font-normal text-muted">Optional</small>
          <input className="input font-sans" name="role" autoComplete="organization-title" maxLength={120} defaultValue={v("role")} />
        </label>
        <label className={field}>
          Country <small className="font-normal text-muted">Optional</small>
          <input className="input font-sans" name="country" autoComplete="country-name" maxLength={80} defaultValue={v("country")} />
        </label>
        {track?.questions.map((q) =>
          q.type === "select" ? (
            <label key={q.key} className={field}>
              {q.label}
              <select className="input font-sans" name={q.key} required={q.required} defaultValue={v(q.key)}>
                <option value="">Choose one</option>
                {q.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ) : (
            <fieldset key={q.key} className="flex flex-col gap-1 text-sm">
              <legend className="font-semibold mb-1">{q.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {q.options.map((o) => (
                  <label key={o} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name={q.key}
                      value={o}
                      defaultChecked={typed?.[q.key]?.includes(o)}
                      className="accent-[var(--accent)]"
                    />
                    {o}
                  </label>
                ))}
              </div>
            </fieldset>
          ),
        )}
      </div>
      <label className={field}>
        {track ? track.messageLabel : "Message"}
        {track && <small className="font-normal text-muted">Optional</small>}
        <textarea className="input font-sans min-h-[96px]" name="message" rows={4} maxLength={4000} required={!track} defaultValue={v("message")} />
      </label>
      {/* Spam trap: hidden from people, filled in by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Sending…" : track ? "Join the pilot" : "Send message"}
        </button>
        {result && !result.ok && (
          <p role="alert" className="text-bad font-semibold">
            {result.message}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">We use these details only to reply to you. We don&apos;t share them.</p>
    </form>
  );
}
