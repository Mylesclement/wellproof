// Loads invented demo data into a fresh local database.
// Run with: npm run db:reset   (wipes the local DB, applies migrations, then runs this)

import { createClient } from "@supabase/supabase-js";
import { SAMPLE_POINTS, SAMPLE_STEPS, sampleDays, type PointKey } from "../src/lib/sample-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Refusing to seed a non-local database.");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

export const DEMO_PASSWORD = "wellproof-demo";

function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error || res.data == null) throw new Error(`${what}: ${res.error?.message ?? "no data"}`);
  return res.data as NonNullable<T>;
}

async function createUser(email: string, fullName: string) {
  const { data, error } = await db.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`create user ${email}: ${error?.message}`);
  must(await db.from("profiles").insert({ id: data.user.id, full_name: fullName, email }).select().single(), "profile");
  return data.user.id;
}

async function main() {
  const existing = await db.from("fields").select("id").eq("name", "Sample Field A");
  if (existing.data?.length) {
    console.log("Sample data already present. Run `npm run db:reset` for a clean start.");
    return;
  }

  const adminId = await createUser("admin@sample-operator.example", "Sample Admin");
  const staffId = await createUser("staff@sample-operator.example", "Sample Field Staff");
  const lenderId = await createUser("lender@sample-lender.example", "Sample Credit Analyst");

  const operator = must(
    await db.from("organizations").insert({ name: "Sample Operator Ltd", kind: "operator" }).select().single(),
    "operator org",
  );
  const lender = must(
    await db.from("organizations").insert({ name: "Sample Lender Bank", kind: "lender" }).select().single(),
    "lender org",
  );
  must(
    await db
      .from("memberships")
      .insert([
        { user_id: adminId, org_id: operator.id, role: "operator_admin" },
        { user_id: staffId, org_id: operator.id, role: "operator_staff" },
        { user_id: lenderId, org_id: lender.id, role: "lender_viewer" },
      ])
      .select(),
    "memberships",
  );

  const field = must(
    await db
      .from("fields")
      .insert({ operator_org_id: operator.id, name: "Sample Field A", is_sample: true })
      .select()
      .single(),
    "field",
  );

  const points = must(
    await db
      .from("measurement_points")
      .insert(SAMPLE_POINTS.map((p, i) => ({ field_id: field.id, name: p.name, description: p.description, position: i })))
      .select(),
    "points",
  );
  const pointId = Object.fromEntries(SAMPLE_POINTS.map((p, i) => [p.key, points.find((x) => x.position === i)!.id])) as Record<
    PointKey,
    string
  >;

  must(
    await db
      .from("steps")
      .insert(
        SAMPLE_STEPS.map((s) => ({
          field_id: field.id,
          from_point_id: pointId[s.from],
          to_point_id: pointId[s.to],
          loss_limit_pct: s.limit,
          normal_cause: s.cause,
        })),
      )
      .select(),
    "steps",
  );

  const days = sampleDays();
  const rows = days.flatMap((d) =>
    SAMPLE_POINTS.filter((p) => d.volumes[p.key] != null).map((p) => ({
      field_id: field.id,
      point_id: pointId[p.key],
      reading_date: d.date,
      volume_bbl: d.volumes[p.key],
      source: "seed",
      created_by: staffId,
    })),
  );

  // Day 3's terminal receipt goes in with two digits swapped, then gets
  // corrected, so the demo shows how a correction keeps the original.
  const typoDay = days[2];
  const trueTerm = typoDay.volumes.term!;
  const typoTerm = Number(String(trueTerm).replace(/^(\d)(\d)(\d)(\d)$/, "$1$2$4$3"));
  const typoRow = rows.find((r) => r.reading_date === typoDay.date && r.point_id === pointId.term)!;
  typoRow.volume_bbl = typoTerm;

  must(await db.from("readings").insert(rows).select(), "readings");

  const original = must(
    await db.from("readings").select().eq("point_id", pointId.term).eq("reading_date", typoDay.date).single(),
    "typo reading",
  );
  must(
    await db
      .from("readings")
      .insert({
        field_id: field.id,
        point_id: pointId.term,
        reading_date: typoDay.date,
        volume_bbl: trueTerm,
        supersedes_id: original.id,
        reason: "Digits transposed on entry. Corrected against the terminal receipt ticket.",
        source: "seed",
        created_by: adminId,
      })
      .select(),
    "correction",
  );

  must(
    await db.from("access_grants").insert({ field_id: field.id, lender_org_id: lender.id, granted_by: adminId }).select(),
    "grant",
  );

  console.log(`Seeded Sample Field A: ${rows.length} readings over ${days.length} days, 1 correction.`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"):`);
  console.log("  admin@sample-operator.example   operator admin");
  console.log("  staff@sample-operator.example   operator staff");
  console.log("  lender@sample-lender.example    lender viewer");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
