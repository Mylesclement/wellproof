import { describe, expect, it } from "vitest";
import { checkDay, flagsForDay, lossPct, periodDates, scoreRecord, type DayVolumes, type Step } from "./reconcile";

// Four points A -> B -> C -> D with limits 2%, 1%, 3% (the default chain).
const pointIds = ["A", "B", "C", "D"];
const steps: Step[] = [
  { id: "AB", fromPointId: "A", toPointId: "B", limitPct: 2 },
  { id: "BC", fromPointId: "B", toPointId: "C", limitPct: 1 },
  { id: "CD", fromPointId: "C", toPointId: "D", limitPct: 3 },
];
const day = (a?: number, b?: number, c?: number, d?: number): DayVolumes => {
  const m = new Map<string, number>();
  [a, b, c, d].forEach((v, i) => v != null && m.set(pointIds[i], v));
  return m;
};

describe("lossPct", () => {
  it("is the share of oil lost between two points", () => {
    expect(lossPct(1000, 990)).toBeCloseTo(1);
    expect(lossPct(1000, 1010)).toBeCloseTo(-1); // a gain
    expect(lossPct(0, 10)).toBeNull();
  });
});

describe("checkDay", () => {
  it("passes a normal day", () => {
    expect(checkDay(day(1000, 990, 985, 960), steps).map((c) => c.status)).toEqual(["ok", "ok", "ok"]);
  });

  it("treats a loss exactly at the limit as within range", () => {
    expect(checkDay(day(1000, 980, 980, 980), steps)[0].status).toBe("ok");
  });

  it("flags a loss over the limit", () => {
    expect(checkDay(day(1000, 990, 985, 900), steps)[2].status).toBe("over");
  });

  it("flags a gain over the limit, which usually means a bad meter", () => {
    expect(checkDay(day(1000, 1030, 1025, 1000), steps)[0].status).toBe("over");
  });

  it("raises exactly one missing flag per missing number", () => {
    // Flow station missing: the step into it is missing, the step out of it can't be checked.
    expect(checkDay(day(1000, undefined, 985, 960), steps).map((c) => c.status)).toEqual(["missing", "unchecked", "ok"]);
    // Wellhead missing: charged to the first step.
    expect(checkDay(day(undefined, 990, 985, 960), steps).map((c) => c.status)).toEqual(["missing", "ok", "ok"]);
    // Nothing reported: one flag per step, so three flags. The first step
    // covers both the wellhead and the flow station.
    expect(flagsForDay("d", day(), steps)).toHaveLength(3);
  });
});

describe("scoreRecord: the worked example", () => {
  const byDay = new Map([
    ["d1", day(1000, 990, 985, 960)], // all fine
    ["d2", day(1000, 990, 985, 900)], // 8.6% lost on the last step
    ["d3", day(1000, 960, 955)], // 4% lost on the first step, terminal missing
  ]);
  const dates = ["d1", "d2", "d3"];

  it("finds the three flags", () => {
    const flags = dates.flatMap((d) => flagsForDay(d, byDay.get(d)!, steps));
    expect(flags.map((f) => `${f.date} ${f.stepId} ${f.type}`)).toEqual(["d2 CD gap", "d3 AB gap", "d3 CD missing"]);
  });

  it("scores 67 with all three flags open", () => {
    const r = scoreRecord({ dates, pointIds, steps, byDay, openFlags: 3 });
    expect(r).toMatchObject({ present: 11, expected: 12, checked: 8, within: 6, penalty: 15, score: 67, grade: "Needs work" });
  });

  it("scores 82 once the operator explains them", () => {
    expect(scoreRecord({ dates, pointIds, steps, byDay, openFlags: 0 })).toMatchObject({ score: 82, grade: "Fair" });
  });

  it("caps the penalty at 30", () => {
    expect(scoreRecord({ dates, pointIds, steps, byDay, openFlags: 50 }).penalty).toBe(30);
  });

  it("gives a perfect record 100", () => {
    const clean = new Map([["d1", day(1000, 990, 985, 960)]]);
    expect(scoreRecord({ dates: ["d1"], pointIds, steps, byDay: clean, openFlags: 0 }).score).toBe(100);
  });

  it("counts a day with no readings at all against completeness", () => {
    const r = scoreRecord({ dates: ["d1", "empty"], pointIds, steps, byDay, openFlags: 0 });
    expect(r.completeness).toBe(0.5);
  });

  it("gives an empty record 0, not a free pass", () => {
    expect(scoreRecord({ dates: ["x"], pointIds, steps, byDay: new Map(), openFlags: 0 }).score).toBe(0);
  });
});

describe("periodDates", () => {
  it("is the full days before today, oldest first", () => {
    expect(periodDates("2026-11-03", 3)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
