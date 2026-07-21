create table if not exists sources (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique,
  homepage_url text,
  feed_url text,
  source_type text not null default 'local_publisher',
  default_category_id bigint,
  official boolean not null default false,
  credibility_label text,
  admin_notes text,
  active boolean not null default true,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique
);

alter table sources add column if not exists default_category_id bigint;
alter table sources add column if not exists official boolean not null default false;
alter table sources add column if not exists credibility_label text;
alter table sources add column if not exists admin_notes text;
alter table sources alter column source_type set default 'local_publisher';

create table if not exists districts (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique,
  region text
);

create table if not exists story_clusters (
  id bigserial primary key,
  cluster_key text not null unique,
  title text not null,
  summary text,
  category_id bigint references categories(id),
  district_id bigint references districts(id),
  source_count integer not null default 1,
  score numeric not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists articles (
  id bigserial primary key,
  source_id bigint not null references sources(id) on delete cascade,
  cluster_id bigint references story_clusters(id) on delete set null,
  category_id bigint references categories(id),
  district_id bigint references districts(id),
  title text not null,
  summary text,
  url text not null unique,
  image_url text,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  status text not null default 'published',
  hidden boolean not null default false,
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists journalists (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  beat text,
  district_id bigint references districts(id),
  profile_url text,
  image_url text,
  verified boolean not null default false,
  trust_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists engagement_stats (
  id bigserial primary key,
  entity_type text not null,
  entity_id bigint not null,
  views integer not null default 0,
  reads integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  bookmarks integer not null default 0,
  watch_seconds integer not null default 0,
  stat_date date not null default current_date,
  unique(entity_type, entity_id, stat_date)
);

create table if not exists crawl_logs (
  id bigserial primary key,
  source_id bigint references sources(id) on delete set null,
  feed_url text,
  status text not null,
  items_found integer not null default 0,
  items_inserted integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists citizen_reports (
  id bigserial primary key,
  title text not null,
  description text,
  district_id bigint references districts(id),
  media_url text,
  anonymous boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx on articles(published_at desc nulls last);
create index if not exists articles_category_idx on articles(category_id);
create index if not exists articles_district_idx on articles(district_id);
create index if not exists articles_score_idx on articles(score desc);
create index if not exists articles_hidden_status_idx on articles(hidden, status);

insert into categories (name, slug) values
  ('National', 'national'),
  ('Politics', 'politics'),
  ('Business', 'business'),
  ('District', 'district'),
  ('Sports', 'sports'),
  ('World', 'world'),
  ('Health', 'health'),
  ('Technology', 'technology'),
  ('Education', 'education'),
  ('Ecosystem', 'ecosystem')
on conflict (slug) do nothing;

insert into districts (name, slug, region) values
  ('Kampala', 'kampala', 'Central'),
  ('Wakiso', 'wakiso', 'Central'),
  ('Mbarara', 'mbarara', 'Western'),
  ('Gulu', 'gulu', 'Northern'),
  ('Jinja', 'jinja', 'Eastern'),
  ('Mbale', 'mbale', 'Eastern'),
  ('Arua', 'arua', 'Northern'),
  ('Masaka', 'masaka', 'Central'),
  ('Lira', 'lira', 'Northern'),
  ('Hoima', 'hoima', 'Western'),
  ('Kasese', 'kasese', 'Western'),
  ('Kabale', 'kabale', 'Western'),
  ('Kisoro', 'kisoro', 'Western'),
  ('Bushenyi', 'bushenyi', 'Western'),
  ('Sheema', 'sheema', 'Western'),
  ('Rubanda', 'rubanda', 'Western'),
  ('Kanungu', 'kanungu', 'Western'),
  ('Fort Portal', 'fort-portal', 'Western'),
  ('Soroti', 'soroti', 'Eastern'),
  ('Mukono', 'mukono', 'Central'),
  ('Entebbe', 'entebbe', 'Central'),
  ('Luweero', 'luweero', 'Central'),
  ('Kayunga', 'kayunga', 'Central'),
  ('Amuria', 'amuria', 'Eastern'),
  ('Namisindwa', 'namisindwa', 'Eastern'),
  ('Bugiri', 'bugiri', 'Eastern'),
  ('Kween', 'kween', 'Eastern'),
  ('Obongi', 'obongi', 'Northern'),
  ('Kitgum', 'kitgum', 'Northern'),
  ('Moroto', 'moroto', 'Northern'),
  ('Napak', 'napak', 'Northern'),
  ('Oyam', 'oyam', 'Northern'),
  ('Dokolo', 'dokolo', 'Northern'),
  ('Nakasongola', 'nakasongola', 'Central'),
  ('Nakasero', 'nakasero', 'Central')
on conflict (slug) do nothing;

insert into sources (name, slug, homepage_url, feed_url, source_type, active, approved) values
  ('Daily Monitor', 'daily-monitor', 'https://www.monitor.co.ug', 'https://www.monitor.co.ug/uganda/rss', 'local_publisher', true, true),
  ('Nile Post', 'nile-post', 'https://nilepost.co.ug', 'https://nilepost.co.ug/feed', 'local_publisher', true, true),
  ('The Observer', 'the-observer', 'https://observer.ug', 'https://observer.ug/feed', 'local_publisher', true, true),
  ('ChimpReports', 'chimpreports', 'https://chimpreports.com', 'https://chimpreports.com/feed', 'local_publisher', true, true),
  ('PML Daily', 'pml-daily', 'https://www.pmldaily.com', 'https://www.pmldaily.com/feed', 'local_publisher', true, true)
on conflict (slug) do update set
  feed_url = excluded.feed_url,
  source_type = excluded.source_type,
  active = true,
  approved = true;

insert into sources
  (name, slug, homepage_url, feed_url, source_type, default_category_id, official, credibility_label, admin_notes, active, approved)
values
  ('Dokolo Post', 'dokolo-post', 'https://dokolopost.com', 'https://dokolopost.com/feed/', 'local_publisher', null, false, 'Local publisher', 'Approved source for 256 AI Systems launch coverage.', true, true)
on conflict (slug) do update set
  homepage_url = excluded.homepage_url,
  feed_url = excluded.feed_url,
  source_type = excluded.source_type,
  credibility_label = excluded.credibility_label,
  admin_notes = excluded.admin_notes,
  active = true,
  approved = true,
  updated_at = now();

insert into sources
  (name, slug, homepage_url, feed_url, source_type, default_category_id, official, credibility_label, admin_notes, active, approved)
values
  ('Watchdog Uganda', 'watchdog-uganda', 'https://www.watchdoguganda.com', 'https://www.watchdoguganda.com/feed', 'local_publisher', null, false, 'Local publisher', 'Approved national and local Uganda RSS feed.', true, true),
  ('The Independent Uganda', 'independent-uganda', 'https://www.independent.co.ug', 'https://www.independent.co.ug/feed/', 'local_publisher', null, false, 'Local publisher', 'Approved Uganda RSS feed.', true, true),
  ('Wakiso District Local Government', 'wakiso-district-local-government', 'https://wakiso.go.ug', 'https://wakiso.go.ug/feed/', 'government_official', (select id from categories where slug = 'district'), true, 'Official district source', 'Official Wakiso District RSS feed. Routes to District by default.', true, true)
on conflict (slug) do update set
  homepage_url = excluded.homepage_url,
  feed_url = excluded.feed_url,
  source_type = excluded.source_type,
  default_category_id = excluded.default_category_id,
  official = excluded.official,
  credibility_label = excluded.credibility_label,
  admin_notes = excluded.admin_notes,
  active = true,
  approved = true,
  updated_at = now();

insert into sources
  (name, slug, homepage_url, feed_url, source_type, default_category_id, official, credibility_label, admin_notes, active, approved)
values
  ('BBC World News', 'bbc-world-news', 'https://www.bbc.com/news/world', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'international_publisher', (select id from categories where slug = 'world'), false, 'International publisher', 'Verified RSS feed. Routes to World by default.', true, true),
  ('Al Jazeera', 'al-jazeera', 'https://www.aljazeera.com', 'https://www.aljazeera.com/xml/rss/all.xml', 'international_publisher', (select id from categories where slug = 'world'), false, 'International publisher', 'Verified RSS feed. Routes to World by default.', true, true),
  ('BBC Sport Football', 'bbc-sport-football', 'https://www.bbc.com/sport/football', 'https://feeds.bbci.co.uk/sport/football/rss.xml', 'international_publisher', (select id from categories where slug = 'sports'), false, 'Sports publisher', 'Verified RSS feed. Routes to Sports by default.', true, true),
  ('Chelsea FC Official', 'chelsea-fc-official', 'https://www.chelseafc.com/en/news/latest-news', null, 'sports_official', (select id from categories where slug = 'sports'), true, 'Official club source', 'Pending connector/API approval. No stable public RSS endpoint verified from this server.', false, false),
  ('The White House Official', 'white-house-official', 'https://www.whitehouse.gov/briefings-statements/', null, 'government_official', (select id from categories where slug = 'world'), true, 'Official government source', 'Pending connector/API approval. Current WhiteHouse.gov briefing pages do not expose a stable public RSS feed.', false, false),
  ('Donald J. Trump Truth Social', 'trump-truth-social', 'https://truthsocial.com/@realDonaldTrump', null, 'social_official', (select id from categories where slug = 'world'), true, 'Official social source', 'Pending official API/feed integration and admin verification before activation.', false, false)
on conflict (slug) do update set
  homepage_url = excluded.homepage_url,
  feed_url = excluded.feed_url,
  source_type = excluded.source_type,
  default_category_id = excluded.default_category_id,
  official = excluded.official,
  credibility_label = excluded.credibility_label,
  admin_notes = excluded.admin_notes,
  active = excluded.active,
  approved = excluded.approved,
  updated_at = now();

update articles
set category_id = (select id from categories where slug = 'ecosystem'),
    updated_at = now()
where lower(coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(url, '')) similar to
  '%(256 heart|256heart|256 corporate|256corporate|256 mall|256mall|256 express|256express|256shield|256 shield|256 ai|256ai|256 ai systems|256linkshield|256 linkshield|256 ecosystem|256 group|queen dorothy amolo|dorothy amolo|jason boyle|r. boyle|r boyle|enterprise.256|shield.256|ai.256)%';

with seeded_article as (
  select
    (select id from sources where slug = 'dokolo-post') as source_id,
    (select id from categories where slug = 'ecosystem') as category_id,
    (select id from districts where slug = 'lira') as district_id,
    'The Woman Shaping Uganda''s AI Future: Amolo''s Journey from Politics to Technology'::text as title,
    'Dokolo Post reports that Queen Dorothy Amolo unveiled 256 AI Systems at a media pre-launch briefing in Lira, with Dr. Jason Boyle describing the company''s platforms as practical digital solutions intended to expand employment, entrepreneurship and global connectivity.'::text as summary,
    'https://dokolopost.com/the-woman-shaping-ugandas-ai-future-amolos-journey-from-politics-to-technology/'::text as url,
    'https://dokolopost.com/wp-content/uploads/2026/07/Otafiire-Amongi-return-to-Oyam-with-your-expired-politics.-Dont-smuggle-_20260713_225509_0000.png'::text as image_url
),
seeded_cluster as (
  insert into story_clusters (cluster_key, title, summary, category_id, district_id, score, source_count, last_seen_at)
  select
    '256-ai-systems-amolo-boyle-launch',
    title,
    summary,
    category_id,
    district_id,
    1200,
    1,
    now()
  from seeded_article
  on conflict (cluster_key) do update set
    title = excluded.title,
    summary = excluded.summary,
    category_id = excluded.category_id,
    district_id = excluded.district_id,
    score = greatest(story_clusters.score, excluded.score),
    last_seen_at = now()
  returning id
)
insert into articles
  (source_id, cluster_id, category_id, district_id, title, summary, url, image_url, author, published_at, score)
select
  seeded_article.source_id,
  seeded_cluster.id,
  seeded_article.category_id,
  seeded_article.district_id,
  seeded_article.title,
  seeded_article.summary,
  seeded_article.url,
  seeded_article.image_url,
  'Anthony Opio',
  '2026-07-13T19:52:33Z'::timestamptz,
  1200
from seeded_article, seeded_cluster
on conflict (url) do update set
  title = excluded.title,
  summary = excluded.summary,
  image_url = excluded.image_url,
  category_id = excluded.category_id,
  district_id = excluded.district_id,
  author = excluded.author,
  published_at = excluded.published_at,
  score = greatest(articles.score, excluded.score),
  updated_at = now();

insert into journalists (name, slug, beat, profile_url, verified, trust_score) values
  ('Sarah Atwine', 'sarah-atwine', 'Politics & Government', '/journalists/sarah-atwine/', true, 94),
  ('David Kato', 'david-kato', 'Business & Markets', '#', true, 89),
  ('Aisha Namuli', 'aisha-namuli', 'Health & Communities', '#', true, 91),
  ('Oscar Mugisha', 'oscar-mugisha', 'Sports & Live Video', '#', true, 87),
  ('Lydia Nsubuga', 'lydia-nsubuga', 'District Affairs', '#', true, 88),
  ('Peter Nyanzi', 'peter-nyanzi', 'Investigations', '#', true, 92)
on conflict (slug) do nothing;

insert into engagement_stats (entity_type, entity_id, reads, views, shares, comments, bookmarks, stat_date)
select 'journalist', id,
  case slug
    when 'sarah-atwine' then 312000
    when 'david-kato' then 284000
    when 'aisha-namuli' then 241000
    when 'oscar-mugisha' then 218000
    when 'lydia-nsubuga' then 196000
    else 172000
  end,
  case slug
    when 'sarah-atwine' then 620000
    when 'david-kato' then 1600000
    when 'aisha-namuli' then 890000
    when 'oscar-mugisha' then 1200000
    when 'lydia-nsubuga' then 620000
    else 410000
  end,
  case slug
    when 'sarah-atwine' then 4820
    when 'david-kato' then 3900
    when 'aisha-namuli' then 2700
    when 'oscar-mugisha' then 3100
    when 'lydia-nsubuga' then 1800
    else 1400
  end,
  0,
  0,
  current_date
from journalists
on conflict (entity_type, entity_id, stat_date) do update set
  reads = excluded.reads,
  views = excluded.views,
  shares = excluded.shares;
