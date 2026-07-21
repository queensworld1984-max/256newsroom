require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../src/db');
const { runGenerationJob } = require('../src/ecosystemGenerate');

async function main() {
  const { rows } = await pool.query(`
    select o.id, o.name, (
      select se.id from source_evidence se where se.organization_id=o.id
      order by length(se.raw_text_snapshot) desc, se.discovered_at desc limit 1
    ) evidence_id
    from organizations o
    where o.org_type='ecosystem_platform'
      and not exists(select 1 from articles a where a.organization_id=o.id and a.status='published')
    order by o.name
  `);
  const results = [];
  for (const platform of rows) {
    if (!platform.evidence_id) {
      results.push({ name: platform.name, status: 'no_evidence' });
      continue;
    }
    const result = await runGenerationJob({
      organizationId: platform.id,
      sourceEvidenceId: platform.evidence_id,
      triggeredBy: 'authorized-immediate-publish',
    });
    results.push({ name: platform.name, job: result.job.status, articleId: result.article?.id || null, error: result.job.error || null });
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode=1; }).finally(() => pool.end());

