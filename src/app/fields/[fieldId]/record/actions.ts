"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NoteResult = { ok: boolean; message: string } | null;

// Adds an explanation to a flag. Notes are append-only (the database blocks
// edits and deletes), so a later note adds to the story instead of rewriting it.
export async function addNote(fieldId: string, flagId: string, _prev: NoteResult, form: FormData): Promise<NoteResult> {
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 10) return { ok: false, message: "Write at least a sentence: what happened, and what was done about it." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You are signed out. Sign in again." };

  const { error } = await supabase.from("flag_notes").insert({ flag_id: flagId, body, created_by: user.id });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Your account can view flags but not explain them." };
    return { ok: false, message: error.message };
  }
  // An open flag becomes explained. A cleared flag stays cleared.
  await supabase.from("flags").update({ status: "explained", updated_at: new Date().toISOString() }).eq("id", flagId).eq("status", "open");

  revalidatePath(`/fields/${fieldId}/record`);
  return { ok: true, message: "Explanation added to the record." };
}
