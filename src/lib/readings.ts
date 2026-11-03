// Decides what saving a day's readings should do, before anything touches
// the database. Pure function, no I/O, so it is easy to test and explain.
//
// For each measurement point the operator submits a value (or leaves it blank):
//   - blank                          -> nothing happens
//   - no reading on file yet          -> new reading (version 1)
//   - same as the reading on file     -> nothing happens
//   - different from the one on file  -> correction (new version, reason required)
//
// Clearing a box that already has a value is not allowed. Readings are never
// removed, only corrected.

export type Existing = { id: string; point_id: string; volume_bbl: number };

export type Insert = {
  point_id: string;
  volume_bbl: number;
  supersedes_id: string | null;
  reason: string | null;
};

export type Plan = { ok: true; inserts: Insert[] } | { ok: false; error: string };

export function planDay(opts: {
  date: string;
  today: string;
  points: { id: string; name: string }[];
  existing: Existing[];
  submitted: Record<string, string>; // point_id -> raw text from the form
  reason: string;
}): Plan {
  const { date, today, points, existing, submitted } = opts;
  const reason = opts.reason.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a date." };
  if (date > today) return { ok: false, error: "Readings can't be entered for a future date." };

  const inserts: Insert[] = [];
  for (const p of points) {
    const raw = (submitted[p.id] ?? "").replace(/,/g, "").trim();
    const current = existing.find((e) => e.point_id === p.id);

    if (raw === "") {
      if (current) return { ok: false, error: `${p.name} already has a reading. Readings can be corrected but not removed.` };
      continue;
    }

    const volume = Number(raw);
    if (!Number.isFinite(volume) || volume < 0) return { ok: false, error: `${p.name}: enter a volume of 0 or more.` };
    if (Math.round(volume * 100) !== volume * 100) return { ok: false, error: `${p.name}: use at most 2 decimal places.` };

    if (!current) {
      inserts.push({ point_id: p.id, volume_bbl: volume, supersedes_id: null, reason: reason || null });
    } else if (Number(current.volume_bbl) !== volume) {
      if (!reason) return { ok: false, error: `Changing ${p.name} is a correction. Say why in the reason box.` };
      inserts.push({ point_id: p.id, volume_bbl: volume, supersedes_id: current.id, reason });
    }
  }

  if (!inserts.length) return { ok: false, error: "Nothing changed." };
  return { ok: true, inserts };
}
