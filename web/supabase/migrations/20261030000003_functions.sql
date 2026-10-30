-- App write paths as database functions: each one is atomic, runs as the
-- caller (security invoker), so row level security still decides everything.

-- ---------------------------------------------------------------------------
-- Today in the caller's own time zone.
-- ---------------------------------------------------------------------------
create or replace function my_today() returns date
language sql stable security invoker set search_path = public as $$
  select (now() at time zone p.timezone)::date from profiles p where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Get or create the caller's log for a day. The target is snapshotted on create.
-- Future days are refused.
-- ---------------------------------------------------------------------------
create or replace function ensure_log(p_date date) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_date > my_today() then raise exception 'future date' using errcode = '22023'; end if;
  insert into daily_logs (user_id, log_date, target_quarters)
    select auth.uid(), p_date, p.daily_target from profiles p where p.id = auth.uid()
    on conflict (user_id, log_date) do nothing;
  select id into v_id from daily_logs where user_id = auth.uid() and log_date = p_date;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Rate a quarter (or clear the rating with null). Idempotent.
-- ---------------------------------------------------------------------------
create or replace function set_quality(p_date date, p_rub smallint, p_quality text) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_log uuid;
begin
  if p_quality is not null and p_quality not in ('good','average','needs_work') then
    raise exception 'bad quality' using errcode = '22023';
  end if;
  v_log := ensure_log(p_date);
  if p_quality is null then
    delete from log_quarters where log_id = v_log and rub = p_rub and not planned;
    update log_quarters set quality = null, completed_at = null where log_id = v_log and rub = p_rub;
  else
    insert into log_quarters (log_id, user_id, rub, quality, completed_at)
      values (v_log, auth.uid(), p_rub, p_quality, now())
      on conflict (log_id, rub) do update
        set quality = excluded.quality,
            completed_at = coalesce(log_quarters.completed_at, excluded.completed_at);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Replace the planned set for a day. Completed quarters stay.
-- ---------------------------------------------------------------------------
create or replace function save_plan(p_date date, p_rubs smallint[], p_locked boolean) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_log uuid;
  v_rubs smallint[] := coalesce(p_rubs, '{}');
begin
  v_log := ensure_log(p_date);
  delete from log_quarters where log_id = v_log and quality is null and not (rub = any (v_rubs));
  update log_quarters set planned = (rub = any (v_rubs)) where log_id = v_log;
  insert into log_quarters (log_id, user_id, rub, planned)
    select v_log, auth.uid(), r, true from unnest(v_rubs) as r
    on conflict (log_id, rub) do update set planned = true;
  update daily_logs set plan_locked = (p_locked and cardinality(v_rubs) > 0) where id = v_log;
end $$;

-- ---------------------------------------------------------------------------
-- Change the daily goal. Today's snapshot follows while nothing is read yet.
-- ---------------------------------------------------------------------------
create or replace function set_daily_target(p_target smallint) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update profiles set daily_target = p_target where id = auth.uid();
  update daily_logs d set target_quarters = p_target
    where d.user_id = auth.uid() and d.log_date = my_today()
      and not exists (select 1 from log_quarters q where q.log_id = d.id and q.quality is not null);
end $$;

-- ---------------------------------------------------------------------------
-- Undo for "delete day": write a whole day back in one go.
-- p_quarters: [{"rub": 5, "planned": true, "quality": "good", "completed_at": "..."}]
-- ---------------------------------------------------------------------------
create or replace function restore_day(p_date date, p_target smallint, p_locked boolean, p_quarters jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_log uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from daily_logs where user_id = auth.uid() and log_date = p_date;
  insert into daily_logs (user_id, log_date, target_quarters, plan_locked)
    values (auth.uid(), p_date, p_target, p_locked) returning id into v_log;
  insert into log_quarters (log_id, user_id, rub, planned, quality, completed_at)
    select v_log, auth.uid(), x.rub, coalesce(x.planned, false), x.quality,
           case when x.quality is null then null else coalesce(x.completed_at, now()) end
    from jsonb_to_recordset(coalesce(p_quarters, '[]')) as x(rub smallint, planned boolean, quality text, completed_at timestamptz)
    where coalesce(x.planned, false) or x.quality is not null;
end $$;

revoke all on function my_today(), ensure_log(date), set_quality(date, smallint, text),
  save_plan(date, smallint[], boolean), set_daily_target(smallint),
  restore_day(date, smallint, boolean, jsonb) from public, anon;
grant execute on function my_today(), ensure_log(date), set_quality(date, smallint, text),
  save_plan(date, smallint[], boolean), set_daily_target(smallint),
  restore_day(date, smallint, boolean, jsonb), current_streak() to authenticated;
revoke all on function current_streak() from public, anon;

-- ---------------------------------------------------------------------------
-- Rate limiting in the database, so it holds across serverless instances.
-- Keys are hashed by the app (no usernames or emails stored here).
-- Only the service role may call it.
-- ---------------------------------------------------------------------------
create table rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  hits          integer not null default 0
);
alter table rate_limits enable row level security; -- no policies: service role only

create or replace function hit_rate_limit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language sql volatile security definer set search_path = public as $$
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits <= p_max;
$$;
revoke all on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Background job log. Failed runs stay here (the dead-letter record).
-- ---------------------------------------------------------------------------
create table job_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  detail       jsonb not null default '{}'
);
create index on job_runs (job, started_at desc);
alter table job_runs enable row level security; -- no policies: service role only
