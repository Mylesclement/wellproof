import { describe, expect, it } from "vitest";
import { diffFlags, type SavedFlag } from "./flags";
import type { ComputedFlag } from "./reconcile";

const gap = (date: string, lossPct = 7.2): ComputedFlag => ({ date, stepId: "CD", type: "gap", lossPct });
const saved = (over: Partial<SavedFlag>): SavedFlag => ({
  id: "f1",
  flag_date: "d1",
  step_id: "CD",
  type: "gap",
  loss_pct: 7.2,
  status: "open",
  hasNotes: false,
  ...over,
});

describe("diffFlags", () => {
  it("adds a new problem as an open flag", () => {
    expect(diffFlags([], [gap("d1")])).toEqual({
      inserts: [{ flag_date: "d1", step_id: "CD", type: "gap", loss_pct: 7.2, status: "open" }],
      updates: [],
    });
  });

  it("leaves an unchanged flag alone, explained or not", () => {
    expect(diffFlags([saved({})], [gap("d1")])).toEqual({ inserts: [], updates: [] });
    expect(diffFlags([saved({ status: "explained", hasNotes: true })], [gap("d1")])).toEqual({ inserts: [], updates: [] });
  });

  it("marks a fixed problem as cleared instead of deleting it", () => {
    const { updates } = diffFlags([saved({ status: "explained", hasNotes: true })], []);
    expect(updates).toEqual([{ id: "f1", type: "gap", loss_pct: 7.2, status: "cleared" }]);
  });

  it("reopens a cleared flag if the problem comes back, keeping its explanation", () => {
    expect(diffFlags([saved({ status: "cleared" })], [gap("d1")]).updates[0].status).toBe("open");
    expect(diffFlags([saved({ status: "cleared", hasNotes: true })], [gap("d1")]).updates[0].status).toBe("explained");
  });

  it("refreshes the loss when a correction changes it but it is still out of range", () => {
    expect(diffFlags([saved({})], [gap("d1", 5.1)]).updates).toEqual([{ id: "f1", type: "gap", loss_pct: 5.1, status: "open" }]);
  });
});
