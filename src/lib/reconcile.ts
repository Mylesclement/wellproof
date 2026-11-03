// Reconciliation and trust score. Pure functions: numbers in, numbers out,
// no database. This file is the whole of the math behind a field's record.

import { SCORE } from "./scoring-config";

export type Step = { id: string; fromPointId: string; toPointId: string; limitPct: number };
// One day's volumes: point id -> barrels. A point with no reading is absent.
export type DayVolumes = Map<string, number>;

export type StepCheck =
  | { stepId: string; status: "ok" | "over"; lossPct: number }
  | { stepId: string; status: "missing" } // a number we needed was not reported
  | { stepId: string; status: "unchecked" }; // can't compute, but already flagged on another step

export type ComputedFlag = { date: string; stepId: string; type: "gap" | "missing"; lossPct: number | null };

// Percent of oil lost between two points. Negative means more arrived than left.
export function lossPct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((from - to) / from) * 100;
}

// Checks every step (handoff) for one day.
//
// Missing numbers: each missing number raises exactly one flag. A step is
// "missing" when its downstream point has no reading, and the first step is
// also "missing" when the wellhead has no reading.
//
// Out of range: a loss above the limit, or a gain above the limit (more oil
// arriving than left usually means a faulty meter).
export function checkDay(volumes: DayVolumes, steps: Step[]): StepCheck[] {
  return steps.map((s, i) => {
    const from = volumes.get(s.fromPointId);
    const to = volumes.get(s.toPointId);
    if (to == null || (i === 0 && from == null)) return { stepId: s.id, status: "missing" };
    if (from == null) return { stepId: s.id, status: "unchecked" };
    const loss = lossPct(from, to);
    if (loss == null) return { stepId: s.id, status: "unchecked" };
    return { stepId: s.id, status: Math.abs(loss) > s.limitPct ? "over" : "ok", lossPct: loss };
  });
}

export function flagsForDay(date: string, volumes: DayVolumes, steps: Step[]): ComputedFlag[] {
  return checkDay(volumes, steps).flatMap((c): ComputedFlag[] => {
    if (c.status === "missing") return [{ date, stepId: c.stepId, type: "missing", lossPct: null }];
    if (c.status === "over") return [{ date, stepId: c.stepId, type: "gap", lossPct: c.lossPct }];
    return [];
  });
}

export type ScoreInput = {
  dates: string[]; // every day in the period, including days with no readings at all
  pointIds: string[];
  steps: Step[];
  byDay: Map<string, DayVolumes>;
  openFlags: number; // flags in the period with no explanation yet
};

export type ScoreResult = {
  score: number;
  grade: string;
  completeness: number; // 0..1, readings present / readings expected
  withinRange: number; // 0..1, steps in range / steps that could be checked
  present: number;
  expected: number;
  checked: number;
  within: number;
  openFlags: number;
  penalty: number;
};

export function scoreRecord({ dates, pointIds, steps, byDay, openFlags }: ScoreInput): ScoreResult {
  let present = 0;
  let checked = 0;
  let within = 0;
  for (const date of dates) {
    const vols = byDay.get(date) ?? new Map();
    present += pointIds.filter((p) => vols.has(p)).length;
    for (const c of checkDay(vols, steps)) {
      if (c.status === "ok" || c.status === "over") checked++;
      if (c.status === "ok") within++;
    }
  }
  const expected = dates.length * pointIds.length;
  const completeness = expected ? present / expected : 0;
  // Nothing checkable means nothing proven, so it earns nothing.
  const withinRange = checked ? within / checked : 0;
  const penalty = Math.min(SCORE.maxPenalty, openFlags * SCORE.penaltyPerOpenFlag);
  const raw = SCORE.completenessWeight * completeness + SCORE.withinRangeWeight * withinRange - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const grade = SCORE.grades.find((g) => score >= g.min)!.label;
  return { score, grade, completeness, withinRange, present, expected, checked, within, openFlags, penalty };
}

// The calendar days in the scoring period: `days` full days ending the day before `today`.
export function periodDates(today: string, days: number = SCORE.periodDays): string[] {
  const out: string[] = [];
  const d = new Date(today + "T00:00:00Z");
  for (let i = days; i >= 1; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}
