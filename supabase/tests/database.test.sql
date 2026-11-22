-- Database tests (pgTAP). Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Seed ids
\set lj '\'10000000-0000-4000-8000-000000000001\''
\set staff '\'00000000-0000-4000-8000-000000000002\''
\set citizen '\'00000000-0000-4000-8000-000000000003\''
\set pending '\'00000000-0000-4000-8000-000000000004\''

create temporary table ctx as
select
  (select id from public.categories where municipality_id = :lj order by sort_order limit 1) as category_id,
  (select id from public.statuses where municipality_id = :lj and is_initial) as initial_status,
  (select id from public.statuses where municipality_id = :lj and is_closed order by sort_order limit 1) as closed_status;
grant select on ctx to anon, authenticated;

-- Boundary helpers
select ok(public.point_in_municipality(:lj, 46.0511, 14.5051), 'Ljubljana centre is inside Ljubljana');
select ok(not public.point_in_municipality(:lj, 46.2389, 14.3556), 'Kranj centre is outside Ljubljana');

-- Anonymous visitors can read but not write
set local role anon;
select ok((select count(*) from public.reports where municipality_id = :lj) > 0, 'anon can read reports');
select throws_ok(
  format('insert into public.reports (municipality_id, category_id, author_id, description, lat, lng) values (%L, %L, %L, %L, 46.05, 14.50)',
    :lj, (select category_id from ctx), :citizen, 'Anonymous report'),
  '42501', null, 'anon cannot create reports');
reset role;

-- Citizens create reports as themselves
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :citizen, 'role', 'authenticated')::text, true);

insert into public.reports (municipality_id, category_id, author_id, description, lat, lng)
select :lj, category_id, :citizen, 'Broken bench in the park', 46.0512, 14.5052 from ctx;

select is(
  (select status_id from public.reports where description = 'Broken bench in the park'),
  (select initial_status from ctx),
  'new report gets the initial status');
select is(
  (select number from public.reports where description = 'Broken bench in the park'),
  (select max(number) from public.reports where municipality_id = :lj),
  'new report gets the next number');
select throws_ok(
  format('insert into public.reports (municipality_id, category_id, author_id, description, lat, lng) values (%L, %L, %L, %L, 46.05, 14.50)',
    :lj, (select category_id from ctx), :staff, 'Impersonated report'),
  '42501', null, 'citizens cannot create reports for someone else');

-- Votes keep the counter in sync
insert into public.report_votes (report_id, user_id)
select id, :citizen from public.reports where description = 'Broken bench in the park';
select is((select vote_count from public.reports where description = 'Broken bench in the park'), 1, 'voting increments vote_count');

-- Duplicate detection finds open reports nearby
select ok(
  exists (select 1 from public.nearby_reports(:lj, 46.0514, 14.5054, 50, (select category_id from ctx))
    where description = 'Broken bench in the park'),
  'nearby_reports finds open reports within 50 m');

-- Citizens cannot change the status
update public.reports set status_id = (select closed_status from ctx) where description = 'Broken bench in the park';
select is(
  (select status_id from public.reports where description = 'Broken bench in the park'),
  (select initial_status from ctx),
  'citizens cannot change the status');

-- Pending members are not staff
select set_config('request.jwt.claims', json_build_object('sub', :pending, 'role', 'authenticated')::text, true);
select ok(not public.is_municipality_staff(:lj), 'pending member is not staff');
update public.reports set status_id = (select closed_status from ctx) where description = 'Broken bench in the park';
select is(
  (select status_id from public.reports where description = 'Broken bench in the park'),
  (select initial_status from ctx),
  'pending members cannot change the status');

-- Approved staff change the status and the change is logged
select set_config('request.jwt.claims', json_build_object('sub', :staff, 'role', 'authenticated')::text, true);
update public.reports set status_id = (select closed_status from ctx) where description = 'Broken bench in the park';
select is(
  (select status_id from public.reports where description = 'Broken bench in the park'),
  (select closed_status from ctx),
  'staff can change the status');
select is(
  (select count(*)::int from public.report_events e join public.reports r on r.id = e.report_id
    where r.description = 'Broken bench in the park' and e.type = 'status_changed'),
  1,
  'status change is recorded in the timeline');

-- Closed reports are not offered as duplicates
select ok(
  not exists (select 1 from public.nearby_reports(:lj, 46.0512, 14.5052, 50, (select category_id from ctx))
    where description = 'Broken bench in the park'),
  'nearby_reports skips closed reports');

-- Staff cannot rewrite citizen content or use another municipality's statuses
select throws_ok(
  $$update public.reports set description = 'Rewritten by staff' where description = 'Broken bench in the park'$$,
  'P0001', 'Not allowed to change these report fields', 'staff cannot change report content');
select throws_ok(
  format('update public.reports set status_id = %L where description = %L',
    (select id from public.statuses where municipality_id <> :lj limit 1), 'Broken bench in the park'),
  'P0001', 'Invalid status', 'staff cannot use statuses of another municipality');

-- Staff notification preferences
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :staff, 'role', 'authenticated')::text, true);
select public.set_notification_preferences(:lj, array[(select category_id from ctx), gen_random_uuid()], false);
reset role;
select is(
  (select notify_category_ids from public.municipality_members where municipality_id = :lj and user_id = :staff),
  array[(select category_id from ctx)],
  'staff follow only existing categories of their municipality');
select is(
  (select notify_comments from public.municipality_members where municipality_id = :lj and user_id = :staff),
  false,
  'staff can turn off comment notifications');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :pending, 'role', 'authenticated')::text, true);
select throws_ok(
  format('select public.set_notification_preferences(%L, %L::uuid[], true)', :lj, '{}'),
  'P0001', 'Not allowed', 'pending members cannot set notification preferences');
reset role;

-- Security hardening: server timestamps and rate limits
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :citizen, 'role', 'authenticated')::text, true);
insert into public.report_votes (report_id, user_id, created_at)
select id, :citizen, '2000-01-01' from public.reports
 where municipality_id = :lj and id not in (select report_id from public.report_votes where user_id = :citizen)
 limit 1;
select ok(
  (select min(created_at) > now() - interval '1 minute' from public.report_votes where user_id = :citizen and created_at > '2001-01-01'),
  'vote timestamps are set by the server');
reset role;
select set_config('test.remaining',
  (10 - (select count(*) from public.rate_limit_events where user_id = :citizen and kind = 'report'))::text, true);
set local role authenticated;
select lives_ok(
  format($f$do $d$ begin for i in 1..%s loop
    insert into public.reports (municipality_id, category_id, author_id, description, lat, lng)
    values (%L, %L, %L, 'Rate limit test', 46.05, 14.50);
  end loop; end $d$$f$, current_setting('test.remaining'), :lj, (select category_id from ctx), :citizen),
  'citizens can submit 10 reports per hour');
delete from public.reports where author_id = :citizen and description = 'Rate limit test';
select throws_ok(
  format($f$insert into public.reports (municipality_id, category_id, author_id, description, lat, lng)
    values (%L, %L, %L, 'Rate limit test', 46.05, 14.50)$f$, :lj, (select category_id from ctx), :citizen),
  'P0001', 'rate_limited', 'the 11th report in an hour is rejected, even after deleting earlier ones');
select throws_ok(
  'select public.prepare_new_report()',
  '42501', null, 'trigger functions cannot be called through the API');
reset role;

-- Moderation: flags and hidden content
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :citizen, 'role', 'authenticated')::text, true);
select lives_ok(
  format($f$insert into public.content_flags (report_id, reporter_id, reason)
    select id, %L, 'Spam' from public.reports where description = 'Broken bench in the park'$f$, :citizen),
  'signed-in users can flag a report');
select set_config('request.jwt.claims', json_build_object('sub', :staff, 'role', 'authenticated')::text, true);
select throws_ok(
  format($f$update public.municipalities set is_official = true where id = %L$f$, :lj),
  'P0001', 'Not allowed to change is_official', 'municipality admins cannot mark a municipality as official');
select is((select count(*)::int from public.content_flags where reason = 'Spam'), 1, 'staff see flags for their municipality');
update public.reports set is_hidden = true where description = 'Broken bench in the park';
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is((select count(*)::int from public.reports where description = 'Broken bench in the park'), 0, 'hidden reports are not public');
reset role;
select set_config('test.hidden_report', (select id::text from public.reports where description = 'Broken bench in the park'), true);
set local role anon;
select is((select count(*)::int from public.report_events where report_id = current_setting('test.hidden_report')::uuid), 0, 'events of hidden reports are not public');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :citizen, 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.reports where description = 'Broken bench in the park'), 1, 'authors still see their hidden reports');
select throws_ok(
  format($f$select public.set_comment_hidden((select id from public.report_comments limit 1), true)$f$),
  'P0001', 'Not allowed', 'citizens cannot hide comments');
reset role;

-- Duplicates: comment photos and merging
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :citizen, 'role', 'authenticated')::text, true);
select lives_ok(
  format($f$insert into public.report_comments (report_id, author_id, body, photos)
    select id, %L, '', array[%L || '/photo.jpg'] from public.reports where municipality_id = %L and not is_hidden limit 1$f$,
    :citizen, :citizen, :lj),
  'a comment can be just a photo');
select throws_ok(
  format($f$insert into public.report_comments (report_id, author_id, body, photos)
    select id, %L, 'Look', array[%L || '/photo.jpg'] from public.reports where municipality_id = %L and not is_hidden limit 1$f$,
    :citizen, :staff, :lj),
  '42501', null, 'comment photos must come from the commenter''s own folder');
select throws_ok(
  format($f$select public.merge_report((select id from public.reports where description = 'Broken bench in the park'), 1)$f$),
  'P0001', 'Not allowed', 'citizens cannot merge reports');
select set_config('request.jwt.claims', json_build_object('sub', :staff, 'role', 'authenticated')::text, true);
insert into public.reports (municipality_id, category_id, author_id, description, lat, lng, duplicate_of)
select :lj, category_id, :staff, 'Forged duplicate', 46.05, 14.50, (select id from public.reports where municipality_id = :lj order by number limit 1)
  from ctx;
select is((select duplicate_of from public.reports where description = 'Forged duplicate'), null, 'reports cannot be created as merged duplicates');
select is(
  public.merge_report(
    (select id from public.reports where description = 'Broken bench in the park'),
    (select number from public.reports where municipality_id = :lj and description <> 'Broken bench in the park' order by number limit 1)),
  (select number from public.reports where municipality_id = :lj and description <> 'Broken bench in the park' order by number limit 1),
  'staff merge a duplicate into the original');
select ok(
  (select s.is_duplicate and r.duplicate_of is not null
     from public.reports r join public.statuses s on s.id = r.status_id
    where r.description = 'Broken bench in the park')
  and exists (
    select 1 from public.report_votes v join public.reports t on t.id = v.report_id
     where v.user_id = :citizen and t.municipality_id = :lj
       and t.number = (select number from public.reports where municipality_id = :lj and description <> 'Broken bench in the park' order by number limit 1)),
  'the duplicate is closed and its author supports the original');
reset role;

select * from finish();
rollback;
