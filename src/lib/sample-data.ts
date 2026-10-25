// Invented sample data for "Sample Field A". These are not real operator
// figures and must never be replaced with real ones in this file.
//
// The generator is deterministic (fixed seed) so the demo looks the same on
// every machine. Dates are relative to the day the seed runs, so the lender
// view always has a fresh "last 14 days".

export const SAMPLE_POINTS = [
  { key: "well", name: "Wellhead allocation", description: "Sum of well test volumes" },
  { key: "fs", name: "Flow station meter", description: "After separation" },
  { key: "inj", name: "Trunk line injection", description: "Leaving the field" },
  { key: "term", name: "Terminal receipt", description: "Reported by the terminal" },
] as const;

export type PointKey = (typeof SAMPLE_POINTS)[number]["key"];

// Default loss limits per step. Unverified starting values, to be confirmed.
export const SAMPLE_STEPS = [
  { from: "well", to: "fs", limit: 2.0, cause: "Water and gas separation, shrinkage" },
  { from: "fs", to: "inj", limit: 1.0, cause: "Storage and pumping losses" },
  { from: "inj", to: "term", limit: 3.0, cause: "Pipeline transport, shared line" },
] as const;

export type SampleDay = { date: string; volumes: Record<PointKey, number | null> };

export function isoDaysAgo(n: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// 14 days ending yesterday. Two planted anomalies:
//   day 6:  trunk line to terminal loses about 7%, well over the 3% limit
//   day 11: flow station meter reads low (drift) and the terminal has not reported
export function sampleDays(today = new Date()): SampleDay[] {
  let r = 7;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  const out: SampleDay[] = [];
  for (let i = 1; i <= 14; i++) {
    const well = Math.round(2400 + (rnd() - 0.5) * 120);
    let fs = Math.round(well * (1 - (0.009 + rnd() * 0.006)));
    let inj = Math.round(fs * (1 - (0.002 + rnd() * 0.003)));
    let term: number | null = Math.round(inj * (1 - (0.01 + rnd() * 0.008)));
    if (i === 6) term = Math.round(inj * 0.928);
    if (i === 11) {
      fs = Math.round(well * 0.962);
      inj = Math.round(fs * 0.997);
      term = null;
    }
    out.push({ date: isoDaysAgo(15 - i, today), volumes: { well, fs, inj, term } });
  }
  return out;
}
