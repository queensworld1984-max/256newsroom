const pool = require('./db');
const { discoverSource } = require('./contentDiscovery');
const { runGenerationJob } = require('./ecosystemGenerate');

// Suggested weekly rotation from the spec — a soft default the generation
// prompt treats as a preference, never a factual override. Per-platform
// automation_settings.content_rotation, when set, takes priority.
const DEFAULT_ROTATION_BY_WEEKDAY = {
  mon: 'Product feature and user guide',
  tue: 'Safety and educational content',
  wed: 'Platform service and opportunity',
  thu: 'Business use case and platform guide',
  fri: 'Weekly update and feature explanation',
  sat: 'Community, discovery, or instructional content',
  sun: 'Community, discovery, or instructional content',
};

function weekdayKey(date, timezone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date).toLowerCase().slice(0, 3);
}

async function isGloballyPaused() {
  const { rows } = await pool.query("select value from system_settings where key = 'ecosystem_automation_paused'");
  return rows[0]?.value === true;
}

async function setGloballyPaused(paused, userId) {
  await pool.query(
    `insert into system_settings (key, value, updated_by_user_id, updated_at)
     values ('ecosystem_automation_paused', $1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_by_user_id = excluded.updated_by_user_id, updated_at = now()`,
    [JSON.stringify(Boolean(paused)), userId || null],
  );
}

async function countGeneratedToday(organizationId, timezone) {
  const { rows } = await pool.query(
    `select count(*)::int as count from articles
     where organization_id = $1 and origin = 'ecosystem_ai_generated'
       and status not in ('failed', 'rejected')
       and (generated_at at time zone $2)::date = (now() at time zone $2)::date`,
    [organizationId, timezone],
  );
  return rows[0].count;
}

async function minutesSinceLastGeneration(organizationId) {
  const { rows } = await pool.query(
    `select generated_at from articles where organization_id = $1 and origin = 'ecosystem_ai_generated' order by generated_at desc limit 1`,
    [organizationId],
  );
  if (!rows[0]?.generated_at) return Infinity;
  return (Date.now() - new Date(rows[0].generated_at).getTime()) / 60000;
}

// Runs one sweep across every eligible platform. Each platform gets at most
// one new article per sweep (never more than daily_max total for the day,
// and never below min_interval_minutes since its last one). If none of a
// platform's configured sources have new or changed content, or every
// attempt fails validation, that platform simply produces nothing this
// sweep — this is never treated as a failure requiring filler.
async function runEcosystemAutomationCycle() {
  if (await isGloballyPaused()) {
    return { ok: true, ranAt: new Date().toISOString(), skipped: 'globally_paused', results: [] };
  }

  // Explicit column list, not "o.id, s.*" — automation_settings has its own
  // "id" primary key, and a duplicate "id" column silently lets the second
  // one win when node-postgres builds the row object, which previously made
  // platform.id resolve to automation_settings.id instead of the org id.
  const { rows: platforms } = await pool.query(`
    select o.id, o.name, o.website_url,
      s.mode, s.daily_target, s.daily_max, s.publish_times, s.active_days,
      s.timezone, s.min_interval_minutes, s.content_rotation, s.eligible_content_types
    from organizations o
    join automation_settings s on s.organization_id = o.id
    where o.org_type = 'ecosystem_platform' and o.active = true
  `);

  const results = [];
  for (const platform of platforms) {
    if (!['automatic', 'draft'].includes(platform.mode)) {
      results.push({ organizationId: platform.id, name: platform.name, status: 'skipped_mode' });
      continue;
    }

    const now = new Date();
    const wd = weekdayKey(now, platform.timezone);
    if (!(platform.active_days || []).includes(wd)) {
      results.push({ organizationId: platform.id, name: platform.name, status: 'skipped_inactive_day' });
      continue;
    }

    const generatedToday = await countGeneratedToday(platform.id, platform.timezone);
    if (generatedToday >= platform.daily_max) {
      results.push({ organizationId: platform.id, name: platform.name, status: 'daily_max_reached', generatedToday });
      continue;
    }

    const sinceLast = await minutesSinceLastGeneration(platform.id);
    if (sinceLast < platform.min_interval_minutes) {
      results.push({ organizationId: platform.id, name: platform.name, status: 'min_interval_not_elapsed' });
      continue;
    }

    const { rows: sources } = await pool.query(
      `select ps.* from platform_sources ps
       where ps.organization_id = $1 and ps.active = true
       order by (
         select max(se.discovered_at) from source_evidence se
         where se.source_url = ps.url and se.organization_id = ps.organization_id
       ) asc nulls first
       limit 5`,
      [platform.id],
    );

    if (!sources.length) {
      results.push({ organizationId: platform.id, name: platform.name, status: 'no_sources_configured' });
      continue;
    }

    let generated = null;
    const attempts = [];
    for (const source of sources) {
      let discovery;
      try {
        discovery = await discoverSource(platform.id, source.url);
      } catch (err) {
        attempts.push({ sourceUrl: source.url, status: 'discover_failed', error: err.message });
        continue;
      }
      if (!discovery.isNewOrChanged) {
        attempts.push({ sourceUrl: source.url, status: 'unchanged' });
        continue;
      }

      const rotationHint = platform.content_rotation?.[wd] || DEFAULT_ROTATION_BY_WEEKDAY[wd];
      const jobResult = await runGenerationJob({
        organizationId: platform.id,
        sourceEvidenceId: discovery.evidence.id,
        triggeredBy: 'automation',
        rotationHint,
      });
      attempts.push({ sourceUrl: source.url, status: jobResult.job.status, jobId: jobResult.job.id });
      if (jobResult.article) {
        generated = jobResult;
        break;
      }
    }

    results.push({
      organizationId: platform.id,
      name: platform.name,
      status: generated ? 'generated' : 'no_eligible_content',
      articleId: generated?.article?.id || null,
      attempts,
    });
  }

  return { ok: true, ranAt: new Date().toISOString(), results };
}

module.exports = { runEcosystemAutomationCycle, isGloballyPaused, setGloballyPaused };
