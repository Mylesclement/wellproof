import { describe, expect, it } from "vitest";
import { planDay } from "./readings";

const points = [
  { id: "well", name: "Wellhead allocation" },
  { id: "term", name: "Terminal receipt" },
];
const base = { date: "2026-11-01", today: "2026-11-03", points, existing: [], reason: "" };

describe("planDay", () => {
  it("adds new readings as version 1", () => {
    const plan = planDay({ ...base, submitted: { well: "2,410", term: "2341" } });
    expect(plan).toEqual({
      ok: true,
      inserts: [
        { point_id: "well", volume_bbl: 2410, supersedes_id: null, reason: null },
        { point_id: "term", volume_bbl: 2341, supersedes_id: null, reason: null },
      ],
    });
  });

  it("lets a late report fill one missing point", () => {
    const existing = [{ id: "r1", point_id: "well", volume_bbl: 2410 }];
    const plan = planDay({ ...base, existing, submitted: { well: "2410", term: "2341" } });
    expect(plan.ok && plan.inserts).toEqual([{ point_id: "term", volume_bbl: 2341, supersedes_id: null, reason: null }]);
  });

  it("turns a changed value into a correction that points at the old reading", () => {
    const existing = [{ id: "r1", point_id: "well", volume_bbl: 2410 }];
    const plan = planDay({ ...base, existing, submitted: { well: "2401" }, reason: "Typo" });
    expect(plan.ok && plan.inserts).toEqual([{ point_id: "well", volume_bbl: 2401, supersedes_id: "r1", reason: "Typo" }]);
  });

  it("refuses a correction without a reason", () => {
    const existing = [{ id: "r1", point_id: "well", volume_bbl: 2410 }];
    const plan = planDay({ ...base, existing, submitted: { well: "2401" }, reason: "  " });
    expect(plan).toEqual({ ok: false, error: "Changing Wellhead allocation is a correction. Say why in the reason box." });
  });

  it("refuses to remove a reading by clearing the box", () => {
    const existing = [{ id: "r1", point_id: "well", volume_bbl: 2410 }];
    const plan = planDay({ ...base, existing, submitted: { well: "" }, reason: "oops" });
    expect(plan.ok).toBe(false);
  });

  it("refuses future dates, negatives, and junk", () => {
    expect(planDay({ ...base, date: "2026-11-04", submitted: { well: "1" } }).ok).toBe(false);
    expect(planDay({ ...base, submitted: { well: "-5" } }).ok).toBe(false);
    expect(planDay({ ...base, submitted: { well: "abc" } }).ok).toBe(false);
    expect(planDay({ ...base, submitted: { well: "1.234" } }).ok).toBe(false);
  });

  it("reports when nothing changed", () => {
    const existing = [{ id: "r1", point_id: "well", volume_bbl: 2410 }];
    expect(planDay({ ...base, existing, submitted: { well: "2410" } })).toEqual({ ok: false, error: "Nothing changed." });
  });
});
