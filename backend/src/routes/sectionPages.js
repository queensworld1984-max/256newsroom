const express = require('express');
const pool = require('../db');

const router = express.Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://256newsroom.com';

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}

function articleUrl(row) { return row.slug ? `/news/${encodeURIComponent(row.slug)}` : row.internal_url || row.url; }

router.get('/district', (_req, res) => res.redirect(301, '/districts'));

router.get('/latest', async (_req, res, next) => {
  try {
    const articles=(await pool.query(`select a.title,a.summary,a.slug,a.internal_url,a.url,a.published_at,coalesce(s.name,o.name,'256 Newsroom') source_name from articles a left join sources s on s.id=a.source_id left join organizations o on o.id=a.organization_id where a.status='published' and not a.hidden order by a.published_at desc nulls last limit 48`)).rows;
    res.send(pageShell({title:'Latest News | 256 Newsroom',description:'The latest verified reporting and updates published by 256 Newsroom.',canonical:`${SITE_URL}/latest`,heading:'Latest News',intro:'The newest published reporting from across 256 Newsroom, ordered by publication time.',breadcrumbs:[{name:'Home',href:'/'},{name:'Latest',href:'/latest'}],children:[],articles,page:1,totalPages:1}));
  }catch(e){next(e);}
});

function pageShell({ title, description, canonical, heading, intro, breadcrumbs, children, articles, page, totalPages }) {
  const crumbJson = breadcrumbs.map((b, i) => ({ '@type':'ListItem', position:i+1, name:b.name, item:`${SITE_URL}${b.href}` }));
  const cards = articles.length ? articles.map((a) => `<article class="section-story"><a href="${esc(articleUrl(a))}"><h2>${esc(a.title)}</h2></a><p>${esc(a.summary || '')}</p><small>${esc(a.source_name || '256 Newsroom')} · ${a.published_at ? new Date(a.published_at).toLocaleDateString('en-UG',{dateStyle:'medium'}) : 'Latest'}</small></article>`).join('') : '<div class="empty-section"><h2>No published stories yet</h2><p>This section will show verified published reporting when it becomes available. We do not fabricate filler stories.</p></div>';
  const childLinks = children.length ? `<nav class="section-children" aria-label="${esc(heading)} topics">${children.map(c=>`<a href="/${esc(c.slug)}">${esc(c.display_name)}</a>`).join('')}</nav>` : '';
  const pages = totalPages > 1 ? `<nav class="pagination" aria-label="Pagination">${page > 1 ? `<a rel="prev" href="?page=${page-1}">← Previous</a>`:''}<span>Page ${page} of ${totalPages}</span>${page < totalPages ? `<a rel="next" href="?page=${page+1}">Next →</a>`:''}</nav>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><link rel="stylesheet" href="/styles.css?v=20260722-dm-serif"><link rel="stylesheet" href="/section.css?v=20260722-dm-serif"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbJson}).replace(/</g,'\\u003c')}</script></head><body><a class="skip-link" href="#content">Skip to content</a><header class="section-masthead"><a href="/" class="section-logo"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom — Uganda&apos;s Digital News Infrastructure"></a><a href="/?search=" class="section-search">Search</a></header>${navigationMarkup()}<nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbs.map((b,i)=>i===breadcrumbs.length-1?`<span aria-current="page">${esc(b.name)}</span>`:`<a href="${esc(b.href)}">${esc(b.name)}</a><b>›</b>`).join('')}</nav><main id="content" class="section-page"><header class="section-hero"><p>256 Newsroom</p><h1>${esc(heading)}</h1><div>${esc(intro)}</div></header>${childLinks}<form class="section-filters" method="get"><label>District <select name="district"><option value="">All districts</option></select></label><label>Published after <input type="date" name="from"></label><button>Apply filters</button></form><section class="section-stories">${cards}</section>${pages}</main><footer class="section-footer"><a href="/"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom — Uganda&apos;s Digital News Infrastructure"></a></footer><script src="/taxonomy-nav.js?v=20260722" defer></script><script src="/section.js" defer></script></body></html>`;
}

function navigationMarkup(){return `<nav class="taxonomy-nav" aria-label="Primary navigation"><div class="taxonomy-mobile-bar"><button id="taxonomy-menu-button" aria-expanded="false" aria-controls="taxonomy-mobile-menu">Menu</button><a href="/" class="taxonomy-mobile-logo"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a><button class="taxonomy-search-button" aria-label="Open search">Search</button></div><div class="taxonomy-desktop"><a href="/">Home</a><a href="/latest">Latest</a><div id="taxonomy-desktop-items" class="taxonomy-desktop-items"></div><div class="taxonomy-overflow"><button id="taxonomy-more-button" aria-expanded="false">More <span aria-hidden="true">▾</span></button><div id="taxonomy-overflow-items" class="taxonomy-overflow-menu" hidden></div></div><a href="/districts">Districts <span aria-hidden="true">▾</span></a><a href="/?search=" class="section-nav-search">Search</a></div><div id="taxonomy-mobile-backdrop" class="taxonomy-mobile-backdrop" hidden></div><div id="taxonomy-mobile-menu" class="taxonomy-mobile-menu" hidden aria-label="News sections"><div class="taxonomy-mobile-head"><strong>Sections</strong><button id="taxonomy-menu-close" aria-label="Close menu">×</button></div><a href="/">Home</a><a href="/latest">Latest</a><div id="taxonomy-mobile-items"></div><a href="/districts">Districts</a></div></nav>`}

router.get('/districts', async (req,res,next) => {
  try {
    const { rows: districts } = await pool.query('select name,slug,region from districts order by name');
    const articles = (await pool.query(`select a.title,a.summary,a.slug,a.internal_url,a.url,a.published_at,coalesce(s.name,o.name,'256 Newsroom') source_name from articles a left join sources s on s.id=a.source_id left join organizations o on o.id=a.organization_id where a.status='published' and not a.hidden and a.district_id is not null order by a.published_at desc nulls last limit 24`)).rows;
    res.send(pageShell({title:'Uganda District News | 256 Newsroom',description:'Browse verified news from Uganda’s districts, cities, subregions and regions.',canonical:`${SITE_URL}/districts`,heading:'Districts',intro:'Browse reporting by district, city, municipality, subregion and region. District is stored as a location—not duplicated as a news category.',breadcrumbs:[{name:'Home',href:'/'},{name:'Districts',href:'/districts'}],children:districts.map(d=>({display_name:`${d.name}${d.region?` · ${d.region}`:''}`,slug:`districts/${d.slug}`})),articles,page:1,totalPages:1}));
  } catch(e){ next(e); }
});

router.get('/districts/:slug', async (req,res,next) => {
  try {
    const district=(await pool.query('select id,name,slug,region from districts where slug=$1',[req.params.slug])).rows[0];
    if(!district)return next();
    const articles=(await pool.query(`select a.title,a.summary,a.slug,a.internal_url,a.url,a.published_at,coalesce(s.name,o.name,'256 Newsroom') source_name from articles a left join sources s on s.id=a.source_id left join organizations o on o.id=a.organization_id left join article_locations al on al.article_id=a.id where a.status='published' and not a.hidden and (a.district_id=$1 or al.district_id=$1) group by a.id,s.name,o.name order by a.published_at desc nulls last limit 24`,[district.id])).rows;
    res.send(pageShell({title:`${district.name} News | 256 Newsroom`,description:`Latest verified news and public-interest reporting from ${district.name}, Uganda.`,canonical:`${SITE_URL}/districts/${district.slug}`,heading:`${district.name} District`,intro:`Latest published reporting connected to ${district.name}${district.region?` in Uganda’s ${district.region} region`:''}.`,breadcrumbs:[{name:'Home',href:'/'},{name:'Districts',href:'/districts'},{name:district.name,href:`/districts/${district.slug}`}],children:[],articles,page:1,totalPages:1}));
  }catch(e){next(e);}
});

router.get('/:slug', async (req,res,next) => {
  try {
    const redirect=(await pool.query('select c.slug from category_redirects r join categories c on c.id=r.category_id where r.old_slug=$1',[req.params.slug])).rows[0];
    if(redirect && redirect.slug!==req.params.slug)return res.redirect(301,`/${redirect.slug}`);
    const category=(await pool.query(`select c.*,coalesce(c.display_name,c.name) display_name,p.slug parent_slug,coalesce(p.display_name,p.name) parent_name from categories c left join categories p on p.id=c.parent_category_id where c.slug=$1 and c.is_active`,[req.params.slug])).rows[0];
    if(!category)return next();
    const page=Math.max(1,Number.parseInt(req.query.page,10)||1), limit=24, offset=(page-1)*limit;
    const ids=category.parent_category_id?[category.id]:(await pool.query('select id from categories where id=$1 or parent_category_id=$1',[category.id])).rows.map(r=>r.id);
    const params=[ids]; let extra=category.slug==='national'?` and coalesce(s.source_type,o.org_type,'newsroom') in ('local_publisher','government_official','social_official')`:'';
    if(req.query.district){params.push(req.query.district);extra+=` and d.slug=$${params.length}`;}
    if(req.query.from){params.push(req.query.from);extra+=` and a.published_at >= $${params.length}::date`;}
    const base=` from articles a left join sources s on s.id=a.source_id left join organizations o on o.id=a.organization_id left join districts d on d.id=a.district_id where a.status='published' and not a.hidden and a.category_id=any($1::bigint[])${extra}`;
    const total=Number((await pool.query(`select count(*)${base}`,params)).rows[0].count);
    const articles=(await pool.query(`select a.title,a.summary,a.slug,a.internal_url,a.url,a.published_at,coalesce(s.name,o.name,'256 Newsroom') source_name${base} order by a.published_at desc nulls last limit ${limit} offset ${offset}`,params)).rows;
    const children=category.parent_category_id?[]:(await pool.query('select coalesce(display_name,name) display_name,slug from categories where parent_category_id=$1 and is_active and dropdown_visibility order by display_order',[category.id])).rows;
    const crumbs=[{name:'Home',href:'/'}]; if(category.parent_slug)crumbs.push({name:category.parent_name,href:`/${category.parent_slug}`}); crumbs.push({name:category.display_name,href:`/${category.slug}`});
    res.send(pageShell({title:category.seo_title||`${category.display_name} | 256 Newsroom`,description:category.seo_description||category.description||`Latest ${category.display_name} reporting from 256 Newsroom.`,canonical:`${SITE_URL}/${category.slug}${page>1?`?page=${page}`:''}`,heading:category.display_name,intro:category.description||`Latest verified reporting in ${category.display_name}.`,breadcrumbs:crumbs,children,articles,page,totalPages:Math.max(1,Math.ceil(total/limit))}));
  } catch(e){next(e);}
});

module.exports=router;
