"use client";

import { useActionState } from "react";
import { addNote, type NoteResult } from "./actions";

export function NoteForm({ fieldId, flagId, hasNotes }: { fieldId: string; flagId: string; hasNotes: boolean }) {
  const [result, action, pending] = useActionState<NoteResult, FormData>(addNote.bind(null, fieldId, flagId), null);
  return (
    <form action={action} className="flex flex-wrap gap-2 items-end">
      <textarea
        name="body"
        rows={2}
        className="input font-sans flex-1 min-w-[220px] min-h-[44px]"
        placeholder={hasNotes ? "Add an update" : "What happened, and what was done about it?"}
        aria-label="Explanation"
      />
      <button className="btn bg-transparent text-accent border border-accent" disabled={pending}>
        {pending ? "Saving…" : hasNotes ? "Add update" : "Add explanation"}
      </button>
      {result && !result.ok && (
        <p role="status" className="text-bad text-sm font-semibold w-full">
          {result.message}
        </p>
      )}
    </form>
  );
}
