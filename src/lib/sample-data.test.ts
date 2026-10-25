import { describe, expect, it } from "vitest";
import { isoDaysAgo, sampleDays } from "./sample-data";

const today = new Date("2026-10-25T09:00:00Z");

describe("sample data", () => {
  it("covers the 14 days ending yesterday", () => {
    const days = sampleDays(today);
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe("2026-10-11");
    expect(days[13].date).toBe("2026-10-24");
  });

  it("is the same every run", () => {
    expect(sampleDays(today)).toEqual(sampleDays(today));
  });

  it("plants the two anomalies the demo relies on", () => {
    const days = sampleDays(today);
    const day6 = days[5].volumes;
    expect((day6.inj! - day6.term!) / day6.inj!).toBeGreaterThan(0.03);
    const day11 = days[10].volumes;
    expect(day11.term).toBeNull();
    expect((day11.well! - day11.fs!) / day11.well!).toBeGreaterThan(0.02);
  });

  it("counts calendar days without time zone drift", () => {
    expect(isoDaysAgo(1, new Date("2026-03-01T23:30:00Z"))).toBe("2026-02-28");
  });
});
