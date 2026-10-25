// Signs in as each demo role and prints what the database lets them see and do.
// This exercises row-level security for real, through the same API the app uses.
// Run after seeding: npm run check:access

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = "wellproof-demo";
const STRANGER = "stranger@nowhere.example";

// A signed-in user who belongs to no organization should see nothing.
await admin.auth.admin.createUser({ email: STRANGER, password: PASSWORD, email_confirm: true });

try {
  for (const [i, email] of ["admin@sample-operator.example", "staff@sample-operator.example", "lender@sample-lender.example", STRANGER].entries()) {
    const c = createClient(url, anon, { auth: { persistSession: false } });
    const { data: auth } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    const userId = auth.user!.id;
    const fields = await c.from("fields").select("id");
    const readings = await c.from("readings").select("id");
    const audit = await c.from("audit_log").select("id");
    const point = await c.from("measurement_points").select("id, field_id").limit(1);
    const insert = point.data?.[0]
      ? await c.from("readings").insert({ field_id: point.data[0].field_id, point_id: point.data[0].id, reading_date: `2000-01-0${i + 1}`, volume_bbl: 1, created_by: userId })
      : { error: { message: "no field visible" } };
    console.log(
      email.padEnd(32),
      `fields ${fields.data?.length}`.padEnd(10),
      `readings ${readings.data?.length}`.padEnd(13),
      `audit ${audit.data?.length}`.padEnd(10),
      `add reading: ${insert.error ? "blocked (" + insert.error.message.slice(0, 50) + ")" : "allowed"}`,
    );
  }
} finally {
  const u = (await admin.auth.admin.listUsers()).data.users.find((x) => x.email === STRANGER);
  if (u) await admin.auth.admin.deleteUser(u.id);
  // The check writes one test reading per operator role; that is expected and
  // shows up in the audit log. `npm run db:reset` clears it.
}
