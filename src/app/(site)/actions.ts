"use server";

import { parseInquiry, type InquiryKind } from "@/lib/inquiry";
import { createClient } from "@/lib/supabase/server";

// `values` holds every answer as a list, since checkboxes can have several.
export type InquiryResult = { ok: boolean; message: string; values?: Record<string, string[]> } | null;

export async function submitInquiry(kind: InquiryKind, _prev: InquiryResult, form: FormData): Promise<InquiryResult> {
  const get = (k: string) => String(form.get(k) ?? "");
  const getAll = (k: string) => form.getAll(k).map(String);
  const parsed = parseInquiry(kind, get, getAll);

  // Pretend a spam submission worked, so bots get no signal to adapt.
  if (!parsed.ok && parsed.spam) return { ok: true, message: "Thanks. We'll be in touch." };
  if (!parsed.ok) {
    const keys = [...new Set([...form.keys()].filter((k) => !k.startsWith("$")))];
    const values = Object.fromEntries(keys.map((k) => [k, getAll(k)]));
    return { ok: false, message: parsed.error, values };
  }

  const supabase = await createClient();
  // Insert only; the database has no read policy for this table, so we do
  // not ask for the row back.
  const { error } = await supabase.from("inquiries").insert(parsed.row);
  if (error) {
    console.error("inquiry insert failed", error);
    return { ok: false, message: "Something went wrong saving that. Please try again in a minute." };
  }
  return {
    ok: true,
    message: kind === "contact" ? "Thanks, your message is in. We'll reply by email." : "Thanks for signing up. We'll email you about next steps.",
  };
}
