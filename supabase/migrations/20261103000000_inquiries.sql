-- Pilot program sign-ups and contact messages from the public website.
--
-- Anyone, signed in or not, can submit one. Nobody can read them back
-- through the app or API: there is no select policy. They are read from the
-- Supabase dashboard, which uses the service role.

create type inquiry_kind as enum ('pilot_operator', 'pilot_lender', 'pilot_partner', 'contact');

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  kind inquiry_kind not null,
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  organization text check (length(organization) <= 160),
  role text check (length(role) <= 120),
  country text check (length(country) <= 80),
  -- Track-specific answers, e.g. number of fields, lending focus, partner type.
  details jsonb not null default '{}'::jsonb check (length(details::text) <= 4000),
  message text check (length(message) <= 4000),
  created_at timestamptz not null default now()
);

alter table inquiries enable row level security;

create policy "anyone can submit" on inquiries for insert to anon, authenticated with check (true);
