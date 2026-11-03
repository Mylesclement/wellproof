"use client";

import { useActionState } from "react";
import { saveDay, type SaveResult } from "./actions";

type Point = { id: string; name: string; description: string | null };

export function DayForm({
  fieldId,
  date,
  points,
  current,
}: {
  fieldId: string;
  date: string;
  points: Point[];
  current: Record<string, number>; // point_id -> volume on file
}) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(saveDay.bind(null, fieldId, date), null);
  const hasAny = Object.keys(current).length > 0;
  const typed = result?.ok === false ? result.values : undefined;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {points.map((p) => (
          <label key={p.id} className="flex flex-col gap-1 text-sm font-semibold">
            {p.name}
            {p.description && <small className="font-normal text-muted">{p.description}</small>}
            <input
              className="input"
              name={`point-${p.id}`}
              inputMode="decimal"
              defaultValue={typed?.[p.id] ?? current[p.id] ?? ""}
              placeholder={current[p.id] == null ? "Not reported" : undefined}
            />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Reason
        <small className="font-normal text-muted">
          {hasAny ? "Required if you change a number that is already on file." : "Optional for new readings."}
        </small>
        <textarea name="reason" className="input font-sans min-h-[44px]" rows={2} defaultValue={typed?.reason ?? ""} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : "Save readings"}
        </button>
        {result && (
          <p role="status" className={result.ok ? "text-ok font-semibold" : "text-bad font-semibold"}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
