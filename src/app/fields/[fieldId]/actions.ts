"use server";

import { revalidatePath } from "next/cache";
import { planDay } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";
import { todayInField } from "@/lib/format";

// On a refused save, `values` sends back what was typed so the form can
// refill itself instead of losing the operator's work.
export type SaveResult = { ok: boolean; message: string; values?: Record<string, string> } | null;

export async function saveDay(fieldId: string, date: string, _prev: SaveResult, form: FormData): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You are signed out. Sign in again." };

  const [{ data: points }, { data: existing }] = await Promise.all([
    supabase.from("measurement_points").select("id, name").eq("field_id", fieldId).order("position"),
    supabase.from("current_readings").select("id, point_id, volume_bbl").eq("field_id", fieldId).eq("reading_date", date),
  ]);
  if (!points?.length) return { ok: false, message: "Field not found." };

  const submitted = Object.fromEntries(points.map((p) => [p.id, String(form.get(`point-${p.id}`) ?? "")]));
  const values = { ...submitted, reason: String(form.get("reason") ?? "") };
  const plan = planDay({
    date,
    today: todayInField(),
    points,
    existing: existing ?? [],
    submitted,
    reason: String(form.get("reason") ?? ""),
  });
  if (!plan.ok) return { ok: false, message: plan.error, values };

  // One insert for all rows, so it all saves or none of it does. The database
  // still checks permissions (RLS) and the version chain (trigger) itself.
  const { error } = await supabase.from("readings").insert(
    plan.inserts.map((i) => ({ ...i, field_id: fieldId, reading_date: date, source: "manual", created_by: user.id })),
  );
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Your account can view this field but not enter readings.", values };
    return { ok: false, message: error.message, values };
  }

  revalidatePath(`/fields/${fieldId}`);
  const n = plan.inserts.length;
  const corrected = plan.inserts.filter((i) => i.supersedes_id).length;
  return {
    ok: true,
    message: `Saved ${n} reading${n > 1 ? "s" : ""}${corrected ? `, ${corrected} as correction${corrected > 1 ? "s" : ""}` : ""}.`,
  };
}
