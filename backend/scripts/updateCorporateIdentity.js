/**
 * Align 256 Corporate org record with operator identity:
 * main company / corporate arm of 256 AI Systems; website https://256.co.ug
 */
const pool = require('../src/db');

const DESCRIPTION = [
  '256 Corporate is the main company and corporate arm of 256 AI Systems.',
  'It built and operates the broader 256 ecosystem of platforms.',
  'The corporate arm offers enterprise services: custom software, websites and digital products,',
  'cybersecurity and digital protection, cloud infrastructure, AI/intelligence tools, and related institutional systems.',
  'Public brand on the website is often “256 AI Systems” / legal name “256 Artificial Intelligence Technologies Co. Ltd”;',
  'in 256 Newsroom the platform publisher is named “256 Corporate”.',
  'Main official website: https://256.co.ug (enterprise.256.co.ug is an alias for the same corporate arm).',
].join(' ');

async function main() {
  const { rows } = await pool.query(
    `update organizations
     set website_url = $1,
         description = $2,
         updated_at = now()
     where slug = '256-corporate' or lower(name) = '256 corporate'
     returning id, name, slug, website_url, left(description, 160) as description_preview`,
    ['https://256.co.ug', DESCRIPTION],
  );
  if (!rows.length) {
    console.error('256 Corporate organization not found');
    process.exit(1);
  }
  console.log('Updated org:', rows[0]);
  const orgId = rows[0].id;

  // Point platform sources at the main corporate website.
  const { rows: sources } = await pool.query(
    `select id, url, label from platform_sources where organization_id = $1`,
    [orgId],
  );
  console.log('Existing platform_sources:', sources);

  if (!sources.length) {
    await pool.query(
      `insert into platform_sources (organization_id, url, label, content_type_hint)
       values ($1, 'https://256.co.ug/', 'Official 256 Corporate / 256 AI Systems website', 'Platform Overview')
       on conflict (organization_id, url) do update
         set label = excluded.label, active = true`,
      [orgId],
    );
    console.log('Inserted homepage platform_source for 256.co.ug');
  } else {
    for (const s of sources) {
      if (/enterprise\.256\.co\.ug|256\.co\.ug/i.test(s.url || '')) {
        // Avoid unique (organization_id, url) collisions when multiple aliases exist.
        if (String(s.url).replace(/\/$/, '') === 'https://256.co.ug') {
          await pool.query(
            `update platform_sources
             set label = 'Official 256 Corporate / 256 AI Systems website', active = true
             where id = $1`,
            [s.id],
          );
          console.log(`Kept source ${s.id} on 256.co.ug`);
        } else {
          await pool.query(`delete from platform_sources where id = $1`, [s.id]);
          console.log(`Removed alias source ${s.id}: ${s.url}`);
        }
      }
    }
    await pool.query(
      `insert into platform_sources (organization_id, url, label, content_type_hint)
       values ($1, 'https://256.co.ug/', 'Official 256 Corporate / 256 AI Systems website', 'Platform Overview')
       on conflict (organization_id, url) do update
         set label = excluded.label, active = true`,
      [orgId],
    );
    console.log('Ensured homepage platform_source for 256.co.ug');
  }

  // Approved domain should include 256.co.ug
  await pool.query(
    `insert into approved_domains (organization_id, domain, active)
     values ($1, '256.co.ug', true)
     on conflict (organization_id, domain) do update set active = true`,
    [orgId],
  );
  console.log('Ensured approved domain 256.co.ug');

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
