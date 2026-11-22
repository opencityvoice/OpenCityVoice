-- Users are subscribed to comment notifications on reports they commented on.
-- Subscription is created automatically by addComment and managed in the profile.
create table public.report_subscriptions (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index report_subscriptions_report_idx on public.report_subscriptions (report_id);
create index report_subscriptions_user_idx on public.report_subscriptions (user_id);

alter table public.report_subscriptions enable row level security;

create policy "Users manage own subscriptions" on public.report_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
