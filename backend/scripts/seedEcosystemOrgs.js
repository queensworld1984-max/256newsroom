const pool = require('../src/db');

// Domains verified live (HTTP 200) on 2026-07-21 before this seed ran.
const PLATFORMS = [
  { name: '256 AI', slug: '256-ai', websiteUrl: 'https://ai.256.co.ug' },
  { name: '256 Mall', slug: '256-mall', websiteUrl: 'https://256.ug' },
  { name: '256 Express', slug: '256-express', websiteUrl: 'https://express.256.co.ug' },
  { name: '256 Heart', slug: '256-heart', websiteUrl: 'https://256heart.com' },
  { name: '256 Corporate', slug: '256-corporate', websiteUrl: 'https://enterprise.256.co.ug' },
  { name: '256Shield', slug: '256shield', websiteUrl: 'https://shield.256.co.ug' },
  { name: '256LinkShield', slug: '256linkshield', websiteUrl: 'https://linkshield.256.co.ug' },
];

async function main() {
  const { rows: parentRows } = await pool.query(
    `insert into organizations (name, slug, org_type, website_url, is_official, active, verification_status, excluded_from_verification_queue)
     values ('256 Ecosystem', '256-ecosystem', 'ecosystem_parent', 'https://256.co.ug', true, true, 'approved', true)
     on conflict (slug) do update set is_official = true, active = true, verification_status = 'approved'
     returning id`,
  );
  const parentId = parentRows[0].id;
  console.log(`256 Ecosystem parent org id: ${parentId}`);

  for (const platform of PLATFORMS) {
    const { rows } = await pool.query(
      `insert into organizations
        (name, slug, org_type, website_url, parent_organization_id, is_official, active, verification_status, excluded_from_verification_queue)
       values ($1, $2, 'ecosystem_platform', $3, $4, true, true, 'approved', true)
       on conflict (slug) do update set
         website_url = excluded.website_url,
         parent_organization_id = excluded.parent_organization_id,
         is_official = true, active = true, verification_status = 'approved'
       returning id, name, slug`,
      [platform.name, platform.slug, platform.websiteUrl, parentId],
    );
    console.log(`  ${rows[0].name} (${rows[0].slug}) -> org id ${rows[0].id}`);

    // Default mode is 'draft' per spec — nothing auto-publishes until an
    // admin tests the platform's sources/rules and switches it on.
    await pool.query(
      `insert into automation_settings (organization_id, mode)
       values ($1, 'draft')
       on conflict (organization_id) do nothing`,
      [rows[0].id],
    );
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
