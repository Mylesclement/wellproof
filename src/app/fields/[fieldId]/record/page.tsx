import { notFound } from "next/navigation";
import { AppHeader, SampleBanner } from "@/components/AppHeader";
import { FieldTabs } from "@/components/FieldTabs";
import { loadFieldData } from "@/lib/flags";
import { fmtBbl, fmtDay, fmtStamp, todayInField } from "@/lib/format";
import { checkDay, lossPct, periodDates, scoreRecord } from "@/lib/reconcile";
import { SCORE, SCORE_FORMULA } from "@/lib/scoring-config";
import { getViewer } from "@/lib/viewer";
import { NoteForm } from "./NoteForm";

type Note = { id: string; body: string; created_by: string; created_at: string };

export default async function RecordPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  const { supabase, name, orgs } = await getViewer();

  const { data: field } = await supabase
    .from("fields")
    .select("id, name, is_sample, operator_org_id")
    .eq("id", fieldId)
    .maybeSingle();
  if (!field) notFound();

  const [{ points, pointIds, steps, byDay }, { data: flagRows }] = await Promise.all([
    loadFieldData(supabase, fieldId),
    supabase
      .from("flags")
      .select("id, flag_date, step_id, type, loss_pct, status, flag_notes(id, body, created_by, created_at)")
      .eq("field_id", fieldId)
      .order("flag_date", { ascending: false }),
  ]);
  const flags = (flagRows ?? []).map((f) => ({
    ...f,
    notes: ((f.flag_notes ?? []) as Note[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  const authorIds = [...new Set(flags.flatMap((f) => f.notes.map((n) => n.created_by)))];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const who = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "Unknown";

  const myOrg = orgs.find((o) => o.id === field.operator_org_id) ?? orgs[0];
  const canWrite = orgs.some((o) => o.id === field.operator_org_id && o.role !== "lender_viewer");

  // ---- The score, over the last N full days ----
  const dates = periodDates(todayInField());
  const inPeriod = new Set(dates);
  const openFlags = flags.filter((f) => inPeriod.has(f.flag_date) && f.status === "open").length;
  const s = scoreRecord({ dates, pointIds, steps, byDay, openFlags });
  const periodFlags = flags.filter((f) => inPeriod.has(f.flag_date) && f.status !== "cleared");
  const explainedShare = periodFlags.length ? (periodFlags.length - openFlags) / periodFlags.length : 1;
  const tone = s.score >= 85 ? "ok" : s.score >= 70 ? "warn" : "bad";

  // ---- Totals along the chain, using only days where every point reported,
  // so a missing terminal number doesn't look like oil that vanished. ----
  const fullDays = dates.filter((d) => pointIds.every((p) => byDay.get(d)?.has(p)));
  const totals = new Map(pointIds.map((p) => [p, fullDays.reduce((sum, d) => sum + byDay.get(d)!.get(p)!, 0)]));
  const first = pointIds[0];
  const last = pointIds[pointIds.length - 1];
  const wellheadDays = dates.filter((d) => byDay.get(d)?.has(first));
  const gross = wellheadDays.reduce((sum, d) => sum + byDay.get(d)!.get(first)!, 0);
  const endToEnd = lossPct(totals.get(first)!, totals.get(last)!);

  const pointName = (id: string) => points.find((p) => p.id === id)?.name ?? "Unknown";
  const stepById = new Map(steps.map((st) => [st.id, st]));
  const stepLabel = (id: string) => {
    const st = stepById.get(id);
    return st ? `${pointName(st.fromPointId)} → ${pointName(st.toPointId)}` : "Unknown step";
  };
  const flagText = (f: (typeof flags)[number]) => {
    const st = stepById.get(f.step_id);
    if (!st) return "";
    if (f.type === "missing") {
      const vols = byDay.get(f.flag_date);
      const gone = [st.fromPointId, st.toPointId].filter((p) => !vols?.has(p)).map(pointName);
      return `${gone.join(" and ") || pointName(st.toPointId)} not reported`;
    }
    const loss = Number(f.loss_pct);
    return loss >= 0
      ? `${loss.toFixed(1)}% lost, expected at most ${st.limitPct}%`
      : `${Math.abs(loss).toFixed(1)}% more arrived than left, which points to a meter problem (limit ±${st.limitPct}%)`;
  };

  return (
    <main className="max-w-[1080px] mx-auto px-4 pt-5 pb-12 flex flex-col gap-5">
      <AppHeader name={name} org={myOrg} />
      {field.is_sample && <SampleBanner />}
      <FieldTabs fieldId={field.id} active="record" />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display font-bold text-xl">Verified production record</h2>
          <p className="text-muted mt-1 max-w-[65ch]">
            What a lender or partner sees for {field.name}: how much oil the field produces, how much reaches the terminal,
            and whether every gap has been explained. Covers the {SCORE.periodDays} full days from {fmtDay(dates[0])} to{" "}
            {fmtDay(dates[dates.length - 1])}.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          <div className="panel">
            <span className="label">Record trust score</span>
            <div className="flex flex-wrap items-center gap-5">
              <Dial score={s.score} grade={s.grade} tone={tone} />
              <div className="flex flex-col gap-2.5 flex-1 min-w-[220px]">
                <Bar label="Readings complete" value={s.completeness} detail={`${s.present} of ${s.expected}`} />
                <Bar label="Steps within expected range" value={s.withinRange} detail={`${s.within} of ${s.checked}`} />
                <Bar label="Flags explained" value={explainedShare} detail={`${periodFlags.length - openFlags} of ${periodFlags.length}`} />
              </div>
            </div>
            <div className="text-sm text-muted flex flex-col gap-1">
              <p>
                Score = <code className="font-mono text-ink">{SCORE_FORMULA}</code>
              </p>
              <p>
                This record:{" "}
                <code className="font-mono text-ink">
                  {SCORE.completenessWeight} × {s.completeness.toFixed(3)} + {SCORE.withinRangeWeight} × {s.withinRange.toFixed(3)} −{" "}
                  {s.penalty} = {s.score}
                </code>
              </p>
              <p>The formula is shown to every viewer so no one has to take the number on faith.</p>
            </div>
          </div>

          <div className="panel">
            <span className="label">Last {SCORE.periodDays} days</span>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
              <Fact label="Gross production" value={`${fmtBbl(Math.round(gross))} bbl`} />
              <Fact label="Average per day" value={`${fmtBbl(wellheadDays.length ? Math.round(gross / wellheadDays.length) : 0)} bopd`} />
              <Fact label="Delivered to terminal" value={`${fmtBbl(Math.round(totals.get(last) ?? 0))} bbl`} note="fully reported days" />
              <Fact label="Wellhead to terminal loss" value={endToEnd == null ? "—" : `${endToEnd.toFixed(1)}%`} note="fully reported days" />
              <Fact label="Days fully reported" value={`${fullDays.length} of ${dates.length}`} />
              <Fact label="Open flags" value={String(openFlags)} />
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 className="font-display font-bold">Where the barrels go</h3>
          <p className="text-sm text-muted">
            Totals over the {fullDays.length} days with every reading in. Each handoff loses a little oil for normal reasons;
            the percentage is compared with that step&apos;s limit.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch">
            {pointIds.map((p, i) => {
              const st = steps[i];
              const l = st ? lossPct(totals.get(st.fromPointId)!, totals.get(st.toPointId)!) : null;
              return (
                <div key={p} className="contents">
                  <div className="flex-1 basis-[150px] bg-bg border border-line rounded-lg p-3 flex flex-col gap-1 min-w-0">
                    <span className="label">{pointName(p)}</span>
                    <span className="font-mono text-xl font-semibold">{fmtBbl(Math.round(totals.get(p) ?? 0))}</span>
                    <span className="text-muted text-xs">bbl</span>
                  </div>
                  {st && (
                    <div className="sm:basis-[110px] flex sm:flex-col items-center justify-center gap-2 sm:gap-1 p-1.5 text-xs text-center">
                      <span className="font-mono text-muted rotate-90 sm:rotate-0">→</span>
                      <LossPill loss={l} limit={st.limitPct} />
                      <span className="text-muted">limit {st.limitPct}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3 className="font-display font-bold">Daily check by step</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {steps.map((st) => (
                    <th key={st.id} className="!whitespace-normal min-w-[9rem] align-bottom">
                      {stepLabel(st.id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...dates].reverse().map((d) => (
                  <tr key={d}>
                    <td>{fmtDay(d)}</td>
                    {checkDay(byDay.get(d) ?? new Map(), steps).map((c) => (
                      <td key={c.stepId}>
                        {c.status === "missing" ? (
                          <span className="pill bg-warn-soft text-warn">Missing</span>
                        ) : c.status === "unchecked" ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <LossPill loss={c.lossPct} limit={stepById.get(c.stepId)!.limitPct} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h3 className="font-display font-bold">Flagged events</h3>
          <p className="text-sm text-muted">
            {canWrite
              ? "Explain each flag. Explanations stay on the record permanently, and a flag that a later correction fixes is marked cleared, not deleted."
              : "The operator's explanation for each flag. Nothing here can be deleted; flags fixed by a later correction are marked cleared."}
          </p>
          {!flags.length && <p className="text-muted">No flags.</p>}
          <ul className="flex flex-col gap-2.5">
            {flags.map((f) => (
              <li
                key={f.id}
                className={`border border-line border-l-4 rounded-md px-3 py-2.5 flex flex-col gap-1.5 ${
                  f.status === "open" ? "border-l-bad" : f.status === "explained" ? "border-l-ok" : "border-l-line opacity-80"
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {fmtDay(f.flag_date)} · {stepLabel(f.step_id)}
                  </strong>
                  <StatusPill status={f.status} />
                </div>
                <p className="text-sm text-muted">
                  {flagText(f)}.{" "}
                  {f.type === "gap" && stepById.get(f.step_id)?.normalCause && `Normal cause of loss here: ${stepById.get(f.step_id)!.normalCause!.toLowerCase()}.`}
                  {f.status === "cleared" && " A later correction brought this step back in range."}
                </p>
                {f.notes.map((n) => (
                  <div key={n.id} className="text-sm">
                    <p>
                      <strong>{who(n.created_by)}:</strong> {n.body}
                    </p>
                    <p className="text-xs text-muted">{fmtStamp(n.created_at)}</p>
                  </div>
                ))}
                {canWrite && f.status !== "cleared" && <NoteForm fieldId={field.id} flagId={f.id} hasNotes={f.notes.length > 0} />}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Dial({ score, grade, tone }: { score: number; grade: string; tone: "ok" | "warn" | "bad" }) {
  const C = 2 * Math.PI * 54;
  return (
    <svg viewBox="0 0 132 132" className="w-[132px] h-[132px] flex-none" role="img" aria-label={`Trust score ${score} of 100, ${grade}`}>
      <circle cx="66" cy="66" r="54" fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle
        cx="66"
        cy="66"
        r="54"
        fill="none"
        stroke={`var(--${tone})`}
        strokeWidth="12"
        strokeLinecap="round"
        transform="rotate(-90 66 66)"
        strokeDasharray={`${(C * score) / 100} ${C}`}
      />
      <text x="66" y="70" textAnchor="middle" fontSize="34" className="font-display font-extrabold" fill="var(--ink)">
        {score}
      </text>
      <text x="66" y="92" textAnchor="middle" fontSize="11" fill="var(--muted)">
        {grade}
      </text>
    </svg>
  );
}

function Bar({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex justify-between gap-2.5">
        <span>{label}</span>
        <span className="font-mono">
          {Math.round(value * 100)}% <span className="text-muted">({detail})</span>
        </span>
      </div>
      <div className="h-2 bg-bg rounded border border-line overflow-hidden">
        <i className="block h-full bg-accent" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function LossPill({ loss, limit }: { loss: number | null; limit: number }) {
  if (loss == null) return <span className="text-muted">—</span>;
  const over = Math.abs(loss) > limit;
  const near = !over && Math.abs(loss) > limit * 0.75;
  const cls = over ? "bg-bad-soft text-bad" : near ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
  return <span className={`pill font-mono ${cls}`}>{loss.toFixed(1)}%</span>;
}

function StatusPill({ status }: { status: string }) {
  if (status === "open") return <span className="pill bg-bad-soft text-bad">Open</span>;
  if (status === "explained") return <span className="pill bg-ok-soft text-ok">Explained</span>;
  return <span className="pill bg-accent-soft text-muted">Cleared</span>;
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label">{label}</span>
      <strong className="font-mono font-semibold">{value}</strong>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
