-- Dawr tracker: first migration (Postgres on Supabase)
-- Access rules: Postgres row level security on every user-owned table.
-- Times are timestamptz (UTC). A "day" is a plain DATE in the user's own time zone (profiles.timezone).

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- quarters: static reference data, 240 rub' al-hizb (30 juz x 2 hizb x 4 rub').
-- Seeded once from public Quran metadata (e.g. Tanzil quran-data, with attribution).
-- Primary key is the rub' number 1..240 so it can be compared and ranged.
-- ---------------------------------------------------------------------------
create table quarters (
  rub          smallint primary key check (rub between 1 and 240),
  juz          smallint not null check (juz between 1 and 30),
  hizb         smallint not null check (hizb between 1 and 60),
  rub_in_juz   smallint not null check (rub_in_juz between 1 and 8),
  code         text not null unique,            -- 'J1_Q1' .. 'J30_Q8', shown in the UI
  juz_name     text not null,                   -- e.g. 'Alif-Lam-Meem'
  start_surah  smallint check (start_surah between 1 and 114),
  start_ayah   smallint check (start_ayah >= 1),
  constraint rub_matches_juz check (juz = ((rub - 1) / 8) + 1),
  constraint rub_matches_hizb check (hizb = ((rub - 1) / 4) + 1),
  constraint rub_in_juz_matches check (rub_in_juz = ((rub - 1) % 8) + 1)
);
create index on quarters (juz);

alter table quarters enable row level security;
create policy "quarters are readable by everyone" on quarters for select using (true);

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Passwords live in auth.users (hashed), never here.
-- ---------------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null check (char_length(full_name) between 1 and 80),
  username        citext not null unique
                    check (username ~ '^[a-z0-9_]{3,24}$'),
  daily_target    smallint not null default 4 check (daily_target between 1 and 240),
  timezone        text not null default 'UTC',   -- IANA name from the browser at sign-up
  theme           text not null default 'system' check (theme in ('system','light','dark')),
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;
create policy "read own profile"   on profiles for select using (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- insert happens in handle_new_user() below; delete happens through auth.users cascade.

-- ---------------------------------------------------------------------------
-- daily_logs: one row per user per local day.
-- target_quarters is a snapshot, so changing the goal later does not rewrite history.
-- ---------------------------------------------------------------------------
create table daily_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  log_date         date not null,
  target_quarters  smallint not null check (target_quarters between 1 and 240),
  plan_locked      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint one_log_per_day unique (user_id, log_date)
);
create index on daily_logs (user_id, log_date desc);
create trigger daily_logs_updated_at before update on daily_logs
  for each row execute function set_updated_at();

alter table daily_logs enable row level security;
create policy "own logs" on daily_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- log_quarters: the quarters on a day. A row is either planned, done, or both.
--   planned = true, quality null      -> in today's plan, not read yet
--   quality not null                  -> read, with self-rated quality
-- user_id is denormalised for RLS and for fast per-user stats.
-- ---------------------------------------------------------------------------
create table log_quarters (
  log_id        uuid not null references daily_logs(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  rub           smallint not null references quarters(rub) on delete restrict,
  planned       boolean not null default false,
  quality       text check (quality in ('good','average','needs_work')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (log_id, rub),
  constraint done_has_time check ((quality is null) = (completed_at is null)),
  constraint row_means_something check (planned or quality is not null)
);
create index on log_quarters (user_id, completed_at desc) where quality is not null;
create index on log_quarters (user_id, rub);
create index on log_quarters (rub);
create trigger log_quarters_updated_at before update on log_quarters
  for each row execute function set_updated_at();

alter table log_quarters enable row level security;
create policy "own log quarters" on log_quarters for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from daily_logs d where d.id = log_id and d.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Day summary view: what History, Statistics and the streak read.
-- security_invoker so RLS of the caller applies.
-- ---------------------------------------------------------------------------
create view day_summaries with (security_invoker = true) as
select
  d.id,
  d.user_id,
  d.log_date,
  d.target_quarters,
  d.plan_locked,
  count(q.rub)                                                             as quarter_rows,
  count(q.rub) filter (where q.quality is not null)                       as done_count,
  count(q.rub) filter (where q.quality = 'needs_work')                     as needs_work_count,
  count(q.rub) filter (where q.quality is not null) >= d.target_quarters   as goal_met,
  array_agg(distinct qq.juz) filter (where q.quality is not null)          as juz_touched
from daily_logs d
left join log_quarters q  on q.log_id = d.id
left join quarters qq     on qq.rub = q.rub
group by d.id;

-- ---------------------------------------------------------------------------
-- Streak: consecutive goal-met days ending today, or ending yesterday if today
-- is not met yet (so the streak does not show 0 at 7am). "Today" is in the
-- user's own time zone.
-- ---------------------------------------------------------------------------
create or replace function current_streak() returns integer
language sql stable security invoker as $$
  with me as (
    select (now() at time zone p.timezone)::date as today
    from profiles p where p.id = auth.uid()
  ),
  met as (
    select s.log_date from day_summaries s where s.user_id = auth.uid() and s.goal_met
  ),
  anchor as (
    select case when exists (select 1 from met, me where met.log_date = me.today)
                then me.today else me.today - 1 end as d
    from me
  ),
  runs as (
    select log_date, log_date - (row_number() over (order by log_date))::int as grp
    from met, anchor where log_date <= anchor.d
  )
  select coalesce((
    select count(*)::int from runs
    where grp = (select grp from runs, anchor where runs.log_date = anchor.d)
  ), 0);
$$;

-- ---------------------------------------------------------------------------
-- Username sign-in: resolve a username to the email Supabase Auth needs.
-- Called only from the server (service role), never exposed to anon,
-- so usernames cannot be enumerated from the browser.
-- ---------------------------------------------------------------------------
create or replace function email_for_username(p_username citext) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from profiles p join auth.users u on u.id = p.id
  where p.username = p_username;
$$;
revoke all on function email_for_username(citext) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- New auth user -> profile row. Name, username and timezone come from sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, username, timezone, is_demo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Hafiz'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC'),
    coalesce((new.raw_user_meta_data->>'is_demo')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
