alter table articles add column if not exists original_url text;
alter table articles add column if not exists internal_url text;
alter table articles add column if not exists seo_summary text;
alter table articles add column if not exists summary_is_original boolean not null default false;
alter table articles add column if not exists summary_generation_model text;
alter table articles add column if not exists summary_generated_at timestamptz;

update articles
set original_url = coalesce(nullif(external_url, ''), url)
where original_url is null;

update articles
set slug = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) || '-' || id
where slug is null or slug = '';

update articles
set internal_url = '/news/' || slug
where internal_url is null or internal_url = '';

create unique index if not exists articles_internal_url_idx on articles(internal_url) where internal_url is not null;
create index if not exists articles_original_url_idx on articles(original_url) where original_url is not null;

create or replace function set_article_urls() returns trigger as $$
declare
  base_slug text;
begin
  if new.id is null then
    new.id := nextval(pg_get_serial_sequence('articles', 'id'));
  end if;
  if new.original_url is null or new.original_url = '' then
    new.original_url := coalesce(nullif(new.external_url, ''), new.url);
  end if;
  if new.slug is null or new.slug = '' then
    base_slug := trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then base_slug := 'story'; end if;
    new.slug := left(base_slug, 100) || '-' || new.id;
  end if;
  if new.internal_url is null or new.internal_url = '' then
    new.internal_url := '/news/' || new.slug;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists articles_set_urls on articles;
create trigger articles_set_urls
before insert or update of title, slug, original_url, internal_url, external_url, url on articles
for each row execute function set_article_urls();
