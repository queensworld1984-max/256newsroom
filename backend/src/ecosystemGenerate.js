const pool = require('./db');
const { chatJson } = require('./openaiClient');
const { slugify, uniqueStorySlug, resolveId } = require('./storiesCore');
const { hostnameOf } = require('./contentDiscovery');

const GENERATION_MODEL = 'gpt-5.5';
const EVIDENCE_LIMIT = 24000;
const MAX_REPAIR_ATTEMPTS = 2;

const PERMITTED_CONTENT_TYPES = [
  'Official Update', 'Company Announcement', 'Product Update', 'Platform Guide',
  'Product Feature', 'Service Spotlight', 'User Guide', 'Safety Notice', 'Opportunity',
  'Educational Article', 'Policy Update', 'Pricing Update', 'Event', 'Community Update',
  'Frequently Asked Question', 'Platform Overview',
];

const PERMITTED_CATEGORIES = ['business', 'ecosystem', 'education', 'health', 'national', 'politics', 'sports', 'consumer-technology', 'world'];

const GENERATION_SYSTEM_PROMPT = `You are the service-news writer for 256 Newsroom, preparing a substantial, persuasive but factual article about one platform in the 256 Ecosystem. The article should market the service by clearly explaining its usefulness, while maintaining newsroom accuracy. You are given trusted platform identity plus extracted information from the platform's official public website.

Strict rules:
- Every claim about the platform, its features, prices, availability, coverage, performance or users must be supported by the supplied evidence.
- You may frame an everyday service problem in cautious, general language without statistics (for example, that people need a simpler way to find a service). Do not claim how widespread, severe or costly a problem is unless the evidence states it.
- Comparisons must be category-level and evidence-led: explain how the listed features differ from a conventional or fragmented way of accessing the service. Do not name competitors, claim superiority, or invent competitor features, prices or shortcomings.
- Never invent subscriber/user counts, revenue or financial figures, partnerships, awards, endorsements, certifications, launches, or events.
- Treat live marketplace counts, active listings, supplier totals, RFQ totals, ratings and inventory as volatile interface data. Do not include them in an evergreen article unless the source gives an explicit measurement date and the article clearly states that date.
- Do not repeat phone numbers, email addresses, operating hours, response-time promises or support claims in the article unless the source identifies them as current, official service information and they are necessary to the article. Prefer directing readers to the official platform for current contact and support details.
- Do not turn sample/demo listings, placeholder profiles, interface examples or seeded marketplace data into claims about real service activity.
- Never claim something happened "today" or "recently" unless the source text gives an explicit date.
- Never present an existing/older feature as if newly launched.
- Never manufacture quotations or testimonials.
- If the source text does not contain enough substantive, newsworthy information to support a genuine article, respond with exactly {"insufficient": true, "reason": "<why, one sentence>"} and nothing else.
- contentType must be exactly one of: ${PERMITTED_CONTENT_TYPES.join(', ')}.
- category must be exactly one of: ${PERMITTED_CATEGORIES.join(', ')} (default "ecosystem" if nothing else clearly fits).
- Use confident, accessible service journalism. Market what is verifiably offered, but avoid hype, unsupported superlatives and vague promotional filler.

If there is enough information, respond with exactly this JSON shape and nothing else:
{"headline":"...","summary":"...","body":"...","contentType":"...","category":"...","tags":["...","..."],"disclosure":"...","callToAction":"..."}
- summary: one or two sentences, under 300 characters.
- body: EVERY 256 AI Systems / ecosystem AI article must be the SAME length band — target about 1,250 words, always between 1,150 and 1,350 words (never shorter stubs, never padded essays past 1,350).
- body must use exactly these markdown sections in this order:
  ## The problem on the ground
  ## What <platform name> offers
  ## How the service fills the gap
  ## Features, availability and access
  ## Why this matters for Uganda
- The opening paragraph before the first heading must lead with the service and the clearest reader benefit.
- Under the problem section, state the practical user need without invented statistics or unsupported claims about the whole country.
- Under the offer and solution sections, explain the platform's actual services and connect each major feature to a practical user benefit.
- Use concrete, source-supported examples—such as named service categories, locations, access methods, product types or eligibility details—so the article is useful rather than generic.
- Include one careful category-level comparison within "How the service fills the gap" based only on evidenced features.
- Under availability, say only what the evidence supports about locations, access channels, operating times, prices or eligibility. Clearly say when a detail is not stated rather than guessing.
- End the availability section with a clear limitations paragraph identifying important transaction, eligibility, pricing, fulfilment or access details that the source does not state. Do not turn absence of information into criticism.
- Under national importance, explain the potential relevance of the evidenced service to Uganda using cautious language such as "can", "could" or "is designed to"; never assert an unmeasured national outcome.
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
    String(evidence.raw_text_snapshot || '').slice(0, EVIDENCE_LIMIT),
  ].filter(Boolean).join('\n');

  const { data } = await chatJson({ system: GENERATION_SYSTEM_PROMPT, user, model: GENERATION_MODEL, timeoutMs: 120000 });
  return data;
}

const VALIDATION_SYSTEM_PROMPT = `You are a precise fact-checker for a service newsroom. You are given trusted platform context, official source evidence and a generated article. Identify every material factual claim about the platform, its services, features, prices, locations, availability, users, results, partners or status, and determine whether the meaning is supported by the evidence.

Apply these rules:
- Accept faithful paraphrases and summaries; support does not require the same words or sentence structure.
- Platform name, official website, official source URL and source-page title in the trusted context are supported facts.
- A cautious, non-quantified statement of an everyday user need is framing, not a factual claim requiring a statistic.
- A category-level comparison is acceptable only when it contrasts an evidenced feature with a generic process and makes no factual claim about a named competitor.
- Cautious statements of potential relevance using "can", "could", "may" or "is designed to" are acceptable when the mechanism is an evidenced feature. Claims of measured impact are not.
- Reject invented specifics, unsupported superlatives, ungrounded availability, or inference presented as established fact.
- Do not reject a supported claim merely because extracted web text has compressed spacing or navigation labels.

Respond with exactly this JSON shape and nothing else:
{"allSupported": true|false, "unsupportedClaims": ["...", "..."]}`;

async function validateArticleClaims({ body, headline, summary, sourceText }) {
  const user = [
    'Source text:',
    String(sourceText || '').slice(0, EVIDENCE_LIMIT),
    '',
    'Generated article:',
    `Headline: ${headline}`,
    `Summary: ${summary}`,
    `Body: ${body}`,
  ].join('\n');

  const { data } = await chatJson({ system: VALIDATION_SYSTEM_PROMPT, user, model: GENERATION_MODEL, timeoutMs: 90000 });
  return data;
}

const REPAIR_SYSTEM_PROMPT = `You repair a 256 Newsroom service article after fact-checking or length review. Rewrite only what is needed to remove or qualify every listed unsupported claim and to hit the required length band while retaining a persuasive, useful and complete article. Use only the supplied trusted context and official evidence for platform facts. Preserve the required section structure, supported features, practical problem statement, category-level comparison, Uganda relevance, disclosure and call to action. Never solve a verification issue by inventing replacement detail. Body length must be 1,150–1,350 words (target ~1,250) for every 256 ecosystem AI article.

Respond with exactly this JSON shape and nothing else:
{"headline":"...","summary":"...","body":"...","contentType":"...","category":"...","tags":["..."],"disclosure":"...","callToAction":"..."}`;

function composeArticleBody(draft) {
  return [
    String(draft.body || '').trim(),
    draft.callToAction ? `## How to access the service\n\n${String(draft.callToAction).trim()}` : '',
    draft.disclosure ? `*${String(draft.disclosure).trim()}*` : '',
  ].filter(Boolean).join('\n\n');
}

const REQUIRED_BODY_SECTIONS = [
  'The problem on the ground',
  'What ',
  'How the service fills the gap',
  'Features, availability and access',
  'Why this matters for Uganda',
];

// All ecosystem AI articles share one fixed length band so platform coverage feels uniform.
const ECOSYSTEM_TARGET_WORDS = 1250;
const ECOSYSTEM_MIN_WORDS = 1150;
const ECOSYSTEM_MAX_WORDS = 1350;

function articleStructureIssues(draft) {
  const body = String(draft?.body || '');
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const issues = [];
  if (wordCount < ECOSYSTEM_MIN_WORDS) {
    issues.push(
      `Article body is too brief (${wordCount} words); expand to ${ECOSYSTEM_MIN_WORDS}–${ECOSYSTEM_MAX_WORDS} words (target ~${ECOSYSTEM_TARGET_WORDS}) with sourced detail.`,
    );
  }
  if (wordCount > ECOSYSTEM_MAX_WORDS) {
    issues.push(
      `Article body is too long (${wordCount} words); trim to ${ECOSYSTEM_MIN_WORDS}–${ECOSYSTEM_MAX_WORDS} words (target ~${ECOSYSTEM_TARGET_WORDS}) without inventing new claims.`,
    );
  }
  for (const section of REQUIRED_BODY_SECTIONS) {
    if (!body.includes(`## ${section}`)) issues.push(`Missing required section beginning "## ${section}".`);
  }
  if (!draft?.callToAction) issues.push('Missing direct service-access call to action.');
  if (!draft?.disclosure) issues.push('Missing official-source disclosure.');
  return issues;
}

async function repairArticleClaims({ draft, unsupportedClaims, sourceText }) {
  const user = [
    'Trusted context and official evidence:',
    String(sourceText || '').slice(0, EVIDENCE_LIMIT),
    '',
    'Unsupported claims identified by fact-checking:',
    JSON.stringify(unsupportedClaims || []),
    '',
    'Draft to repair:',
    JSON.stringify(draft),
  ].join('\n');
  const { data } = await chatJson({ system: REPAIR_SYSTEM_PROMPT, user, model: GENERATION_MODEL, timeoutMs: 120000 });
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
    org.description ? `Platform description: ${org.description}` : '',
    `Official source page: ${evidence.canonical_url || evidence.source_url}`,
    `Source page title: ${evidence.source_page_title || ''}`,
    '',
    evidence.raw_text_snapshot || '',
  ].filter(Boolean).join('\n');

  let validation;
  let articleBody = composeArticleBody(draft);
  try {
    const initialStructureIssues = articleStructureIssues(draft);
    if (initialStructureIssues.length) {
      draft = await repairArticleClaims({ draft, unsupportedClaims: initialStructureIssues, sourceText: validationSource });
      articleBody = composeArticleBody(draft);
    }
    validation = await validateArticleClaims({ body: articleBody, headline: draft.headline, summary: draft.summary, sourceText: validationSource });
    for (let attempt = 0; !validation.allSupported && attempt < MAX_REPAIR_ATTEMPTS; attempt += 1) {
      draft = await repairArticleClaims({
        draft,
        unsupportedClaims: validation.unsupportedClaims,
        sourceText: validationSource,
      });
      if (!draft.headline || !draft.body || !PERMITTED_CONTENT_TYPES.includes(draft.contentType)) {
        throw new Error('Repaired draft was missing required fields or used an invalid content type.');
      }
      if (!PERMITTED_CATEGORIES.includes(draft.category)) draft.category = 'ecosystem';
      const structureIssues = articleStructureIssues(draft);
      if (structureIssues.length) {
        draft = await repairArticleClaims({ draft, unsupportedClaims: structureIssues, sourceText: validationSource });
      }
      articleBody = composeArticleBody(draft);
      validation = await validateArticleClaims({ body: articleBody, headline: draft.headline, summary: draft.summary, sourceText: validationSource });
    }
  } catch (err) {
    job = await fail('failed', `Validation or repair call failed: ${err.message}`);
    return { job, article: null };
  }

  const finalStructureIssues = articleStructureIssues(draft);
  if (finalStructureIssues.length) {
    job = await fail('rejected', `Incomplete article structure: ${finalStructureIssues.join('; ')}`);
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
      organizationId, org.parent_organization_id, draft.headline, draft.summary, articleBody,
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
  repairArticleClaims,
  composeArticleBody,
  articleStructureIssues,
  runGenerationJob,
};
