// Writes the sample data as one SQL file, for loading into the online
// (hosted) database by pasting it into the Supabase SQL editor. No secret
// keys are needed: the demo users are created by hand in the dashboard first,
// and this SQL links to them by email.
//
// Run: npm run seed:sql   -> writes deploy/sample-data.sql
// Dates are relative to today, so generate it on the day you load it.

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { flagsForDay, type Step } from "../src/lib/reconcile";
import { SAMPLE_POINTS, SAMPLE_STEPS, sampleDays, type PointKey } from "../src/lib/sample-data";

const USERS = {
  admin: { email: "admin@sample-operator.example", name: "Sample Admin" },
  staff: { email: "staff@sample-operator.example", name: "Sample Field Staff" },
  lender: { email: "lender@sample-lender.example", name: "Sample Credit Analyst" },
};

const q = (s: string | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

const operatorId = randomUUID();
const lenderOrgId = randomUUID();
const fieldId = randomUUID();
const pointId = Object.fromEntries(SAMPLE_POINTS.map((p) => [p.key, randomUUID()])) as Record<PointKey, string>;
const steps: (Step & { cause: string })[] = SAMPLE_STEPS.map((s) => ({
  id: randomUUID(),
  fromPointId: pointId[s.from],
  toPointId: pointId[s.to],
  limitPct: s.limit,
  cause: s.cause,
}));

const days = sampleDays();
const out: string[] = [];
const sql = (s: string) => out.push(s);

sql(`-- Wellproof sample data: invented figures for "Sample Field A". Not real operator data.
-- Generated ${new Date().toISOString().slice(0, 10)}, covering ${days[0].date} to ${days[days.length - 1].date}.
-- Before running: create the three demo users in Authentication > Users (see README).
do $$
declare
  admin_id uuid := (select id from auth.users where email = ${q(USERS.admin.email)});
  staff_id uuid := (select id from auth.users where email = ${q(USERS.staff.email)});
  lender_id uuid := (select id from auth.users where email = ${q(USERS.lender.email)});
begin
  if admin_id is null or staff_id is null or lender_id is null then
    raise exception 'Create the three demo users first (admin@sample-operator.example, staff@sample-operator.example, lender@sample-lender.example).';
  end if;
  if exists (select 1 from fields where name = 'Sample Field A') then
    raise exception 'Sample Field A already exists. Nothing was changed.';
  end if;

  insert into profiles (id, full_name, email) values
    (admin_id, ${q(USERS.admin.name)}, ${q(USERS.admin.email)}),
    (staff_id, ${q(USERS.staff.name)}, ${q(USERS.staff.email)}),
    (lender_id, ${q(USERS.lender.name)}, ${q(USERS.lender.email)})
  on conflict (id) do nothing;

  insert into organizations (id, name, kind) values
    ('${operatorId}', 'Sample Operator Ltd', 'operator'),
    ('${lenderOrgId}', 'Sample Lender Bank', 'lender');
  insert into memberships (user_id, org_id, role) values
    (admin_id, '${operatorId}', 'operator_admin'),
    (staff_id, '${operatorId}', 'operator_staff'),
    (lender_id, '${lenderOrgId}', 'lender_viewer');

  insert into fields (id, operator_org_id, name, is_sample) values ('${fieldId}', '${operatorId}', 'Sample Field A', true);`);

sql(`  insert into measurement_points (id, field_id, name, description, position) values
${SAMPLE_POINTS.map((p, i) => `    ('${pointId[p.key]}', '${fieldId}', ${q(p.name)}, ${q(p.description)}, ${i})`).join(",\n")};`);

sql(`  insert into steps (id, field_id, from_point_id, to_point_id, loss_limit_pct, normal_cause) values
${steps.map((s) => `    ('${s.id}', '${fieldId}', '${s.fromPointId}', '${s.toPointId}', ${s.limitPct}, ${q(s.cause)})`).join(",\n")};`);

// Same story as the local seed: day 3's terminal receipt goes in with two
// digits swapped, then the admin corrects it.
const typoDay = days[2];
const trueTerm = typoDay.volumes.term!;
const typoTerm = Number(String(trueTerm).replace(/^(\d)(\d)(\d)(\d)$/, "$1$2$4$3"));
const typoReadingId = randomUUID();

const readingRows = days.flatMap((d) =>
  SAMPLE_POINTS.filter((p) => d.volumes[p.key] != null).map((p) => {
    const isTypo = d.date === typoDay.date && p.key === "term";
    return `    (${isTypo ? `'${typoReadingId}'` : "gen_random_uuid()"}, '${fieldId}', '${pointId[p.key]}', '${d.date}', ${isTypo ? typoTerm : d.volumes[p.key]}, 'seed', staff_id)`;
  }),
);
sql(`  insert into readings (id, field_id, point_id, reading_date, volume_bbl, source, created_by) values
${readingRows.join(",\n")};
  insert into readings (field_id, point_id, reading_date, volume_bbl, supersedes_id, reason, source, created_by) values
    ('${fieldId}', '${pointId.term}', '${typoDay.date}', ${trueTerm}, '${typoReadingId}', 'Digits transposed on entry. Corrected against the terminal receipt ticket.', 'seed', admin_id);

  insert into access_grants (field_id, lender_org_id, granted_by) values ('${fieldId}', '${lenderOrgId}', admin_id);`);

// Flags, worked out with the same code the app uses.
const flags = days.flatMap((d) => {
  const vols = new Map(SAMPLE_POINTS.filter((p) => d.volumes[p.key] != null).map((p) => [pointId[p.key], d.volumes[p.key]!]));
  return flagsForDay(d.date, vols, steps).map((f) => ({ ...f, id: randomUUID() }));
});
const meterFlag = flags.find((f) => f.date === days[10].date && f.stepId === steps[0].id)!;
sql(`  insert into flags (id, field_id, flag_date, step_id, type, loss_pct, status) values
${flags
  .map(
    (f) =>
      `    ('${f.id}', '${fieldId}', '${f.date}', '${f.stepId}', '${f.type}', ${f.lossPct == null ? "null" : (Math.round(f.lossPct * 1000) / 1000).toString()}, '${f.id === meterFlag.id ? "explained" : "open"}')`,
  )
  .join(",\n")};
  insert into flag_notes (flag_id, body, created_by) values
    ('${meterFlag.id}', 'Flow station meter due for proving. Calibration crew booked for the following week.', admin_id);

  raise notice 'Loaded Sample Field A: % readings, % flags.', ${readingRows.length + 1}, ${flags.length};
end $$;`);

mkdirSync("deploy", { recursive: true });
writeFileSync("deploy/sample-data.sql", out.join("\n\n") + "\n");
console.log(`Wrote deploy/sample-data.sql (${readingRows.length + 1} readings, ${flags.length} flags, dates ${days[0].date} to ${days[days.length - 1].date}).`);
