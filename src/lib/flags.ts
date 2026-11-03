// Keeps the saved flags in step with the readings, without ever deleting one.
//
// diffFlags is pure (tested on its own). syncFlags loads data, calls the math
// in reconcile.ts and diffFlags, and writes the result.

import type { SupabaseClient } from "@supabase/supabase-js";
import { flagsForDay, type ComputedFlag, type DayVolumes, type Step } from "./reconcile";

export type FlagStatus = "open" | "explained" | "cleared";

export type SavedFlag = {
  id: string;
  flag_date: string;
  step_id: string;
  type: "gap" | "missing";
  loss_pct: number | null;
  status: FlagStatus;
  hasNotes: boolean;
};

export type FlagInsert = { flag_date: string; step_id: string; type: "gap" | "missing"; loss_pct: number | null; status: "open" };
export type FlagUpdate = { id: string; type: "gap" | "missing"; loss_pct: number | null; status: FlagStatus };

const key = (date: string, stepId: string) => `${date}|${stepId}`;
const round3 = (n: number | null) => (n == null ? null : Math.round(n * 1000) / 1000);

// New problem             -> insert as open
// Problem still there      -> keep status (refresh the loss % if it changed)
// Problem came back        -> cleared becomes open again, or explained if it already has a note
// Problem gone             -> mark cleared (the row and its notes stay)
export function diffFlags(saved: SavedFlag[], computed: ComputedFlag[]): { inserts: FlagInsert[]; updates: FlagUpdate[] } {
  const savedByKey = new Map(saved.map((f) => [key(f.flag_date, f.step_id), f]));
  const computedKeys = new Set<string>();
  const inserts: FlagInsert[] = [];
  const updates: FlagUpdate[] = [];

  for (const c of computed) {
    const k = key(c.date, c.stepId);
    computedKeys.add(k);
    const s = savedByKey.get(k);
    const loss = round3(c.lossPct);
    if (!s) {
      inserts.push({ flag_date: c.date, step_id: c.stepId, type: c.type, loss_pct: loss, status: "open" });
      continue;
    }
    const status: FlagStatus = s.status === "cleared" ? (s.hasNotes ? "explained" : "open") : s.status;
    if (status !== s.status || c.type !== s.type || loss !== round3(s.loss_pct)) {
      updates.push({ id: s.id, type: c.type, loss_pct: loss, status });
    }
  }

  for (const s of saved) {
    if (!computedKeys.has(key(s.flag_date, s.step_id)) && s.status !== "cleared") {
      updates.push({ id: s.id, type: s.type, loss_pct: s.loss_pct, status: "cleared" });
    }
  }

  return { inserts, updates };
}

// Loads a field's chain and current readings into the shapes reconcile.ts uses.
export async function loadFieldData(db: SupabaseClient, fieldId: string) {
  const [{ data: points }, { data: stepRows }, { data: readings }] = await Promise.all([
    db.from("measurement_points").select("id, name, position").eq("field_id", fieldId).order("position"),
    db.from("steps").select("id, from_point_id, to_point_id, loss_limit_pct, normal_cause").eq("field_id", fieldId),
    db.from("current_readings").select("point_id, reading_date, volume_bbl").eq("field_id", fieldId),
  ]);
  const pointIds = (points ?? []).map((p) => p.id as string);
  // Put steps in chain order, following the points.
  const steps: (Step & { normalCause: string | null })[] = pointIds
    .map((pid) => stepRows?.find((s) => s.from_point_id === pid))
    .filter((s) => s != null)
    .map((s) => ({
      id: s.id,
      fromPointId: s.from_point_id,
      toPointId: s.to_point_id,
      limitPct: Number(s.loss_limit_pct),
      normalCause: s.normal_cause,
    }));
  const byDay = new Map<string, DayVolumes>();
  for (const r of readings ?? []) {
    if (!byDay.has(r.reading_date)) byDay.set(r.reading_date, new Map());
    byDay.get(r.reading_date)!.set(r.point_id, Number(r.volume_bbl));
  }
  return { points: points ?? [], pointIds, steps, byDay };
}

// Recomputes flags for every day that has at least one reading. A day with no
// readings at all lowers completeness in the score but raises no flags, so
// old days before a field went live don't fill the list with noise.
export async function syncFlags(db: SupabaseClient, fieldId: string) {
  const { steps, byDay } = await loadFieldData(db, fieldId);
  const computed = [...byDay.entries()].flatMap(([date, vols]) => flagsForDay(date, vols, steps));

  const { data: rows, error } = await db
    .from("flags")
    .select("id, flag_date, step_id, type, loss_pct, status, flag_notes(id)")
    .eq("field_id", fieldId);
  if (error) throw new Error(error.message);
  const saved: SavedFlag[] = (rows ?? []).map((r) => ({
    id: r.id,
    flag_date: r.flag_date,
    step_id: r.step_id,
    type: r.type,
    loss_pct: r.loss_pct == null ? null : Number(r.loss_pct),
    status: r.status,
    hasNotes: (r.flag_notes as unknown[]).length > 0,
  }));

  const { inserts, updates } = diffFlags(saved, computed);
  if (inserts.length) {
    const { error: e } = await db.from("flags").insert(inserts.map((i) => ({ ...i, field_id: fieldId })));
    if (e) throw new Error(e.message);
  }
  for (const u of updates) {
    const { error: e } = await db
      .from("flags")
      .update({ type: u.type, loss_pct: u.loss_pct, status: u.status, updated_at: new Date().toISOString() })
      .eq("id", u.id);
    if (e) throw new Error(e.message);
  }
  return { inserted: inserts.length, updated: updates.length };
}
