-- Comment threads: replies point at their parent comment. The UI flattens
-- deeper nesting under the top-level comment, so any depth is allowed here.
-- The composite FK guarantees a reply always references a comment on the same
-- report without a policy subquery (which would recurse on this table).
alter table public.report_comments
  add column parent_id uuid;

alter table public.report_comments
  add constraint report_comments_id_report_key unique (id, report_id);

alter table public.report_comments
  add constraint report_comments_parent_same_report
    foreign key (parent_id, report_id)
    references public.report_comments (id, report_id)
    on delete cascade;

create index report_comments_parent_idx on public.report_comments (parent_id);
