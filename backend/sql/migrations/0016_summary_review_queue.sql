alter table articles add column if not exists summary_review_status text not null default 'pending';
alter table articles add column if not exists summary_reviewed_at timestamptz;

update articles
set summary_review_status = case when summary_is_original then 'pending_review' else 'pending' end
where summary_review_status = 'pending';

create index if not exists articles_summary_review_queue_idx
on articles(summary_review_status, published_at desc)
where hidden = false and status = 'published';
