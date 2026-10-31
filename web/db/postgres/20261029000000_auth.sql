-- Plain Postgres only (your own server). Runs before supabase/migrations/*.sql
-- and provides what those files expect from Supabase: the anon and authenticated
-- roles, auth.users, and auth.uid(). With these in place the Supabase migrations
-- and every row level security rule run unchanged.
--
-- The app connects as a login role that is a member of "authenticated" and does
-- NOT own the tables, so row level security applies to it. The server sets the
-- signed-in user per transaction: select set_config('app.user_id', '<uuid>', true).
-- The roles themselves are created by a superuser (replica/vultr.md step 2.4).

-- Names and notes can hold any script or emoji, so the database must be UTF-8.
do $$ begin
  if current_setting('server_encoding') <> 'UTF8' then
    raise exception 'The database must use UTF8 encoding, not %. Recreate it: create database dawr owner dawr_owner encoding ''UTF8'' template template0;', current_setting('server_encoding');
  end if;
end $$;

create extension if not exists citext;

create schema auth;

-- Who is signed in for this transaction, or null.
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Accounts. Same shape as Supabase's where the migrations read it (id, email,
-- raw_user_meta_data); the rest is ours. Sample accounts have no email or password.
create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               citext unique,
  password_hash       text,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

-- Sessions. Only a hash of the cookie value is stored.
create table auth.sessions (
  token_hash  text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index on auth.sessions (user_id);
create index on auth.sessions (expires_at);

-- One-time codes and links: password reset codes, email confirmation links.
create table auth.one_time_tokens (
  user_id     uuid not null references auth.users(id) on delete cascade,
  purpose     text not null check (purpose in ('reset', 'confirm')),
  token_hash  text not null,
  expires_at  timestamptz not null,
  attempts    smallint not null default 0,
  primary key (user_id, purpose)
);
create index on auth.one_time_tokens (purpose, token_hash);

-- No browser ever reaches the database, so "authenticated" here means the app
-- server. It needs the auth tables to sign people in.
grant usage on schema auth to authenticated;
grant select, insert, update, delete on auth.users, auth.sessions, auth.one_time_tokens to authenticated;

-- Tables and views the next migrations create get the same grants Supabase gives
-- "authenticated". Row level security still decides which rows.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
