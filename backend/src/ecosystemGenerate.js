const pool = require('./db');
const { chatJson } = require('./openaiClient');
const { slugify, uniqueStorySlug, resolveId } = require('./storiesCore');
const { hostnameOf } = require('./contentDiscovery');

const GENERATION_MODEL = 'gpt-5.5';
const EVIDENCE_LIMIT = 24000;
const MAX_REPAIR_ATTEMPTS = 2;
/** Soft length nudge only — never blocks publish. */
const MAX_LENGTH_REPAIR_ATTEMPTS = 1;
/** Long-form ecosystem pieces need more headroom than short API calls. */
const GENERATION_TIMEOUT_MS = 180000;
const REPAIR_TIMEOUT_MS = 150000;
const VALIDATION_TIMEOUT_MS = 120000;

const PERMITTED_CONTENT_TYPES = [
  'Official Update', 'Company Announcement', 'Product Update', 'Platform Guide',
  'Product Feature', 'Service Spotlight', 'User Guide', 'Safety Notice', 'Opportunity',
  'Educational Article', 'Policy Update', 'Pricing Update', 'Event', 'Community Update',
  'Frequently Asked Question', 'Platform Overview',
];

const PERMITTED_CATEGORIES = ['business', 'ecosystem', 'education', 'health', 'national', 'politics', 'sports', 'consumer-technology', 'world'];

/**
 * Operator-provided identity that official public pages may brand differently.
 * Fact-checker and generator must treat these as supported facts so we do not
 * reject "256 Corporate" merely because 256.co.ug says "256 AI Systems".
 */
const ECOSYSTEM_TRUSTED_IDENTITY = {
  '256-corporate': {
    newsroomName: '256 Corporate',
    publicBrands: ['256 AI Systems', '256 Artificial Intelligence Technologies Co. Ltd', '256 Corporate'],
    legalName: '256 Artificial Intelligence Technologies Co. Ltd',
    role: 'Main company and corporate arm of 256 AI Systems; built and operates the broader 256 ecosystem of platforms.',
    services: [
      'Enterprise software and large-scale systems development',
      'Websites and digital product engineering',
      'Cybersecurity and digital protection',
      'Cloud infrastructure and DevOps',
      'AI and intelligence tools',
      'Data analytics and institutional platforms',
    ],
    website: 'https://256.co.ug',
    alternateWebsites: ['https://enterprise.256.co.ug', 'https://256.co.ug'],
    notes: [
      'The public website often brands as “256 AI Systems” and does not always print the newsroom name “256 Corporate”.',
      '“256 Corporate” is the approved 256 Newsroom publisher name for this corporate arm; it is the same organization as the 256 AI Systems enterprise company on 256.co.ug.',
      'Service lines and institutional positioning on 256.co.ug / enterprise.256.co.ug describe this corporate arm’s offerings.',
      'Sister consumer/product platforms (Mall, Express, Heart, AI product sites, etc.) are part of the ecosystem this company builds and operates; do not invent metrics for those platforms unless the evidence states them.',
    ],
  },
};

function resolveTrustedIdentity(org) {
  if (!org) return null;
  const bySlug = ECOSYSTEM_TRUSTED_IDENTITY[String(org.slug || '').toLowerCase()];
  if (bySlug) return bySlug;
  const nameKey = String(org.name || '').trim().toLowerCase();
  if (nameKey === '256 corporate') return ECOSYSTEM_TRUSTED_IDENTITY['256-corporate'];
  return null;
}

function formatTrustedIdentityBlock(org, trusted) {
  if (!trusted) {
    return [
      `Platform name (newsroom): ${org.name}`,
      `Official platform website: ${org.website_url || '(none)'}`,
      org.description ? `Platform description: ${org.description}` : '',
    ].filter(Boolean).join('\n');
  }
  return [
    '=== TRUSTED PLATFORM IDENTITY (operator-approved; treat as supported facts) ===',
    `Newsroom platform name: ${trusted.newsroomName}`,
    `Public brand names that refer to the same organization: ${trusted.publicBrands.join('; ')}`,
    trusted.legalName ? `Legal / registered company name: ${trusted.legalName}` : '',
    `Role: ${trusted.role}`,
    `Enterprise service lines (corporate arm): ${trusted.services.join('; ')}`,
    `Primary official website: ${trusted.website}`,
    trusted.alternateWebsites?.length
      ? `Accepted official website aliases: ${trusted.alternateWebsites.join(', ')}`
      : '',
    org.description ? `Newsroom description: ${org.description}` : '',
    ...trusted.notes.map((n) => `Note: ${n}`),
    'When the scraped page says “256 AI Systems” (or the legal company name) and the article says “256 Corporate”, treat those as the same entity — do not flag as unsupported solely for the name difference.',
    'Cautious paraphrases of trusted identity (e.g. Uganda-based enterprise digital infrastructure company) are supported when they match the trusted role/services or official page positioning.',
    '=== END TRUSTED PLATFORM IDENTITY ===',
  ].filter(Boolean).join('\n');
}

const GENERATION_SYSTEM_PROMPT = `You are the service-news writer for 256 Newsroom, preparing a substantial, persuasive but factual article about one platform in the 256 Ecosystem. The article should market the service by clearly explaining its usefulness, while maintaining newsroom accuracy. You are given trusted platform identity plus extracted information from the platform's official public website.

Strict rules:
- Trusted platform identity supplied in the user message is authoritative for the organization's name, role, legal name, website and high-level service lines. Use the newsroom platform name (e.g. “256 Corporate”) even when the public website brands as “256 AI Systems”.
- Every specific claim about products, prices, availability, coverage, performance, users or one-off events must still be supported by the supplied page evidence (or trusted identity). Do not invent metrics or testimonials.
- Every claim about the platform, its features, prices, availability, coverage, performance or users must be supported by the supplied evidence or trusted identity.
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
- body: Aim for a substantial service article around ~1,250 words when the evidence supports it. Length is flexible — roughly 900–1,800 words is fine. Prefer completeness and usefulness over hitting an exact count. Do not pad with filler and do not refuse to write because of length.
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

async function generateArticleFromEvidence({
  platformName,
  websiteUrl,
  evidence,
  rotationHint,
  trustedIdentityBlock = null,
}) {
  const user = [
    trustedIdentityBlock || `Platform: ${platformName}\nPlatform website: ${websiteUrl}`,
    `Source page title: ${evidence.source_page_title || '(none)'}`,
    `Source page URL: ${evidence.canonical_url || evidence.source_url}`,
    rotationHint ? `Today's suggested content focus (soft preference only — factual availability always overrides this): ${rotationHint}` : '',
    '',
    'Write using the newsroom platform name from trusted identity. If the scraped page brands differently (e.g. 256 AI Systems vs 256 Corporate), treat them as the same organization and prefer the newsroom name in the article while reflecting the real website URL.',
    '',
    'Source page text:',
    String(evidence.raw_text_snapshot || '').slice(0, EVIDENCE_LIMIT),
  ].filter(Boolean).join('\n');

  const { data } = await chatJson({
    system: GENERATION_SYSTEM_PROMPT,
    user,
    model: GENERATION_MODEL,
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
  return data;
}

const VALIDATION_SYSTEM_PROMPT = `You are a precise fact-checker for a service newsroom. You are given trusted platform context, official source evidence and a generated article. Identify every material factual claim about the platform, its services, features, prices, locations, availability, users, results, partners or status, and determine whether the meaning is supported by the evidence.

Apply these rules:
- Accept faithful paraphrases and summaries; support does not require the same words or sentence structure.
- Platform name, official website, official source URL, source-page title, legal name, role, and service-line facts in the TRUSTED PLATFORM IDENTITY block are supported facts even when the scraped page uses a different brand string.
- CRITICAL brand alias rule: “256 Corporate”, “256 AI Systems”, and “256 Artificial Intelligence Technologies Co. Ltd” may refer to the same corporate organization when the trusted identity says so. Do NOT reject an article for using the newsroom name “256 Corporate” if the page only says “256 AI Systems” (or the legal company name), and do not reject “published under / operated by” language that matches the trusted legal or brand names.
- Descriptions that match trusted identity positioning (e.g. Uganda-based enterprise digital infrastructure / enterprise software, websites, cybersecurity) are supported even if the exact marketing phrase does not appear verbatim on the page.
- Cybersecurity and other service claims are supported when they match trusted service lines or page evidence about those services; institutional/critical-systems framing is acceptable as cautious category language when the source discusses institutions, governments, banks or similar clients.
- A cautious, non-quantified statement of an everyday user need is framing, not a factual claim requiring a statistic.
- A category-level comparison is acceptable only when it contrasts an evidenced feature with a generic process and makes no factual claim about a named competitor.
- Cautious statements of potential relevance using "can", "could", "may" or "is designed to" are acceptable when the mechanism is an evidenced feature. Claims of measured impact are not.
- Reject invented specifics, unsupported superlatives, ungrounded availability, or inference presented as established fact — but never reject solely for brand-name alias differences documented in trusted identity.
- Do not reject a supported claim merely because extracted web text has compressed spacing or navigation labels.

Respond with exactly this JSON shape and nothing else:
{"allSupported": true|false, "unsupportedClaims": ["...", "..."]}`;

async function validateArticleClaims({ body, headline, summary, sourceText }) {
  const user = [
    'Trusted context and source evidence (includes TRUSTED PLATFORM IDENTITY when provided):',
    String(sourceText || '').slice(0, EVIDENCE_LIMIT),
    '',
    'Generated article:',
    `Headline: ${headline}`,
    `Summary: ${summary}`,
    `Body: ${body}`,
  ].join('\n');

  const { data } = await chatJson({
    system: VALIDATION_SYSTEM_PROMPT,
    user,
    model: GENERATION_MODEL,
    timeoutMs: VALIDATION_TIMEOUT_MS,
  });
  return data;
}

const REPAIR_SYSTEM_PROMPT = `You repair a 256 Newsroom service article after fact-checking. Rewrite only what is needed to remove or qualify every listed unsupported claim while retaining a persuasive, useful and complete article. Use only the supplied trusted context and official evidence for platform facts. Preserve the required section structure, supported features, practical problem statement, category-level comparison, Uganda relevance, disclosure and call to action. Never solve a verification issue by inventing replacement detail. Length is flexible (~900–1,800 words is fine; target around 1,250 when evidence allows). Prefer accuracy over exact word count.

Respond with exactly this JSON shape and nothing else:
{"headline":"...","summary":"...","body":"...","contentType":"...","category":"...","tags":["..."],"disclosure":"...","callToAction":"..."}`;

const LENGTH_REPAIR_SYSTEM_PROMPT = `You optionally adjust the length of a 256 Newsroom ecosystem service article toward a soft target. Preserve all required markdown section headings, factual accuracy, disclosure and call to action. Do not invent new claims. Prefer cutting obvious redundancy when very long; when very short, expand only with detail already supported by the trusted evidence. Exact word count is not mandatory — usefulness and structure matter more.

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

// Soft guidance only — length never rejects a job.
const ECOSYSTEM_TARGET_WORDS = 1250;
const ECOSYSTEM_SOFT_MIN_WORDS = 900;
const ECOSYSTEM_SOFT_MAX_WORDS = 1800;
// Absolute empty-stub guard only (still not a tight band).
const ECOSYSTEM_ABSOLUTE_MIN_WORDS = 250;
// Legacy aliases kept for any external imports / admin display.
const ECOSYSTEM_MIN_WORDS = ECOSYSTEM_SOFT_MIN_WORDS;
const ECOSYSTEM_MAX_WORDS = ECOSYSTEM_SOFT_MAX_WORDS;

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Hard structure checks only (sections, CTA, disclosure).
 * Word count is never a reject reason.
 */
function articleStructureIssues(draft) {
  const body = String(draft?.body || '');
  const issues = [];
  for (const section of REQUIRED_BODY_SECTIONS) {
    if (!body.includes(`## ${section}`)) issues.push(`Missing required section beginning "## ${section}".`);
  }
  if (!draft?.callToAction) issues.push('Missing direct service-access call to action.');
  if (!draft?.disclosure) issues.push('Missing official-source disclosure.');
  return issues;
}

/**
 * Soft length guidance for optional repair — never used to reject jobs.
 * Only nudge when clearly outside a wide comfortable range.
 */
function lengthOnlyIssues(draft) {
  const wordCount = countWords(draft?.body);
  const issues = [];
  if (wordCount > 0 && wordCount < ECOSYSTEM_SOFT_MIN_WORDS) {
    issues.push(
      `Body is on the short side (${wordCount} words); soft target ~${ECOSYSTEM_TARGET_WORDS} (flexible ${ECOSYSTEM_SOFT_MIN_WORDS}–${ECOSYSTEM_SOFT_MAX_WORDS}). Expand only if evidence supports it.`,
    );
  }
  if (wordCount > ECOSYSTEM_SOFT_MAX_WORDS) {
    issues.push(
      `Body is on the long side (${wordCount} words); soft target ~${ECOSYSTEM_TARGET_WORDS} (flexible ${ECOSYSTEM_SOFT_MIN_WORDS}–${ECOSYSTEM_SOFT_MAX_WORDS}). Trim redundancy if easy — exact count is not required.`,
    );
  }
  return issues;
}

/** Optional mild trim for extreme overshoot only; never used for hard rejection. */
function trimBodyToMaxWords(body, maxWords = ECOSYSTEM_SOFT_MAX_WORDS) {
  let text = String(body || '').trim();
  if (countWords(text) <= maxWords) return text;

  const blocks = text.split(/\n\n+/);
  const isHeading = (block) => /^#{1,3}\s+\S/.test(block.trim());

  for (let safety = 0; safety < 400 && countWords(text) > maxWords; safety += 1) {
    let longestIdx = -1;
    let longestLen = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (!block || isHeading(block)) continue;
      const len = countWords(block);
      if (len > longestLen && len > 25) {
        longestLen = len;
        longestIdx = i;
      }
    }
    if (longestIdx < 0) break;

    const block = blocks[longestIdx];
    const trimmed = block
      .replace(/\s+[^.!?\n]{12,}[.!?]\s*$/u, '')
      .replace(/\s+[^.!?\n]{20,}\s*$/u, '')
      .trim();
    if (!trimmed || trimmed === block.trim() || countWords(trimmed) < 12) {
      blocks.splice(longestIdx, 1);
    } else {
      blocks[longestIdx] = trimmed;
    }
    text = blocks.filter(Boolean).join('\n\n').trim();
  }
  return text;
}

async function repairArticleClaims({ draft, unsupportedClaims, sourceText }) {
  const wc = countWords(draft?.body);
  const user = [
    'Trusted context and official evidence:',
    String(sourceText || '').slice(0, EVIDENCE_LIMIT),
    '',
    `Current body word count: ${wc}. Soft target ~${ECOSYSTEM_TARGET_WORDS} (flexible ${ECOSYSTEM_SOFT_MIN_WORDS}–${ECOSYSTEM_SOFT_MAX_WORDS}). Do not reject or abandon the draft over length.`,
    '',
    'Unsupported claims identified by fact-checking:',
    JSON.stringify(unsupportedClaims || []),
    '',
    'Draft to repair:',
    JSON.stringify(draft),
  ].join('\n');
  const { data } = await chatJson({
    system: REPAIR_SYSTEM_PROMPT,
    user,
    model: GENERATION_MODEL,
    timeoutMs: REPAIR_TIMEOUT_MS,
  });
  return data;
}

async function repairArticleLength({ draft, sourceText, issues }) {
  const wc = countWords(draft?.body);
  const user = [
    'Trusted context and official evidence (use only if expanding a short draft):',
    String(sourceText || '').slice(0, EVIDENCE_LIMIT),
    '',
    `Soft length nudge only. Current body word count is ${wc}.`,
    `Prefer ~${ECOSYSTEM_TARGET_WORDS} words when natural; acceptable flexible range ${ECOSYSTEM_SOFT_MIN_WORDS}–${ECOSYSTEM_SOFT_MAX_WORDS}. Exact count is NOT required.`,
    issues?.length ? `Notes: ${issues.join('; ')}` : '',
    wc > ECOSYSTEM_SOFT_MAX_WORDS
      ? 'If easy, lightly trim redundancy. Keep all required sections and facts.'
      : 'If easy and evidence supports it, expand a little. Do not invent claims.',
    '',
    'Draft to length-adjust:',
    JSON.stringify(draft),
  ].filter(Boolean).join('\n');

  const { data } = await chatJson({
    system: LENGTH_REPAIR_SYSTEM_PROMPT,
    user,
    model: GENERATION_MODEL,
    timeoutMs: REPAIR_TIMEOUT_MS,
  });
  return data;
}

/**
 * Optional soft length nudge. Never throws for length; never hard-rejects.
 * Accepts the draft as-is when already in the flexible range or after one try.
 */
async function ensureBodyLengthBand(draft, sourceText) {
  let next = draft;
  const issues = lengthOnlyIssues(next);
  if (!issues.length) return next;

  for (let attempt = 0; attempt < MAX_LENGTH_REPAIR_ATTEMPTS; attempt += 1) {
    try {
      const repaired = await repairArticleLength({ draft: next, sourceText, issues: lengthOnlyIssues(next) });
      if (!repaired?.body) break;
      next = repaired;
      if (!PERMITTED_CONTENT_TYPES.includes(next.contentType) && draft.contentType) {
        next.contentType = draft.contentType;
      }
      if (!PERMITTED_CATEGORIES.includes(next.category)) next.category = draft.category || 'ecosystem';
      if (!next.callToAction && draft.callToAction) next.callToAction = draft.callToAction;
      if (!next.disclosure && draft.disclosure) next.disclosure = draft.disclosure;
      if (!next.headline && draft.headline) next.headline = draft.headline;
      if (!next.summary && draft.summary) next.summary = draft.summary;
    } catch {
      // Length repair is best-effort only — keep the prior draft.
      break;
    }
  }

  // Only mild trim on extreme overshoot (well past soft max); still no reject.
  if (countWords(next.body) > ECOSYSTEM_SOFT_MAX_WORDS * 1.5) {
    next = {
      ...next,
      body: trimBodyToMaxWords(next.body, Math.round(ECOSYSTEM_SOFT_MAX_WORDS * 1.25)),
    };
  }
  return next;
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

  const trusted = resolveTrustedIdentity(org);
  const trustedIdentityBlock = formatTrustedIdentityBlock(org, trusted);
  const websiteUrl = trusted?.website || org.website_url;

  let draft;
  try {
    draft = await generateArticleFromEvidence({
      platformName: org.name,
      websiteUrl,
      evidence,
      rotationHint,
      trustedIdentityBlock,
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

  // Platform identity (including brand aliases) is trusted operator context.
  // Scraped pages may brand as “256 AI Systems” while newsroom name is
  // “256 Corporate” — validation must accept that alias mapping.
  const validationSource = [
    trustedIdentityBlock,
    `Official source page: ${evidence.canonical_url || evidence.source_url}`,
    `Source page title: ${evidence.source_page_title || ''}`,
    '',
    '=== SCRAPED PAGE TEXT ===',
    evidence.raw_text_snapshot || '',
  ].filter(Boolean).join('\n');

  let validation;
  let articleBody = composeArticleBody(draft);
  try {
    // Soft length nudge only — never blocks acceptance on word count.
    draft = await ensureBodyLengthBand(draft, validationSource);

    const structureIssues = articleStructureIssues(draft);
    if (structureIssues.length) {
      draft = await repairArticleClaims({
        draft,
        unsupportedClaims: structureIssues,
        sourceText: validationSource,
      });
      // Best-effort; length stays flexible after structure repair.
      draft = await ensureBodyLengthBand(draft, validationSource);
    }

    articleBody = composeArticleBody(draft);
    validation = await validateArticleClaims({
      body: articleBody,
      headline: draft.headline,
      summary: draft.summary,
      sourceText: validationSource,
    });
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
      const afterRepairStructure = articleStructureIssues(draft);
      if (afterRepairStructure.length) {
        draft = await repairArticleClaims({
          draft,
          unsupportedClaims: afterRepairStructure,
          sourceText: validationSource,
        });
      }
      articleBody = composeArticleBody(draft);
      validation = await validateArticleClaims({
        body: articleBody,
        headline: draft.headline,
        summary: draft.summary,
        sourceText: validationSource,
      });
    }
  } catch (err) {
    job = await fail('failed', `Validation or repair call failed: ${err.message}`);
    return { job, article: null };
  }

  // Structure only — word count never rejects.
  const finalStructureIssues = articleStructureIssues(draft);
  if (finalStructureIssues.length) {
    job = await fail('rejected', `Incomplete article structure: ${finalStructureIssues.join('; ')}`);
    return { job, article: null };
  }

  // Empty-stub guard only (not the old tight 1150–1350 band).
  if (countWords(draft.body) < ECOSYSTEM_ABSOLUTE_MIN_WORDS) {
    job = await fail(
      'rejected',
      `Article body is essentially empty (${countWords(draft.body)} words); need at least a short substantive article.`,
    );
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
  ECOSYSTEM_TRUSTED_IDENTITY,
  resolveTrustedIdentity,
  formatTrustedIdentityBlock,
  generateArticleFromEvidence,
  validateArticleClaims,
  repairArticleClaims,
  repairArticleLength,
  ensureBodyLengthBand,
  composeArticleBody,
  articleStructureIssues,
  countWords,
  trimBodyToMaxWords,
  runGenerationJob,
  ECOSYSTEM_MIN_WORDS,
  ECOSYSTEM_MAX_WORDS,
  ECOSYSTEM_SOFT_MIN_WORDS,
  ECOSYSTEM_SOFT_MAX_WORDS,
  ECOSYSTEM_ABSOLUTE_MIN_WORDS,
  ECOSYSTEM_TARGET_WORDS,
};
