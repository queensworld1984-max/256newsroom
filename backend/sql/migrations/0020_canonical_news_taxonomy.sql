begin;

alter table categories add column if not exists parent_category_id bigint references categories(id) on delete restrict;
alter table categories add column if not exists display_name text;
alter table categories add column if not exists description text;
alter table categories add column if not exists display_order integer not null default 0;
alter table categories add column if not exists is_active boolean not null default true;
alter table categories add column if not exists navbar_visibility boolean not null default false;
alter table categories add column if not exists dropdown_visibility boolean not null default true;
alter table categories add column if not exists category_kind text not null default 'section';
alter table categories add column if not exists seo_title text;
alter table categories add column if not exists seo_description text;
create unique index if not exists categories_slug_unique on categories(slug);
create index if not exists categories_parent_order_idx on categories(parent_category_id, display_order) where is_active;

create table if not exists category_redirects (
  old_slug text primary key,
  category_id bigint not null references categories(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists audience_hubs (
  id bigserial primary key, slug text not null unique, display_name text not null unique,
  description text, display_order integer not null default 0, is_active boolean not null default true
);
create table if not exists topic_tags (
  id bigserial primary key, slug text not null unique, display_name text not null unique
);
create table if not exists article_audience_hubs (
  article_id bigint not null references articles(id) on delete cascade,
  audience_hub_id bigint not null references audience_hubs(id) on delete cascade,
  primary key(article_id, audience_hub_id)
);
create table if not exists article_topic_tags (
  article_id bigint not null references articles(id) on delete cascade,
  topic_tag_id bigint not null references topic_tags(id) on delete cascade,
  primary key(article_id, topic_tag_id)
);
create table if not exists article_locations (
  article_id bigint not null references articles(id) on delete cascade,
  district_id bigint references districts(id) on delete restrict,
  city_or_municipality text, subregion text, region text,
  is_primary boolean not null default false, is_national boolean not null default false,
  check (district_id is not null or is_national),
  unique(article_id, district_id)
);
create unique index if not exists article_one_primary_location_idx on article_locations(article_id) where is_primary;

create table if not exists structured_content_types (
  id bigserial primary key, slug text not null unique, display_name text not null,
  schema_definition jsonb not null default '{}'::jsonb, is_active boolean not null default true
);

-- Legacy public routes remain valid and resolve to their canonical successor.
insert into category_redirects(old_slug, category_id)
select 'technology', id from categories where slug='technology'
on conflict do nothing;
insert into category_redirects(old_slug, category_id)
select 'district', id from categories where slug='district'
on conflict do nothing;

-- Reuse legacy IDs when they already represent the permanent child category.
update categories set display_name=name where display_name is null;
update categories set display_name='Politics', name='Politics', navbar_visibility=false where slug='politics';
update categories set display_name='Business', name='Business', navbar_visibility=false where slug='business';
update categories set display_name='Consumer Technology', name='Consumer Technology', slug='consumer-technology', navbar_visibility=false where slug='technology';
update categories set display_name='Legacy District Reports', name='Legacy District Reports', slug='legacy-district-reports', is_active=false, navbar_visibility=false where slug='district';
update categories set navbar_visibility=false where slug in ('national','sports','world','ecosystem');

insert into categories(name,slug,display_name,description,display_order,navbar_visibility,category_kind,seo_title,seo_description) values
('Politics & Government','politics-government','Politics & Government','Political institutions, elected leaders, public administration, legislation, elections, policy and government performance.',10,true,'section','Politics & Government News | 256 Newsroom','Uganda politics, government, Parliament, elections, public policy and public administration reporting.'),
('Business & Economy','business-economy','Business & Economy','National economic reporting and practical information for companies, workers, entrepreneurs, investors and consumers.',20,true,'section','Business & Economy News | 256 Newsroom','Uganda business, economy, markets, finance, jobs, trade, investment and enterprise reporting.'),
('Crime & Justice','crime-justice','Crime & Justice','Responsible crime reporting, public safety information, legal context and case outcomes.',30,true,'section','Crime & Justice News | 256 Newsroom','Uganda crime, courts, policing, public safety, cybercrime and legal explainers.'),
('Agriculture','agriculture','Agriculture','Practical and timely information for farmers, traders, exporters, cooperatives and agricultural businesses.',40,true,'section','Agriculture News | 256 Newsroom','Uganda farming, market prices, weather, crop and livestock health, exports and agricultural finance.'),
('Science & Technology','science-technology','Science & Technology','Ugandan and global science, research, artificial intelligence, cybersecurity, engineering and digital transformation.',50,true,'section','Science & Technology News | 256 Newsroom','Ugandan research, AI, cybersecurity, innovation, climate, engineering, space and consumer technology.'),
('Kids & Parents','kids-parents','Kids & Parents','Useful, educational and safe reporting and guidance for children, parents and families.',80,true,'audience','Kids & Parents | 256 Newsroom','Safe parenting guidance, child development, family online safety, protection and educational news.'),
('Youth Hub','youth','Youth Hub','Opportunities, skills, informed youth perspectives, leadership and participation in public life.',90,true,'audience','Youth Hub | 256 Newsroom','Uganda youth opportunities, internships, training, leadership, funding and youth voices.'),
('Women','women','Women','Focused reporting on women’s leadership, businesses, rights, education, opportunities and equality.',100,true,'audience','Women | 256 Newsroom','Women in leadership, business, rights, education, opportunity and public life across Uganda.'),
('Corruption Tracker','corruption-tracker','Corruption Tracker','A public-accountability record of allegations, investigations, findings, responses, recoveries and final outcomes.',110,true,'tracker','Corruption Tracker | 256 Newsroom','Evidence-led tracking of Uganda corruption allegations, audits, investigations, cases, recoveries and outcomes.')
on conflict(slug) do update set display_name=excluded.display_name,description=excluded.description,display_order=excluded.display_order,navbar_visibility=excluded.navbar_visibility,category_kind=excluded.category_kind,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

update categories set display_name='Health',description='Reliable health reporting and useful public-health information.',display_order=70,navbar_visibility=true,category_kind='section',seo_title='Health News | 256 Newsroom',seo_description='Uganda public health, hospitals, maternal and child health, mental health, medicines and research.' where slug='health';
update categories set display_name='Education',description='Reporting and structured information for students, parents, teachers, schools and universities.',display_order=60,navbar_visibility=true,category_kind='section',seo_title='Education News | 256 Newsroom',seo_description='Uganda education news, UNEB notices, admissions, scholarships, calendars, results and teacher information.' where slug='education';

-- Child definitions have exactly one permanent parent. Existing Politics, Business and Consumer Technology IDs are retained.
with defs(parent_slug,display_name,slug,ord) as (values
('politics-government','Politics','politics',10),('politics-government','Government','government',20),('politics-government','Parliament','parliament',30),('politics-government','Elections','elections',40),('politics-government','Public Policy','public-policy',50),('politics-government','Local Government','local-government',60),('politics-government','Public Administration','public-administration',70),('politics-government','Diplomacy','diplomacy',80),('politics-government','National Security','national-security',90),('politics-government','Investigations','investigations',100),('politics-government','Fact Check','fact-check',110),
('business-economy','Business','business',10),('business-economy','Economy','economy',20),('business-economy','Markets & Prices','markets-prices',30),('business-economy','Banking & Finance','banking-finance',40),('business-economy','Personal Finance','personal-finance',50),('business-economy','Tax & Revenue','tax-revenue',60),('business-economy','Trade & Investment','trade-investment',70),('business-economy','Entrepreneurship','entrepreneurship',80),('business-economy','Jobs & Employment','jobs-employment',90),('business-economy','Real Estate','real-estate',100),('business-economy','Energy','energy',110),('business-economy','Transport','transport',120),('business-economy','Technology Business','technology-business',130),
('crime-justice','Crime Reports','crime-reports',10),('crime-justice','Police Statements','police-statements',20),('crime-justice','Missing Persons','missing-persons',30),('crime-justice','Courts','courts',40),('crime-justice','Public Safety Alerts','public-safety-alerts',50),('crime-justice','Consumer Scams','consumer-scams',60),('crime-justice','Cybercrime','cybercrime',70),('crime-justice','Road Safety','road-safety',80),('crime-justice','Legal Explainers','legal-explainers',90),('crime-justice','Court Decisions','court-decisions',100),
('agriculture','Market Prices','agriculture-market-prices',10),('agriculture','Weather for Farmers','weather-for-farmers',20),('agriculture','Crop Diseases','crop-diseases',30),('agriculture','Livestock Health','livestock-health',40),('agriculture','Government Farm Programs','government-farm-programs',50),('agriculture','Farm Inputs','farm-inputs',60),('agriculture','Agricultural Exports','agricultural-exports',70),('agriculture','Regional Farming','regional-farming',80),('agriculture','Agricultural Finance','agricultural-finance',90),('agriculture','Expert Farming Guidance','expert-farming-guidance',100),
('science-technology','Ugandan Research','ugandan-research',10),('science-technology','Climate & Environment','climate-environment',20),('science-technology','Artificial Intelligence','artificial-intelligence',30),('science-technology','Cybersecurity','cybersecurity',40),('science-technology','Innovation','innovation',50),('science-technology','Space & Global Science','space-global-science',60),('science-technology','Digital Services','digital-services',70),('science-technology','Consumer Technology','consumer-technology',80),('science-technology','Engineering','engineering',90),('science-technology','Scientific Discoveries','scientific-discoveries',100),
('education','UNEB Announcements','uneb-announcements',10),('education','Examination Timetables','examination-timetables',20),('education','School Calendars','school-calendars',30),('education','University Admissions','university-admissions',40),('education','Scholarships','scholarships',50),('education','Student Finance','student-finance',60),('education','Teacher Information','teacher-information',70),('education','Curriculum Updates','curriculum-updates',80),('education','School Safety','school-safety',90),('education','Results','results',100),('education','Official Education Notices','official-education-notices',110),
('health','Public-Health Alerts','public-health-alerts',10),('health','Hospitals & Services','hospitals-services',20),('health','Maternal & Child Health','maternal-child-health',30),('health','Mental Health','mental-health',40),('health','Disease Outbreaks','disease-outbreaks',50),('health','Medicines','medicines',60),('health','Nutrition','nutrition',70),('health','Health Insurance','health-insurance',80),('health','Health Research','health-research',90),('health','Health Explainers','health-explainers',100),
('kids-parents','Parenting Guidance','parenting-guidance',10),('kids-parents','Child Development','child-development',20),('kids-parents','Online Safety for Families','online-safety-families',30),('kids-parents','Child Protection','child-protection',40),('kids-parents','Family Activities','family-activities',50),('kids-parents','Children’s Educational News','childrens-educational-news',60),('kids-parents','Special Needs Parenting','special-needs-parenting',70),('kids-parents','Family Relationships','family-relationships',80),('kids-parents','Parent Resources','parent-resources',90),('kids-parents','Children’s Voices','childrens-voices',100),
('youth','Internships','internships',10),('youth','Volunteer Opportunities','volunteer-opportunities',20),('youth','Skills Training','skills-training',30),('youth','Startup Funding','startup-funding',40),('youth','Youth Opportunities','youth-opportunities',50),('youth','Youth Voices','youth-voices',60),('youth','Government Youth Programs','government-youth-programs',70),('youth','Youth Leadership','youth-leadership',80),('youth','Creative Talent','creative-talent',90),('youth','Campus Life','campus-life',100),
('women','Women in Leadership','women-leadership',10),('women','Women-Owned Businesses','women-owned-businesses',20),('women','Safety & Legal Rights','women-safety-legal-rights',30),('women','Women’s Education','womens-education',40),('women','Profiles & Achievements','women-profiles-achievements',50),('women','Opportunities for Women','opportunities-for-women',60),('women','Gender Policy','gender-policy',70),('women','Women’s Organizations','womens-organizations',80),('women','Women’s Voices','womens-voices',90),('women','Equality & Inclusion','equality-inclusion',100),
('corruption-tracker','New Allegations','new-allegations',10),('corruption-tracker','Under Investigation','under-investigation',20),('corruption-tracker','Audit Findings','audit-findings',30),('corruption-tracker','Public Procurement','public-procurement',40),('corruption-tracker','Government Ministries','corruption-government-ministries',50),('corruption-tracker','Public Agencies','corruption-public-agencies',60),('corruption-tracker','Recoveries & Restitution','recoveries-restitution',70),('corruption-tracker','Official Responses','official-responses',80),('corruption-tracker','Source Documents','source-documents',90),('corruption-tracker','Final Outcomes','final-outcomes',100)
)
insert into categories(name,slug,display_name,parent_category_id,display_order,navbar_visibility,dropdown_visibility,category_kind)
select d.display_name,d.slug,d.display_name,p.id,d.ord,false,true,'subcategory' from defs d join categories p on p.slug=d.parent_slug
on conflict(slug) do update set parent_category_id=excluded.parent_category_id,display_name=excluded.display_name,display_order=excluded.display_order,dropdown_visibility=true;

update categories c set parent_category_id=p.id from categories p where c.slug='politics' and p.slug='politics-government';
update categories c set parent_category_id=p.id from categories p where c.slug='business' and p.slug='business-economy';
update categories c set parent_category_id=p.id from categories p where c.slug='consumer-technology' and p.slug='science-technology';

insert into audience_hubs(slug,display_name,description,display_order) values
('kids-parents','Kids & Parents','Content relevant to children, parents and families.',10),
('youth','Youth','Content and opportunities relevant to young people.',20),
('women','Women','Content and opportunities relevant to women.',30)
on conflict(slug) do update set display_name=excluded.display_name,description=excluded.description;

insert into structured_content_types(slug,display_name) values
('market-price','Market Price'),('weather-alert','Weather Alert'),('scholarship','Scholarship'),('youth-opportunity','Youth Opportunity'),('missing-person','Missing Person Notice'),('corruption-matter','Corruption Matter'),('public-health-alert','Public Health Alert'),('fact-check','Fact Check')
on conflict(slug) do nothing;

-- Preserve the old single district field as the primary structured location without duplicating articles.
insert into article_locations(article_id,district_id,is_primary,is_national)
select id,district_id,true,false from articles where district_id is not null
on conflict do nothing;

commit;
