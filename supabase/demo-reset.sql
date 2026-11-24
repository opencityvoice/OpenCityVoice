-- Demo environment: reset the "my-demo-city" municipality to a known baseline.
-- This is deployment data, NOT schema — do not add it to supabase/migrations/
-- (those are pushed to every project, including real municipalities).
--
-- Apply manually to the demo project:
--   npx supabase db query --remote=<demo-project-ref> -f supabase/demo-reset.sql
-- The script is idempotent and also (re)schedules a nightly pg_cron job.

create extension if not exists pg_cron;

create or replace function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mid uuid;
  v_author uuid;
begin
  select id into v_mid from public.municipalities where slug = 'my-demo-city';
  select id into v_author from auth.users where email = 'demo@opencityvoice.example';
  if v_mid is null then
    return;
  end if;

  -- Photo objects would outlive their reports in storage; remove them first.
  -- Direct SQL deletes need this opt-in flag (storage.protect_delete trigger).
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
   where bucket_id = 'report-photos'
     and name in (
       select path from public.reports r, lateral unnest(r.photos) as path
        where r.municipality_id = v_mid
       union
       select path from public.report_comments c
        join public.reports r on r.id = c.report_id, lateral unnest(c.photos) as path
        where r.municipality_id = v_mid);

  -- Votes, comments, events, forwards, flags and subscriptions cascade.
  delete from public.reports where municipality_id = v_mid;

  -- Join requests pile up while testing; deliberately approved members stay.
  delete from public.municipality_members
   where municipality_id = v_mid and status = 'pending';

  -- Restore municipality chrome in case a staff tester changed it.
  update public.municipalities
     set is_active = true, is_official = false, primary_color = '#0f766e', report_seq = 0
   where id = v_mid;

  if v_author is null then
    return;
  end if;

  -- Baseline reports (categories/statuses come from the municipality trigger).
  insert into public.reports (municipality_id, category_id, status_id, author_id, title, description, lat, lng, created_at)
  select v_mid, c.id, (select id from public.statuses where municipality_id = v_mid and is_initial), v_author,
    'Pothole on Main Street', 'Deep pothole right after the junction near the school, dangerous for cyclists especially at night.', 46.3829, 15.2961, now() - interval '12 days'
  from public.categories c where c.municipality_id = v_mid order by c.sort_order offset 0 limit 1;
  insert into public.reports (municipality_id, category_id, status_id, author_id, title, description, lat, lng, created_at)
  select v_mid, c.id, (select id from public.statuses where municipality_id = v_mid and is_initial), v_author,
    'Street light not working', 'The lamp at the park entrance has been off for a week.', 46.3812, 15.2938, now() - interval '9 days'
  from public.categories c where c.municipality_id = v_mid order by c.sort_order offset 2 limit 1;
  insert into public.reports (municipality_id, category_id, status_id, author_id, title, description, lat, lng, created_at)
  select v_mid, c.id, (select id from public.statuses where municipality_id = v_mid and is_initial), v_author,
    'Illegal dumping by the stream', 'Someone left old furniture and bags of construction waste next to the walking path along the stream.', 46.3838, 15.2975, now() - interval '7 days'
  from public.categories c where c.municipality_id = v_mid order by c.sort_order offset 4 limit 1;
  insert into public.reports (municipality_id, category_id, status_id, author_id, title, description, lat, lng, created_at)
  select v_mid, c.id, (select id from public.statuses where municipality_id = v_mid and is_initial), v_author,
    'More bike racks at the market square', 'There are never enough bike racks on Saturdays. Please add at least 20 more.', 46.3821, 15.2953, now() - interval '5 days'
  from public.categories c where c.municipality_id = v_mid order by c.sort_order offset 5 limit 1;
  insert into public.reports (municipality_id, category_id, status_id, author_id, title, description, lat, lng, created_at)
  select v_mid, c.id, (select id from public.statuses where municipality_id = v_mid and is_initial), v_author,
    'Broken bench in the park', 'Two slats of the bench next to the playground are broken.', 46.3830, 15.2944, now() - interval '3 days'
  from public.categories c where c.municipality_id = v_mid order by c.sort_order offset 3 limit 1;

  -- Move a couple of baseline reports along the workflow.
  update public.reports set status_id = (select id from public.statuses where municipality_id = v_mid and sort_order = 20)
   where municipality_id = v_mid and number = 1;
  update public.reports set status_id = (select id from public.statuses where municipality_id = v_mid and sort_order = 30)
   where municipality_id = v_mid and number = 5;

  insert into public.report_comments (report_id, author_id, body)
  select id, v_author, 'Still there this morning, a car almost lost a wheel.'
    from public.reports where number = 1 and municipality_id = v_mid;

  -- Make the timeline timestamps consistent with the backdated reports.
  update public.report_events e set created_at = r.created_at
    from public.reports r where e.report_id = r.id and e.type = 'created' and r.municipality_id = v_mid;
  update public.report_events e set created_at = r.created_at + interval '1 day',
    note = case when r.number = 5 then 'The bench was repaired by the parks department.' else 'Forwarded to the maintenance team.' end
    from public.reports r where e.report_id = r.id and e.type = 'status_changed' and r.municipality_id = v_mid;
  update public.report_comments c set created_at = r.created_at + interval '3 hours'
    from public.reports r where c.report_id = r.id and r.municipality_id = v_mid;
end;
$$;

-- Nobody may trigger the reset on demand; pg_cron runs it as postgres.
revoke execute on function public.reset_demo_data() from public, anon, authenticated;

-- Nightly reset at 04:00 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'demo-reset';
select cron.schedule('demo-reset', '0 4 * * *', $job$select public.reset_demo_data()$job$);
