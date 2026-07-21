const pool = require('./db');
const { chatJson } = require('./openaiClient');

const MODEL = 'gpt-5.5';
const GENERATE_PROMPT = `You are preparing an attributed story digest for 256 Newsroom. Write a neutral summary of 60-150 words using ONLY the supplied evidence snippets. Use original wording; do not copy a full sentence from the evidence. State the essential event, identify who is involved, and add context only when another supplied source explicitly supports it. Do not invent facts, quotations, motives, causes, dates, locations, or outcomes. Do not imply that 256 Newsroom did original reporting. Never pad the word count by discussing what the evidence or snippet does not provide; if that would be necessary, mark the evidence insufficient. Return JSON only. If the evidence cannot support at least 60 useful factual words without padding or speculation, return {"insufficient":true,"reason":"..."}. Otherwise return {"insufficient":false,"summary":"..."}.`;
const VALIDATE_PROMPT = `You are a strict factual editor. Compare the proposed digest with the supplied evidence. Every factual claim must be directly supported. The digest must be 60-150 words, neutrally attributed, independently worded, and contain no invented quotation, substantial copied sentence, padding, or meta-commentary about missing details/evidence/snippets. Return JSON only: {"valid":true,"unsupportedClaims":[],"copiedPhrases":[]} only if every requirement passes; otherwise return valid false with concise arrays.`;

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

async function evidenceForArticle(articleId) {
  const { rows } = await pool.query(`
    select a.id, a.title, a.summary, a.original_url, a.cluster_id,
      coalesce(s.name, o.name, '256 Newsroom') as publisher_name
    from articles a
    left join sources s on s.id = a.source_id
    left join organizations o on o.id = a.organization_id
    where a.id = $1 and a.hidden = false and a.status = 'published'
  `, [articleId]);
  const article = rows[0];
  if (!article) throw new Error('Published article not found.');
  const coverage = article.cluster_id ? (await pool.query(`
    select a.title, a.summary, coalesce(s.name, o.name, '256 Newsroom') as publisher_name
    from articles a
    left join sources s on s.id = a.source_id
    left join organizations o on o.id = a.organization_id
    where a.cluster_id = $1 and a.id <> $2 and a.hidden = false and a.status = 'published'
    order by a.published_at desc nulls last limit 8
  `, [article.cluster_id, article.id])).rows : [];
  return { article, coverage };
}

function evidenceText({ article, coverage }) {
  return [
    `Primary publisher: ${article.publisher_name}`,
    `Primary headline: ${article.title}`,
    `Primary source snippet: ${article.summary || '(none)'}`,
    `Original report URL: ${article.original_url}`,
    ...coverage.map((item, index) => `Additional coverage ${index + 1} — ${item.publisher_name}\nHeadline: ${item.title}\nSnippet: ${item.summary || '(none)'}`),
  ].join('\n\n').slice(0, 12000);
}

async function generateStorySummary(articleId) {
  const evidence = await evidenceForArticle(articleId);
  const source = evidenceText(evidence);
  const generated = await chatJson({ system: GENERATE_PROMPT, user: source, model: MODEL });
  if (generated.data.insufficient) return { articleId, status: 'insufficient', reason: generated.data.reason };
  const summary = String(generated.data.summary || '').trim();
  if (countWords(summary) < 60 || countWords(summary) > 150) return { articleId, status: 'rejected_length', words: countWords(summary) };

  const checked = await chatJson({
    system: VALIDATE_PROMPT,
    user: `${source}\n\nProposed digest:\n${summary}`,
    model: MODEL,
  });
  if (!checked.data.valid) {
    return { articleId, status: 'rejected_validation', unsupportedClaims: checked.data.unsupportedClaims || [], copiedPhrases: checked.data.copiedPhrases || [] };
  }

  await pool.query(`
    update articles set seo_summary = $2, summary_is_original = true,
      summary_generation_model = $3, summary_generated_at = now(), updated_at = now()
    where id = $1
  `, [articleId, summary, generated.model || MODEL]);
  return { articleId, status: 'ready', words: countWords(summary), summary };
}

async function generatePendingStorySummaries(limit = 3) {
  const { rows } = await pool.query(`
    select id from articles
    where hidden = false and status = 'published' and seo_summary is null
      and array_length(regexp_split_to_array(trim(coalesce(summary, '')), '\\s+'), 1) >= 12
    order by (image_url is not null) desc, published_at desc nulls last
    limit $1
  `, [limit]);
  const results = [];
  for (const row of rows) {
    try { results.push(await generateStorySummary(row.id)); }
    catch (err) { results.push({ articleId: row.id, status: 'error', error: err.message }); }
  }
  return { ranAt: new Date().toISOString(), results };
}

module.exports = { generateStorySummary, generatePendingStorySummaries };
