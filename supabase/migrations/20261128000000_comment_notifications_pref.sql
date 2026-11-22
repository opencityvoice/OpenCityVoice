-- Global opt-out for comment-notification e-mails, separate from
-- email_notifications which covers report status updates.
alter table public.profiles
  add column comment_notifications boolean not null default true;

comment on column public.profiles.comment_notifications is
  'E-mail the user about new comments on reports they follow.';
