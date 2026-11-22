-- Per-user read state for the in-app notification bell.
-- notification_id matches the ids produced by getUserNotifications ("comment:<id>" / "status:<id>").
create table public.notification_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index notification_reads_user_idx on public.notification_reads (user_id);

alter table public.notification_reads enable row level security;

create policy "Users manage own notification reads" on public.notification_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
