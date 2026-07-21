const pool = require('./db');
const { chatJson } = require('./openaiClient');
const { slugify, uniqueStorySlug, resolveId } = require('./storiesCore');
const { hostnameOf } = require('./contentDiscovery');

const GENERATION_MODEL = 'gpt-5.5';

const PERMITTED_CONTENT_TYPES = [
  'Official Update', 'Company Announcement', 'Product Update', 'Platform Guide',
  'Product Feature', 'Service Spotlight', 'User Guide', 'Safety Notice', 'Opportunity',
  'Educational Article', 'Policy Update', 'Pricing Update', 'Event', 'Community Update',
  'Frequently Asked Question', 'Platform Overview',
];

const PERMITTED_CATEGORIES = ['business', 'ecosystem', 'education', 'health', 'national', 'politics', 'sports', 'technology', 'world', 'district'];

const GENERATION_SYSTEM_PROMPT = `You are a factual newsroom content assistant for 256 Newsroom, writing about one platform in the 256 Ecosystem. You are given the extracted text of one public page from that platform's own official website. Write a short, professional, factual newsroom article using ONLY information explicitly present in that text.

Strict rules:
- Use only facts, features, prices, dates, and claims explicitly stated in the source text. Never invent, estimate, or assume anything not present.
- Never invent subscriber/user counts, revenue or financial figures, partnerships, awards, endorsements, certifications, launches, or events.
- Never claim something happened "today" or "recently" unless the source text gives an explicit date.
- Never present an existing/older feature as if newly launched.
- Never manufacture quotations or testimonials.
- If the source text does not contain enough substantive, newsworthy information to support a genuine article, respond with exactly {"insufficient": true, "reason": "<why, one sentence>"} and nothing else.
- contentType must be exactly one of: ${PERMITTED_CONTENT_TYPES.join(', ')}.
- category must be exactly one of: ${PERMITTED_CATEGORIES.join(', ')} (default "ecosystem" if nothing else clearly fits).
- Write in clear, professional, factual newsroom prose. No exaggerated marketing language unless clearly presented as a direct quotation from the source.

If there is enough information, respond with exactly this JSON shape and nothing else:
{"headline":"...","summary":"...","body":"...","contentType":"...","category":"...","tags":["...","..."],"disclosure":"...","callToAction":"..."}
- summary: one or two sentences, under 300 characters.
- body: 3-6 short paragraphs, markdown "##" subheadings allowed.
- tags: up to 6 short tags.
- disclosure: one sentence noting this was prepared from the official platform's published information.
- callToAction: one short sentence directing readers to the platform, referencing its real URL.`;

async function generateArticleFromEvidence({ platformName, websiteUrl, evidence, rotationHint }) {
  const user = [
    `Platform: ${platformName}`,
    `Platform website: ${websiteUrl}`,
    `Source page title: ${evidence.source_page_title || '(none)'}`,
    `Source page URL: ${evidence.canonical_url || evidence.source_url}`,
    rotationHint ? `Today's suggested content focus (soft preference only — factual availability always overrides this): ${rotationHint}` : '',
    '',
    'Source page text:',
    String(evidence.raw_text_snapshot || '').slice(0, 6000),
  ].filter(Boolean).join('\n');

  const { data } = await chatJson({ system: GENERATION_SYSTEM_PROMPT, user, model: GENERATION_MODEL });
  return data;
}

const VALIDATION_SYSTEM_PROMPT = `You are a strict fact-checker for a newsroom. You are given a source text and a generated article about it. Identify every material factual claim in the article (specific features, prices, dates, names, numbers, or claims that something is new/exclusive/an award/a partnership) and determine whether each is directly and explicitly supported by the source text. A claim is only "supported" if the source text actually states it — inference, paraphrase of something not present, or plausible-sounding detail is NOT supported.

Respond with exactly this JSON shape and nothing else:
{"allSupported": true|false, "unsupportedClaims": ["...", "..."]}`;

async function validateArticleClaims({ body, headline, summary, sourceText }) {
  const user = [
    'Source text:',
    String(sourceText || '').slice(0, 6000),
    '',
    'Generated article:',
    `Headline: ${headline}`,
    `Summary: ${summary}`,
    `Body: ${body}`,
  ].join('\n');

  const { data } = await chatJson({ system: VALIDATION_SYSTEM_PROMPT, user, model: GENERATION_MODEL });
  return data;
}

async function findExistingArticleByHash(organizationId, contentHash) {
  const { rows } = await pool.query(
    `select id from articles where organization_id = $1 and source_content_hash = $2 and status not in ('rejected','failed') limit 1`,
    [organizationId, contentHash],
  );
  return rows[0] || null;
}

// Orchestrates one full pipeline run for one piece of evidence: dedup check
// -> generate -> validate every material claim -> create the article at the
// status the platform's automation mode allows. Never creates a public
// article from a failed or unverified job.
async function runGenerationJob({ organizationId, sourceEvidenceId, triggeredBy = 'automation', rotationHint = null }) {
  const { rows: evidenceRows } = await pool.query('select * from source_evidence where id = $1 and organization_id = $2', [sourceEvidenceId, organizationId]);
  const evidence = evidenceRows[0];
  if (!evidence) throw new Error('Source evidence not found.');

  const { rows: orgRows } = await pool.query('select * from organizations where id = $1', [organizationId]);
  const org = orgRows[0];
  const { rows: settingsRows } = await pool.query('select * from automation_settings where organization_id = $1', [organizationId]);
  const settings = settingsRows[0];
  if (!settings) throw new Error('This platform has no automation settings configured.');
  if (settings.mode === 'paused') throw new Error('Automation is paused for this platform.');
  if (settings.mode === 'manual') throw new Error('This platform is set to manual-only — editors create articles directly.');

  const duplicate = await findExistingArticleByHash(organizationId, evidence.content_hash);
  if (duplicate) {
    const { rows: jobRows } = await pool.query(
      `insert into generation_jobs (organization_id, source_evidence_id, article_id, status, generation_model, triggered_by, finished_at)
       values ($1, $2, $3, 'skipped_duplicate', $4, $5, now()) returning *`,
      [organizationId, evidence.id, duplicate.id, GENERATION_MODEL, triggeredBy],
    );
    return { job: jobRows[0], article: null, skipped: 'duplicate' };
  }

  const { rows: jobRows } = await pool.query(
    `insert into generation_jobs (organization_id, source_evidence_id, status, generation_model, triggered_by)
     values ($1, $2, 'processing', $3, $4) returning *`,
    [organizationId, evidence.id, GENERATION_MODEL, triggeredBy],
  );
  let job = jobRows[0];

  async function fail(status, error) {
    const { rows } = await pool.query(
      `update generation_jobs set status = $2, error = $3, finished_at = now() where id = $1 returning *`,
      [job.id, status, error],
    );
    return rows[0];
  }

  let draft;
  try {
    draft = await generateArticleFromEvidence({
      platformName: org.name,
      websiteUrl: org.website_url,
      evidence,
      rotationHint,
    });
  } catch (err) {
    job = await fail('failed', `Generation call failed: ${err.message}`);
    return { job, article: null };
  }

  if (draft.insufficient) {
    job = await fail('rejected', `Insufficient source information: ${draft.reason || 'not specified'}`);
    return { job, article: null };
  }

  if (!draft.headline || !draft.body || !PERMITTED_CONTENT_TYPES.includes(draft.contentType)) {
    job = await fail('failed', 'Generated draft was missing required fields or used an invalid content type.');
    return { job, article: null };
  }
  if (!PERMITTED_CATEGORIES.includes(draft.category)) draft.category = 'ecosystem';

  // Platform identity, approved official URL and page title are trusted
  // discovery context, not invented article claims. Include them in the
  // validation corpus so accurate identity/attribution is not rejected just
  // because a page's visible <main> omits its brand name or <title>.
  const validationSource = [
    `Platform name: ${org.name}`,
    `Official platform website: ${org.website_url}`,
    `Official source page: ${evidence.canonical_url || evidence.source_url}`,
    `Source page title: ${evidence.source_page_title || ''}`,
    '',
    evidence.raw_text_snapshot || '',
  ].join('\n');

  let validation;
  try {
    validation = await validateArticleClaims({ body: draft.body, headline: draft.headline, summary: draft.summary, sourceText: validationSource });
  } catch (err) {
    job = await fail('failed', `Validation call failed: ${err.message}`);
    return { job, article: null };
  }

  if (!validation.allSupported) {
    job = await fail('rejected', `Unsupported claims: ${(validation.unsupportedClaims || []).join('; ') || 'unspecified'}`);
    return { job, article: null };
  }

  const status = settings.mode === 'automatic' ? 'published' : 'draft';
  const categoryId = await resolveId('categories', draft.category);
  const slug = await uniqueStorySlug(draft.headline, organizationId);
  const sourceDomain = hostnameOf(evidence.source_url);

  const { rows: articleRows } = await pool.query(
    `insert into articles
      (organization_id, ecosystem_organization_id, origin, title, summary, body, body_format,
       category_id, tags, image_url, external_url, slug, url, status, published_at,
       content_type, source_domain, source_page_title, source_content_hash,
       ai_generation_status, fact_verification_status, generation_model, generation_job_id,
       automation_rule_id, discovered_at, generated_at, featured_in_ecosystem, hidden)
     values
      ($1,$2,'ecosystem_ai_generated',$3,$4,$5,'markdown',
       $6,$7,$8,$9,$10,$11,$12,$13,
       $14,$15,$16,$17,
       'generated','verified',$18,$19,
       $20,$21,now(),true,false)
     returning *`,
    [
      organizationId, org.parent_organization_id, draft.headline, draft.summary, draft.body,
      categoryId, draft.tags || [], evidence.image_url, evidence.source_url, slug,
      `urn:256newsroom:ecosystem:${organizationId}:${slug}`, status, status === 'published' ? new Date() : null,
      draft.contentType, sourceDomain, evidence.source_page_title, evidence.content_hash,
      GENERATION_MODEL, job.id,
      settings.id, evidence.discovered_at,
    ],
  );
  const article = articleRows[0];

  const { rows: finishedJobRows } = await pool.query(
    `update generation_jobs set status = $2, article_id = $3, finished_at = now() where id = $1 returning *`,
    [job.id, status === 'published' ? 'published' : 'draft_ready', article.id],
  );

  return { job: finishedJobRows[0], article };
}

module.exports = {
  PERMITTED_CONTENT_TYPES,
  PERMITTED_CATEGORIES,
  generateArticleFromEvidence,
  validateArticleClaims,
  runGenerationJob,
};
