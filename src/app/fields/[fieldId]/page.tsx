import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader, SampleBanner } from "@/components/AppHeader";
import { FieldTabs } from "@/components/FieldTabs";
import { fmtBbl, fmtDay, fmtStamp, todayInField } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { DayForm } from "./DayForm";

type Reading = {
  id: string;
  point_id: string;
  reading_date: string;
  volume_bbl: number;
  version: number;
  supersedes_id: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
};

export default async function FieldPage({
  params,
  searchParams,
}: {
  params: Promise<{ fieldId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { fieldId } = await params;
  const { day: requestedDay } = await searchParams;
  const { supabase, name, orgs } = await getViewer();

  const { data: field } = await supabase
    .from("fields")
    .select("id, name, units, is_sample, operator_org_id, organizations(name)")
    .eq("id", fieldId)
    .maybeSingle();
  // RLS returns nothing for a field you cannot see, which looks the same as
  // one that does not exist. That is deliberate: no hint that it exists.
  if (!field) notFound();

  const [{ data: points }, { data: steps }, { data: current }, { data: corrections }] = await Promise.all([
    supabase.from("measurement_points").select("id, name, description, position").eq("field_id", fieldId).order("position"),
    supabase.from("steps").select("id, from_point_id, to_point_id, loss_limit_pct").eq("field_id", fieldId),
    supabase.from("current_readings").select("*").eq("field_id", fieldId).order("reading_date", { ascending: false }),
    supabase
      .from("readings")
      .select("*")
      .eq("field_id", fieldId)
      .not("supersedes_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const replacedIds = (corrections ?? []).map((c) => c.supersedes_id!);
  const { data: replaced } = replacedIds.length
    ? await supabase.from("readings").select("*").in("id", replacedIds)
    : { data: [] as Reading[] };

  const authorIds = [...new Set([...(corrections ?? []), ...(replaced ?? [])].map((r) => r.created_by))];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const who = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "Unknown";

  // Pivot the current readings into one row per day, one column per point.
  const byDay = new Map<string, Map<string, Reading>>();
  for (const r of (current ?? []) as Reading[]) {
    if (!byDay.has(r.reading_date)) byDay.set(r.reading_date, new Map());
    byDay.get(r.reading_date)!.set(r.point_id, r);
  }
  const days = [...byDay.keys()].sort().reverse();
  const pointName = (id: string) => points?.find((p) => p.id === id)?.name ?? "Unknown point";
  const myOrg = orgs.find((o) => o.id === field.operator_org_id) ?? orgs[0];
  // Hiding the form is only for clarity. The database refuses a lender's
  // write regardless (see npm run check:access).
  const canWrite = orgs.some((o) => o.id === field.operator_org_id && o.role !== "lender_viewer");

  // Which day the entry form shows: the one asked for in the URL, otherwise
  // the day after the latest reading, never later than today.
  const today = todayInField();
  let entryDay = today;
  if (requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) && requestedDay <= today) {
    entryDay = requestedDay;
  } else if (days.length) {
    const next = new Date(days[0] + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    entryDay = next.toISOString().slice(0, 10) < today ? next.toISOString().slice(0, 10) : today;
  }
  const entryCurrent = Object.fromEntries([...(byDay.get(entryDay)?.values() ?? [])].map((r) => [r.point_id, Number(r.volume_bbl)]));

  return (
    <main className="max-w-[1080px] mx-auto px-4 pt-5 pb-12 flex flex-col gap-5">
      <AppHeader name={name} org={myOrg} />
      {field.is_sample && <SampleBanner />}
      <FieldTabs fieldId={field.id} active="readings" />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display font-bold text-xl">Daily measurement readings</h2>
          <p className="text-muted mt-1 max-w-[65ch]">
            The volume recorded each day at every point the oil passes through, from the wells to the export terminal.
            Readings are never edited in place. A correction is saved as a new version with a reason, and the original
            stays on file.
          </p>
        </div>

        <div className="panel">
          <span className="label">Asset</span>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            <Fact label="Field" value={field.name} />
            <Fact label="Operator" value={(field.organizations as unknown as { name: string }).name} />
            <Fact label="Measurement points" value={`${points?.length ?? 0} in chain`} />
            <Fact label="Units" value={field.units} />
          </div>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {points?.map((p, i) => {
              const step = steps?.find((s) => s.from_point_id === p.id);
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="text-ink font-semibold">{p.name}</span>
                  {i < points.length - 1 && (
                    <span className="font-mono">→{step ? ` ≤${Number(step.loss_limit_pct)}% →` : ""}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {canWrite && points && (
          <div className="panel" id="entry">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display font-bold">Enter or correct readings</h3>
                <p className="text-sm text-muted">
                  {Object.keys(entryCurrent).length
                    ? `${fmtDay(entryDay)} already has readings. Fill a blank box for a late report, or change a number to correct it.`
                    : `No readings on file for ${fmtDay(entryDay)} yet.`}
                </p>
              </div>
              <form method="get" className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Date
                  <input className="input" type="date" name="day" defaultValue={entryDay} max={today} />
                </label>
                <button className="btn bg-transparent text-accent border border-accent">Go</button>
              </form>
            </div>
            <DayForm key={entryDay} fieldId={field.id} date={entryDay} points={points} current={entryCurrent} />
          </div>
        )}

        <div className="panel">
          <h3 className="font-display font-bold">Readings on file</h3>
          {canWrite && <p className="text-sm text-muted">Click a date to correct it or add a late report.</p>}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {points?.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <td>
                      {canWrite ? (
                        <Link href={`?day=${day}#entry`} className="text-accent font-semibold hover:underline">
                          {fmtDay(day)}
                        </Link>
                      ) : (
                        fmtDay(day)
                      )}
                    </td>
                    {points?.map((p) => {
                      const r = byDay.get(day)?.get(p.id);
                      if (!r) return <td key={p.id} className="text-muted">Not reported</td>;
                      return (
                        <td key={p.id} className="font-mono">
                          {fmtBbl(r.volume_bbl)}
                          {r.version > 1 && (
                            <span className="pill bg-accent-soft text-accent ml-2 font-sans" title={r.reason ?? undefined}>
                              v{r.version}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!days.length && <p className="text-muted">No readings yet.</p>}
        </div>

        <div className="panel">
          <h3 className="font-display font-bold">Corrections</h3>
          <p className="text-sm text-muted">Every change to a reading, with who made it and why. The original value is kept.</p>
          {!corrections?.length && <p className="text-muted">No corrections.</p>}
          <ul className="flex flex-col gap-3">
            {(corrections as Reading[] | null)?.map((c) => {
              const old = (replaced as Reading[] | null)?.find((r) => r.id === c.supersedes_id);
              return (
                <li key={c.id} className="border border-line border-l-4 border-l-accent rounded-md px-3 py-2.5 flex flex-col gap-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {fmtDay(c.reading_date)} · {pointName(c.point_id)}
                    </strong>
                    <span className="font-mono text-sm">
                      v{old?.version} {fmtBbl(old?.volume_bbl)} → v{c.version} {fmtBbl(c.volume_bbl)} bbl
                    </span>
                  </div>
                  <p className="text-sm text-muted">{c.reason}</p>
                  <p className="text-xs text-muted">
                    Original entered by {old ? who(old.created_by) : "Unknown"}
                    {old && `, ${fmtStamp(old.created_at)}`}. Corrected by {who(c.created_by)}, {fmtStamp(c.created_at)}.
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <footer className="text-muted text-sm">
        {field.is_sample ? "All figures on this page are invented for demonstration." : null}
      </footer>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label">{label}</span>
      <strong className="font-mono font-semibold">{value}</strong>
    </div>
  );
}
