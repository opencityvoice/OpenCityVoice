-- Fewer duplicate reports: photos on comments, and staff can merge a duplicate into the original report.

-- A comment needs text, at least one photo, or both. Photos live in the uploader's own folder.
alter table public.report_comments add column photos text[] not null default '{}' check (cardinality(photos) <= 3);
alter table public.report_comments drop constraint report_comments_body_check;
alter table public.report_comments add constraint report_comments_body_check
  check (char_length(body) <= 2000 and (char_length(body) >= 1 or cardinality(photos) > 0));

drop policy "Users comment" on public.report_comments;
create policy "Users comment" on public.report_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not exists (
      select 1 from unnest(photos) as p(path)
       where p.path not like (select auth.uid())::text || '/%' or p.path like '%..%'
    )
  );

alter table public.reports add column duplicate_of uuid references public.reports (id) on delete set null;
create index reports_duplicate_of_idx on public.reports (duplicate_of) where duplicate_of is not null;

-- Each municipality has one closed "Duplicate" status that merged reports move to.
alter table public.statuses add column is_duplicate boolean not null default false;
create unique index statuses_one_duplicate_idx on public.statuses (municipality_id) where is_duplicate;

insert into public.statuses (municipality_id, name, color, sort_order, is_initial, is_closed, is_duplicate)
select id, '{"en": "Duplicate", "sl": "Podvojena"}', '#78716c', 50, false, true, true
  from public.municipalities;

create or replace function public.seed_municipality_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (municipality_id, name, icon, color, sort_order) values
    (new.id, '{"en": "Road and sidewalk damage", "sl": "Poškodbe cestišča, pločnikov"}', 'construction', '#b45309', 10),
    (new.id, '{"en": "Traffic signs and signals", "sl": "Poškodbe prometne signalizacije"}', 'triangle-alert', '#dc2626', 20),
    (new.id, '{"en": "Street lighting failure", "sl": "Okvare javne razsvetljave"}', 'lightbulb', '#ca8a04', 30),
    (new.id, '{"en": "Damaged street furniture", "sl": "Poškodbe urbane opreme"}', 'armchair', '#7c3aed', 40),
    (new.id, '{"en": "Littering and illegal dumping", "sl": "Nasmeteno območje (divja odlagališča, ekološki otoki)"}', 'trash-2', '#15803d', 50),
    (new.id, '{"en": "Ideas and suggestions", "sl": "Predlogi in pobude"}', 'message-square-plus', '#2563eb', 60);

  insert into public.statuses (municipality_id, name, color, sort_order, is_initial, is_closed, is_duplicate) values
    (new.id, '{"en": "New", "sl": "Nova"}', '#2563eb', 10, true, false, false),
    (new.id, '{"en": "In progress", "sl": "V delu"}', '#d97706', 20, false, false, false),
    (new.id, '{"en": "Resolved", "sl": "Zaključena"}', '#16a34a', 30, false, true, false),
    (new.id, '{"en": "Rejected", "sl": "Zavrnjena"}', '#6b7280', 40, false, true, false),
    (new.id, '{"en": "Duplicate", "sl": "Podvojena"}', '#78716c', 50, false, true, true);
  return new;
end;
$$;

-- Merges a report into another one of the same municipality (by its number): supporters and the
-- duplicate's author become supporters of the original, and the duplicate is closed as "Duplicate".
create function public.merge_report(p_duplicate_id uuid, p_target_number integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duplicate public.reports;
  v_target public.reports;
  v_status uuid;
begin
  select * into v_duplicate from public.reports where id = p_duplicate_id;
  if v_duplicate.id is null or not public.is_municipality_staff(v_duplicate.municipality_id) then
    raise exception 'Not allowed';
  end if;
  if v_duplicate.duplicate_of is not null then
    raise exception 'Already merged';
  end if;

  select * into v_target from public.reports
   where municipality_id = v_duplicate.municipality_id and number = p_target_number;
  if v_target.id is null or v_target.id = v_duplicate.id or v_target.duplicate_of is not null then
    raise exception 'Invalid target';
  end if;

  select id into v_status from public.statuses
   where municipality_id = v_duplicate.municipality_id and is_duplicate;
  if v_status is null then
    insert into public.statuses (municipality_id, name, color, sort_order, is_initial, is_closed, is_duplicate)
    values (v_duplicate.municipality_id, '{"en": "Duplicate", "sl": "Podvojena"}', '#78716c', 50, false, true, true)
    returning id into v_status;
  end if;

  insert into public.report_votes (report_id, user_id)
  select v_target.id, v.user_id from public.report_votes v where v.report_id = v_duplicate.id
  union
  select v_target.id, v_duplicate.author_id where v_duplicate.author_id <> v_target.author_id
  on conflict do nothing;

  update public.reports set duplicate_of = v_target.id where duplicate_of = v_duplicate.id;
  update public.reports set duplicate_of = v_target.id, status_id = v_status where id = v_duplicate.id;
  return v_target.number;
end;
$$;

-- Only merge_report links duplicates: new reports start unlinked, and a report leaves its merge
-- when staff move it to a status other than "Duplicate".
create function public.sync_duplicate_of()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.duplicate_of := null;
  elsif new.status_id is distinct from old.status_id
     and not exists (select 1 from public.statuses where id = new.status_id and is_duplicate) then
    new.duplicate_of := null;
  end if;
  return new;
end;
$$;

create trigger sync_duplicate_of
  before insert or update on public.reports
  for each row execute function public.sync_duplicate_of();

revoke execute on function public.sync_duplicate_of() from public, anon, authenticated;

revoke execute on function public.merge_report(uuid, integer) from public, anon;
grant execute on function public.merge_report(uuid, integer) to authenticated;
