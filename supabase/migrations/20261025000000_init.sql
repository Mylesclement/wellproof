-- Wellproof v1 schema.
--
-- Three ideas carry the whole design:
--   1. Readings are append-only. A correction is a new row that points at the
--      row it replaces and says why. Nothing is ever updated or deleted.
--   2. Every write lands in audit_log through a trigger, so the log cannot be
--      skipped by application code.
--   3. Row-level security decides who sees what. A lender can only read a
--      field the operator has shared with them, and only while the grant is live.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type org_kind as enum ('operator', 'lender');
create type member_role as enum ('operator_admin', 'operator_staff', 'lender_viewer');
create type flag_type as enum ('gap', 'missing');
-- cleared = a later correction brought the step back in range. The flag row
-- stays so the history shows it once existed.
create type flag_status as enum ('open', 'explained', 'cleared');

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind org_kind not null,
  created_at timestamptz not null default now()
);

create table memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- Display names for people, so the audit trail can say "Ada Staff" instead of a uuid.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null
);

-- ---------------------------------------------------------------------------
-- Fields and their measurement chain
-- ---------------------------------------------------------------------------

create table fields (
  id uuid primary key default gen_random_uuid(),
  operator_org_id uuid not null references organizations (id),
  name text not null,
  units text not null default 'bbl/day, net of water',
  -- true for invented demo data. The UI shows a banner whenever this is set.
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table measurement_points (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id) on delete cascade,
  name text not null,
  description text,
  position int not null check (position >= 0),
  unique (field_id, position)
);

-- A step is one handoff between two points in the chain, with its own
-- expected loss limit.
create table steps (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id) on delete cascade,
  from_point_id uuid not null references measurement_points (id),
  to_point_id uuid not null references measurement_points (id),
  loss_limit_pct numeric(5, 2) not null check (loss_limit_pct >= 0 and loss_limit_pct <= 100),
  normal_cause text,
  unique (field_id, from_point_id),
  check (from_point_id <> to_point_id)
);

-- ---------------------------------------------------------------------------
-- Readings (append-only, versioned)
-- ---------------------------------------------------------------------------

create table readings (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id),
  point_id uuid not null references measurement_points (id),
  reading_date date not null,
  volume_bbl numeric(14, 2) not null check (volume_bbl >= 0),
  version int not null default 1,
  supersedes_id uuid references readings (id),
  reason text,
  source text not null default 'manual' check (source in ('manual', 'csv', 'seed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (point_id, reading_date, version),
  -- A correction must say why.
  check (supersedes_id is null or (reason is not null and length(trim(reason)) > 0))
);

create index readings_field_date on readings (field_id, reading_date);

-- Keeps the version chain honest: version 1 only if nothing exists yet for
-- that point and day, and a correction must replace the current latest row.
create function readings_before_insert() returns trigger
language plpgsql as $$
declare
  latest readings%rowtype;
begin
  select * into latest from readings
   where point_id = new.point_id and reading_date = new.reading_date
   order by version desc limit 1;

  if new.supersedes_id is null then
    if found then
      raise exception 'A reading already exists for this point and date. Submit a correction instead.';
    end if;
    new.version := 1;
  else
    if not found or latest.id <> new.supersedes_id then
      raise exception 'A correction must replace the latest version of the reading.';
    end if;
    new.version := latest.version + 1;
  end if;

  -- The point must belong to the field the reading claims.
  if not exists (select 1 from measurement_points where id = new.point_id and field_id = new.field_id) then
    raise exception 'Measurement point does not belong to this field.';
  end if;

  return new;
end $$;

create trigger readings_before_insert before insert on readings
  for each row execute function readings_before_insert();

-- The latest version of each reading. Everything downstream (reconciliation,
-- the lender view) reads from here.
create view current_readings with (security_invoker = true) as
select distinct on (point_id, reading_date) *
  from readings
 order by point_id, reading_date, version desc;

-- ---------------------------------------------------------------------------
-- Flags and explanations
-- ---------------------------------------------------------------------------

create table flags (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id),
  flag_date date not null,
  step_id uuid not null references steps (id),
  type flag_type not null,
  loss_pct numeric(7, 3),
  status flag_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (field_id, flag_date, step_id)
);

create table flag_notes (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references flags (id),
  body text not null check (length(trim(body)) > 0),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lender access
-- ---------------------------------------------------------------------------

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id),
  lender_org_id uuid not null references organizations (id),
  invited_email text,
  granted_by uuid not null references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id)
);

-- At most one live grant per field and lender.
create unique index access_grants_live on access_grants (field_id, lender_org_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  field_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index audit_log_field on audit_log (field_id, at desc);

create function write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  actor_id uuid := coalesce(auth.uid(), (rec ->> 'created_by')::uuid, (rec ->> 'granted_by')::uuid);
  fid uuid := case when tg_table_name = 'fields' then (rec ->> 'id')::uuid else (rec ->> 'field_id')::uuid end;
begin
  -- flag_notes have no field_id column; look it up through the flag.
  if tg_table_name = 'flag_notes' then
    select field_id into fid from flags where id = (rec ->> 'flag_id')::uuid;
  end if;

  insert into audit_log (actor, action, entity, entity_id, field_id, before, after)
  values (
    actor_id,
    lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    fid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_readings after insert on readings for each row execute function write_audit();
create trigger audit_flags after insert or update on flags for each row execute function write_audit();
create trigger audit_flag_notes after insert on flag_notes for each row execute function write_audit();
create trigger audit_access_grants after insert or update on access_grants for each row execute function write_audit();
create trigger audit_fields after insert or update on fields for each row execute function write_audit();
create trigger audit_steps after insert or update on steps for each row execute function write_audit();

-- Append-only guard. This blocks changes even for roles that bypass RLS, so
-- the history holds no matter which key the app uses.
create function forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger readings_append_only before update or delete on readings for each row execute function forbid_change();
create trigger flag_notes_append_only before update or delete on flag_notes for each row execute function forbid_change();
create trigger audit_log_append_only before update or delete on audit_log for each row execute function forbid_change();

-- ---------------------------------------------------------------------------
-- Access helpers used by RLS policies
-- ---------------------------------------------------------------------------

create function is_operator_member(p_field uuid, p_roles member_role[] default array['operator_admin', 'operator_staff']::member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fields f
      join memberships m on m.org_id = f.operator_org_id
     where f.id = p_field and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create function has_lender_grant(p_field uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from access_grants g
      join memberships m on m.org_id = g.lender_org_id
     where g.field_id = p_field and g.revoked_at is null and m.user_id = auth.uid()
  );
$$;

create function can_view_field(p_field uuid)
returns boolean language sql stable as $$
  select is_operator_member(p_field) or has_lender_grant(p_field);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table profiles enable row level security;
alter table fields enable row level security;
alter table measurement_points enable row level security;
alter table steps enable row level security;
alter table readings enable row level security;
alter table flags enable row level security;
alter table flag_notes enable row level security;
alter table access_grants enable row level security;
alter table audit_log enable row level security;

-- People see their own memberships and the orgs they belong to.
create policy "own memberships" on memberships for select using (user_id = auth.uid());
create policy "own orgs" on organizations for select using (
  exists (select 1 from memberships m where m.org_id = organizations.id and m.user_id = auth.uid())
);
-- Operators also need to see lender org names they have shared fields with.
create policy "granted lender orgs" on organizations for select using (
  exists (select 1 from access_grants g where g.lender_org_id = organizations.id and is_operator_member(g.field_id))
);

-- Anyone who can see a field can see the name of the operator that owns it.
create policy "operator of visible field" on organizations for select using (
  exists (select 1 from fields f where f.operator_org_id = organizations.id and can_view_field(f.id))
);

-- Names are visible to anyone signed in, so audit entries and notes can show authors.
create policy "profiles readable" on profiles for select using (auth.uid() is not null);

create policy "view fields" on fields for select using (can_view_field(id));
create policy "admins edit fields" on fields for update
  using (is_operator_member(id, array['operator_admin']::member_role[]));

create policy "view points" on measurement_points for select using (can_view_field(field_id));
create policy "admins write points" on measurement_points for all
  using (is_operator_member(field_id, array['operator_admin']::member_role[]))
  with check (is_operator_member(field_id, array['operator_admin']::member_role[]));

create policy "view steps" on steps for select using (can_view_field(field_id));
create policy "admins write steps" on steps for all
  using (is_operator_member(field_id, array['operator_admin']::member_role[]))
  with check (is_operator_member(field_id, array['operator_admin']::member_role[]));

-- Readings: insert only. No update or delete policy exists, and the trigger
-- above blocks them anyway.
create policy "view readings" on readings for select using (can_view_field(field_id));
create policy "operators add readings" on readings for insert
  with check (is_operator_member(field_id) and created_by = auth.uid());

create policy "view flags" on flags for select using (can_view_field(field_id));
create policy "operators write flags" on flags for all
  using (is_operator_member(field_id)) with check (is_operator_member(field_id));

create policy "view notes" on flag_notes for select using (
  exists (select 1 from flags f where f.id = flag_id and can_view_field(f.field_id))
);
create policy "operators add notes" on flag_notes for insert with check (
  created_by = auth.uid()
  and exists (select 1 from flags f where f.id = flag_id and is_operator_member(f.field_id))
);

-- Only operator admins manage grants. A lender can see its own live grants.
create policy "admins view grants" on access_grants for select
  using (is_operator_member(field_id, array['operator_admin']::member_role[]));
create policy "lenders view own grants" on access_grants for select using (
  revoked_at is null and exists (select 1 from memberships m where m.org_id = lender_org_id and m.user_id = auth.uid())
);
create policy "admins create grants" on access_grants for insert with check (
  granted_by = auth.uid() and is_operator_member(field_id, array['operator_admin']::member_role[])
);
create policy "admins revoke grants" on access_grants for update
  using (is_operator_member(field_id, array['operator_admin']::member_role[]));

-- The audit trail is visible to the operator. Lenders see the reconciled
-- record, not internal edit history, until we decide otherwise.
create policy "operators view audit" on audit_log for select using (field_id is not null and is_operator_member(field_id));
