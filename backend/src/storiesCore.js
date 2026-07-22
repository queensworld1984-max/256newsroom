const pool = require('./db');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function resolveId(table, slug) {
  if (!slug) return null;
  const { rows } = await pool.query(`select id from ${table} where slug = $1`, [slug]);
  return rows[0]?.id || null;
}

async function uniqueStorySlug(title, organizationId) {
  const base = slugify(title) || 'story';
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const { rows } = organizationId
      ? await pool.query('select 1 from articles where organization_id = $1 and slug = $2', [organizationId, candidate])
      : await pool.query('select 1 from articles where organization_id is null and slug = $1', [candidate]);
    if (!rows.length) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

const STORY_STATUSES = new Set(['draft', 'scheduled', 'published', 'withdrawn', 'pending_review', 'rejected', 'archived']);

function pickStoryInput(body) {
  return {
    title: body.title !== undefined ? String(body.title).trim().slice(0, 300) : undefined,
    summary: body.summary !== undefined ? String(body.summary).trim().slice(0, 500) : undefined,
    body: body.body !== undefined ? String(body.body) : undefined,
    bodyFormat: body.bodyFormat !== undefined ? String(body.bodyFormat).slice(0, 20) : undefined,
    imageUrl: body.imageUrl !== undefined ? String(body.imageUrl).slice(0, 1000) : undefined,
    imageCaption: body.imageCaption !== undefined ? String(body.imageCaption).slice(0, 300) : undefined,
    imageCredit: body.imageCredit !== undefined ? String(body.imageCredit).slice(0, 200) : undefined,
    categorySlug: body.categorySlug,
    districtSlug: body.districtSlug,
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 40)).slice(0, 20) : undefined,
    externalUrl: body.externalUrl !== undefined ? String(body.externalUrl).slice(0, 1000) : undefined,
    breaking: body.breaking !== undefined ? Boolean(body.breaking) : undefined,
    developing: body.developing !== undefined ? Boolean(body.developing) : undefined,
    sourceDocuments: Array.isArray(body.sourceDocuments) ? body.sourceDocuments : undefined,
  };
}

async function createStory({ organizationId, journalistId, createdByUserId, input }) {
  if (!input.title) throw Object.assign(new Error('Title is required.'), { status: 400 });

  const categoryId = input.categorySlug !== undefined ? await resolveId('categories', input.categorySlug) : null;
  const districtId = input.districtSlug !== undefined ? await resolveId('districts', input.districtSlug) : null;
  const slug = await uniqueStorySlug(input.title, organizationId);

  const { rows } = await pool.query(
    `insert into articles
      (organization_id, journalist_id, created_by_user_id, origin, title, summary, body, body_format,
       image_url, image_caption, image_credit, tags, external_url, breaking, developing, source_documents,
       slug, status, url, hidden)
     values
      ($1,$2,$3,'publisher_authored',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft',$17,false)
     returning *`,
    [
      organizationId, journalistId, createdByUserId,
      input.title, input.summary || null, input.body || null, input.bodyFormat || 'markdown',
      input.imageUrl || null, input.imageCaption || null, input.imageCredit || null,
      input.tags || [], input.externalUrl || null, Boolean(input.breaking), Boolean(input.developing),
      JSON.stringify(input.sourceDocuments || []),
      slug,
      // articles.url is unique + not null in the legacy schema; publisher-authored
      // stories use their own permalink as a stand-in canonical URL.
      `urn:256newsroom:story:${organizationId || 'independent'}:${slug}`,
    ],
  );
  return applyPatch(rows[0].id, { categoryId, districtId }, true);
}

async function applyPatch(articleId, fields, skipTitleCheck = false) {
  const sets = [];
  const values = [];
  let i = 1;

  const push = (column, value) => {
    sets.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  };

  if (fields.title !== undefined) {
    if (!skipTitleCheck && !fields.title) throw Object.assign(new Error('Title cannot be empty.'), { status: 400 });
    push('title', fields.title);
  }
  if (fields.summary !== undefined) push('summary', fields.summary);
  if (fields.body !== undefined) push('body', fields.body);
  if (fields.bodyFormat !== undefined) push('body_format', fields.bodyFormat);
  if (fields.imageUrl !== undefined) push('image_url', fields.imageUrl);
  if (fields.imageCaption !== undefined) push('image_caption', fields.imageCaption);
  if (fields.imageCredit !== undefined) push('image_credit', fields.imageCredit);
  if (fields.tags !== undefined) push('tags', fields.tags);
  if (fields.externalUrl !== undefined) push('external_url', fields.externalUrl);
  if (fields.breaking !== undefined) push('breaking', fields.breaking);
  if (fields.developing !== undefined) push('developing', fields.developing);
  if (fields.sourceDocuments !== undefined) push('source_documents', JSON.stringify(fields.sourceDocuments));
  if (fields.categoryId !== undefined) push('category_id', fields.categoryId);
  if (fields.districtId !== undefined) push('district_id', fields.districtId);

  if (!sets.length) {
    const { rows } = await pool.query('select * from articles where id = $1', [articleId]);
    return rows[0];
  }

  sets.push('updated_at = now()');
  values.push(articleId);
  const { rows } = await pool.query(
    `update articles set ${sets.join(', ')} where id = $${i} returning *`,
    values,
  );
  return rows[0];
}

async function updateStory(articleId, input) {
  const patch = { ...input };
  if (input.categorySlug !== undefined) patch.categoryId = await resolveId('categories', input.categorySlug);
  if (input.districtSlug !== undefined) patch.districtId = await resolveId('districts', input.districtSlug);
  delete patch.categorySlug;
  delete patch.districtSlug;
  return applyPatch(articleId, patch);
}

async function submitForReview(articleId) {
  const { rows } = await pool.query(
    `update articles set status = 'pending_review', updated_at = now()
     where id = $1 and status = 'draft'
     returning *`,
    [articleId],
  );
  if (!rows.length) throw Object.assign(new Error('Only a draft story can be submitted for review.'), { status: 400 });
  return rows[0];
}

async function approveStory(articleId, approvedByUserId) {
  const { rows } = await pool.query(
    `update articles set
       status = 'draft',
       approved_at = now(),
       approved_by_user_id = $2,
       updated_at = now()
     where id = $1 and status = 'pending_review'
     returning *`,
    [articleId, approvedByUserId],
  );
  if (!rows.length) throw Object.assign(new Error('Only a story pending review can be approved.'), { status: 400 });
  return rows[0];
}

async function isOrgApproved(organizationId) {
  if (!organizationId) return true; // independent journalists — no org-level gate
  const { rows } = await pool.query('select verification_status, is_official from organizations where id = $1', [organizationId]);
  return rows[0] && (rows[0].verification_status === 'approved' || rows[0].is_official);
}

async function publishStory(articleId) {
  const { rows } = await pool.query('select organization_id, published_at from articles where id = $1', [articleId]);
  const article = rows[0];
  if (!article) throw Object.assign(new Error('Story not found.'), { status: 404 });

  const approved = await isOrgApproved(article.organization_id);
  if (!approved) {
    throw Object.assign(new Error('This organization is not yet an approved publisher and cannot publish stories.'), { status: 403 });
  }

  let featuredInEcosystem = false;
  if (article.organization_id) {
    const { rows: orgRows } = await pool.query('select is_official from organizations where id = $1', [article.organization_id]);
    featuredInEcosystem = Boolean(orgRows[0]?.is_official);
  }

  const { rows: updated } = await pool.query(
    `update articles set
       status = 'published',
       published_at = coalesce(published_at, now()),
       withdrawn_at = null,
       withdrawn_reason = null,
       featured_in_ecosystem = case when $2 then true else featured_in_ecosystem end,
       updated_at = now()
     where id = $1
     returning *`,
    [articleId, featuredInEcosystem],
  );
  return updated[0];
}

async function scheduleStory(articleId, scheduledPublishAt) {
  const { rows } = await pool.query(
    `update articles set status = 'scheduled', scheduled_publish_at = $2, updated_at = now() where id = $1 returning *`,
    [articleId, scheduledPublishAt],
  );
  return rows[0];
}

async function withdrawStory(articleId, reason, withdrawnByUserId = null) {
  const { rows } = await pool.query(
    `update articles set status = 'withdrawn', withdrawn_at = now(), withdrawn_reason = $2, withdrawn_by_user_id = $3, updated_at = now() where id = $1 returning *`,
    [articleId, reason || null, withdrawnByUserId],
  );
  return rows[0];
}

async function rejectStory(articleId, reason, rejectedByUserId) {
  const { rows } = await pool.query(
    `update articles set status = 'rejected', rejected_at = now(), rejected_reason = $2, rejected_by_user_id = $3, updated_at = now() where id = $1 returning *`,
    [articleId, reason || null, rejectedByUserId || null],
  );
  return rows[0];
}

async function archiveStory(articleId) {
  const { rows } = await pool.query(
    `update articles set status = 'archived', archived_at = now(), updated_at = now() where id = $1 returning *`,
    [articleId],
  );
  return rows[0];
}

async function addCorrection(articleId, { note, newBody, newHeadline, correctedByUserId }) {
  const { rows: current } = await pool.query('select title, body from articles where id = $1', [articleId]);
  if (!current.length) throw Object.assign(new Error('Story not found.'), { status: 404 });

  await pool.query(
    `insert into article_corrections (article_id, corrected_by_user_id, correction_note, previous_body, previous_headline)
     values ($1, $2, $3, $4, $5)`,
    [articleId, correctedByUserId, note || null, current[0].body, current[0].title],
  );

  const patch = {};
  if (newHeadline !== undefined) patch.title = newHeadline;
  if (newBody !== undefined) patch.body = newBody;
  return Object.keys(patch).length ? applyPatch(articleId, patch) : current[0];
}

module.exports = {
  slugify,
  resolveId,
  uniqueStorySlug,
  pickStoryInput,
  createStory,
  updateStory,
  submitForReview,
  approveStory,
  publishStory,
  scheduleStory,
  withdrawStory,
  rejectStory,
  archiveStory,
  addCorrection,
  isOrgApproved,
  STORY_STATUSES,
};
