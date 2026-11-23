-- Authors can fix their report (text, photos, location) while it is still new,
-- and reports can carry up to five photos.

alter table public.reports drop constraint reports_photos_check;
alter table public.reports add constraint reports_photos_check check (cardinality(photos) <= 5);

-- The author may update a report while it still has the initial status and is not hidden.
-- The check pins status_id to the single initial status, so the author cannot move it.
create policy "Authors edit own new reports" on public.reports for update to authenticated
  using (
    author_id = (select auth.uid())
    and not is_hidden
    and exists (select 1 from public.statuses s where s.id = status_id and s.is_initial)
  )
  with check (
    author_id = (select auth.uid())
    and not is_hidden
    and exists (select 1 from public.statuses s where s.id = status_id and s.is_initial)
  );

-- Citizens may touch content fields only as the author of a still-new report;
-- workflow fields remain staff-only and the immutable columns never change.
create or replace function public.protect_report_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_staff boolean := public.is_municipality_staff(old.municipality_id);
  v_author_unlocked boolean := auth.uid() = old.author_id
    and not old.is_hidden
    and exists (select 1 from public.statuses s where s.id = old.status_id and s.is_initial);
begin
  if current_setting('role') = 'authenticated' then
    if new.municipality_id is distinct from old.municipality_id
      or new.number is distinct from old.number
      or new.author_id is distinct from old.author_id
      or new.vote_count is distinct from old.vote_count and pg_trigger_depth() = 1
      or new.comment_count is distinct from old.comment_count and pg_trigger_depth() = 1
    then
      raise exception 'Not allowed to change these report fields';
    end if;
    if (new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.photos is distinct from old.photos
        or new.lat is distinct from old.lat
        or new.lng is distinct from old.lng
        or new.address is distinct from old.address)
       and not v_author_unlocked
    then
      raise exception 'Not allowed to change these report fields';
    end if;
    if new.photos is distinct from old.photos and exists (
      select 1 from unnest(new.photos) as p(path)
      where p.path not like (select auth.uid())::text || '/%' or p.path like '%..%'
    ) then
      raise exception 'Report photos must live in the author''s own folder';
    end if;
    if (new.status_id is distinct from old.status_id
        or new.category_id is distinct from old.category_id
        or new.assignee_id is distinct from old.assignee_id
        or new.is_hidden is distinct from old.is_hidden
        or new.duplicate_of is distinct from old.duplicate_of)
       and not v_staff
    then
      raise exception 'Not allowed to change these report fields';
    end if;
  end if;
  if new.status_id is distinct from old.status_id and not exists (
    select 1 from public.statuses where id = new.status_id and municipality_id = new.municipality_id
  ) then
    raise exception 'Invalid status';
  end if;
  if new.category_id is distinct from old.category_id and not exists (
    select 1 from public.categories where id = new.category_id and municipality_id = new.municipality_id
  ) then
    raise exception 'Invalid category';
  end if;
  return new;
end;
$$;
