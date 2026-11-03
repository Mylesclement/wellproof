# Wellproof (working name)

A verified production record for indigenous Nigerian oil operators, built so lenders and partners can trust the numbers.

Operators log daily volumes at each measurement point (wellhead, flow station, trunk line injection, terminal). The system reconciles each handoff, flags losses outside an expected range or missing readings, and gives lenders a read-only record with a trust score whose formula is shown openly.

**All data in this repo is invented sample data.** No real operator figures, names, or anything under NDA.

## Run it locally

You need Node 22 and Docker.

```bash
npm install
npm run db:start          # starts a local Supabase (Postgres + auth) in Docker
cp .env.example .env.local   # then paste the keys printed by `npx supabase status`
npm run db:reset          # wipes the local DB, applies migrations, loads sample data
npm run dev               # http://localhost:3000
```

Demo logins (password `wellproof-demo`):

| Email | Role |
| --- | --- |
| admin@sample-operator.example | Operator admin |
| staff@sample-operator.example | Operator staff |
| lender@sample-lender.example | Lender viewer |

Other commands:

- `npm test` runs unit tests (Vitest)
- `npm run check:access` signs in as each role and prints what the database lets them see and do
- `npm run build` type-checks and builds for production

## How it is built, and why

**Next.js (App Router) + TypeScript.** One codebase for pages and server logic, deploys to Vercel in one step. TypeScript catches mistakes like a missing field before the code runs.

**Supabase (Postgres + auth).** Postgres is a real relational database, which this problem needs: readings, points, steps and flags all relate to each other. Supabase adds logins and row-level security on top. Locally it runs in Docker, so nothing here touches a hosted service until we deploy.

**Rules live in the database, not just the app.** This is the main design decision. The important guarantees are enforced by Postgres itself, so a bug in the app or a direct API call cannot break them:

- *Readings are append-only.* A trigger blocks every update and delete, even for the database superuser. A correction is a new row with `supersedes_id` pointing at the old one and a required `reason`. The original value is never lost.
- *Versions are checked.* A second reading for the same point and day is rejected unless it is a correction of the current latest version.
- *Every write is logged.* Triggers write to `audit_log` on each insert or change, with who, when, before and after. The log is append-only too.
- *Row-level security decides who sees what.* Every query runs as the signed-in user. Operators see their own fields. A lender sees a field only while the operator's grant is live. A signed-in stranger sees nothing. The app never uses the service key; only the local seed script does.

**Tailwind**, with the colors and fonts carried over from the prototype as CSS variables, so light and dark mode work from one place.

**Vitest** for unit tests. Reconciliation and scoring will live in one pure module with no database calls, so they are easy to test and explain.

## Schema

Defined in [`supabase/migrations/20261025000000_init.sql`](supabase/migrations/20261025000000_init.sql).

| Table | What it holds |
| --- | --- |
| `organizations` | Operators and lenders (`kind`) |
| `memberships` | Which user belongs to which org, with a role: `operator_admin`, `operator_staff`, `lender_viewer` |
| `profiles` | Display names, so the audit trail shows people, not ids |
| `fields` | An operator's field. `is_sample` marks demo data and turns on the banner |
| `measurement_points` | The ordered chain of points for a field (`position`) |
| `steps` | Each handoff between two points, with `loss_limit_pct` and the normal cause of loss |
| `readings` | Append-only, versioned volumes. `supersedes_id` + `reason` for corrections |
| `current_readings` (view) | The latest version of each reading. Everything downstream reads from here |
| `flags` | One per field, day and step. Status `open`, `explained`, or `cleared` (a later correction fixed it). Never deleted |
| `flag_notes` | Append-only explanations, with author and time |
| `access_grants` | Operator shares one field with one lender org. Revocable via `revoked_at`, never deleted |
| `audit_log` | Every write, filled by triggers |

Changes from the starting data model in the handoff: added `profiles`, `fields.is_sample`, `readings.source` (manual, csv, seed), the `cleared` flag status, `invited_email` and `revoked_by` on grants, `field_id` on the audit log so it can be filtered per field, and the `current_readings` view.

## Status

- [x] Repo, stack, auth, schema, seed data, operator readings screen
- [ ] Operator flow: daily entry and corrections done; field setup screen, audit log screen, CSV upload to do
- [x] Reconciliation engine with tests, flags, explanations, trust score
- [ ] Lender invites, lender view, export, deploy
