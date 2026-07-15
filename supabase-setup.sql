-- ============================================================
-- TVK Sivagangai South — Grievance Ticketing System
-- Run this whole file once in Supabase: Project → SQL Editor → New query → Run
-- ============================================================

-- Needed for password hashing (crypt/gen_salt) used by admin_users.
-- Supabase installs this into the "extensions" schema, not "public",
-- so every call below is written as extensions.crypt(...) /
-- extensions.gen_salt(...) to make sure it's always found regardless
-- of your project's search_path.
create extension if not exists pgcrypto with schema extensions;

-- ---------- TICKETS TABLE ----------
create table if not exists tickets (
  id               text primary key,           -- e.g. TVK-SVG-250715-4821
  name             text not null,
  phone            text not null,
  constituency     text not null,
  address          text not null,
  category         text not null,
  subject          text not null,
  description      text not null,
  attachment_url   text default '',
  attachment_type  text default '',
  consent          text default 'no',
  status           text not null default 'Acknowledge',
  notes            jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_tickets_phone  on tickets (phone);
create index if not exists idx_tickets_status on tickets (status);
create index if not exists idx_tickets_created on tickets (created_at desc);

-- Lock the table down: only server-side code using the SERVICE ROLE key
-- (your Netlify functions) can read/write. The public/anon key gets nothing.
alter table tickets enable row level security;
-- (No policies are created on purpose — RLS with zero policies means the
--  anon/public key is fully denied. The service_role key always bypasses RLS.)

-- ---------- ADMIN USERS TABLE ----------
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

alter table admin_users enable row level security;
-- No policies here either — this table should never be reachable except
-- through the verify_admin() function below, called via the service role.

-- Seed one admin account: username "admin", password "TVKSVG"
-- Change the password below before running if you want a different one,
-- or update it later with:
--   update admin_users set password_hash = extensions.crypt('NEW_PASSWORD', extensions.gen_salt('bf')) where username = 'admin';
insert into admin_users (username, password_hash)
values ('admin', extensions.crypt('TVKSVG', extensions.gen_salt('bf')))
on conflict (username) do nothing;

-- ---------- LOGIN VERIFICATION FUNCTION ----------
-- Checks a username/password pair against the hashed password in the DB.
-- Called from admin-login.js via supabase.rpc('verify_admin', ...).
create or replace function verify_admin(p_username text, p_password text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from admin_users
    where username = p_username
    and password_hash = extensions.crypt(p_password, password_hash)
  );
$$;

-- ============================================================
-- Done. You should now see "tickets" and "admin_users" under
-- Table Editor in the Supabase dashboard.
-- ============================================================
