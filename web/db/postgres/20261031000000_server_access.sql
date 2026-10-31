-- Plain Postgres only. On Supabase these jobs run as the service role, which
-- skips row level security. Here the app server is the "authenticated" role, so
-- it is given exactly those server-side jobs and nothing wider.

-- Username sign-in, and the rate limiter.
grant execute on function email_for_username(citext) to authenticated;
grant execute on function hit_rate_limit(text, integer, integer) to authenticated;

-- The nightly job log.
create policy "app server writes job runs" on job_runs for all to authenticated using (true) with check (true);

-- The nightly purge of sample accounts. Deleting the auth user cascades to the
-- profile, logs and quarters. Touches sample accounts only.
create function purge_demo_accounts(p_created_before timestamptz) returns integer
language plpgsql volatile security definer set search_path = public, auth as $$
declare
  n integer;
begin
  delete from auth.users u using profiles p
    where p.id = u.id and p.is_demo and p.created_at < p_created_before;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_demo_accounts(timestamptz) from public, anon;
grant execute on function purge_demo_accounts(timestamptz) to authenticated;
