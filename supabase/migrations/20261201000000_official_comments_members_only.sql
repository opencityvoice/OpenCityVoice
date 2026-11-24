-- Official comment badge marks an answer given on behalf of the municipality,
-- so only approved members of that municipality may carry it. Platform admins
-- moderate every municipality but do not speak for it.
create or replace function public.prepare_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_official := exists (
    select 1
      from public.reports r
      join public.municipality_members m
        on m.municipality_id = r.municipality_id
       and m.user_id = auth.uid()
       and m.status = 'approved'
     where r.id = new.report_id
  );
  return new;
end;
$$;

-- Comments previously marked official by non-members (e.g. platform admins)
-- lose the badge; genuine member comments keep it.
update public.report_comments c
   set is_official = false
 where c.is_official
   and not exists (
     select 1
       from public.reports r
       join public.municipality_members m
         on m.municipality_id = r.municipality_id
        and m.user_id = c.author_id
        and m.status = 'approved'
      where r.id = c.report_id);
