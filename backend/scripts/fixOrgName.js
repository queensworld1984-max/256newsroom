const pool = require('../src/db');

async function main() {
  const { rows } = await pool.query(
    `select id, name, slug, name_changed_at from organizations
     where name ilike '%syatem%' or slug ilike '%syatem%'
     order by id`,
  );
  console.log('before', rows);
  for (const org of rows) {
    const fixed = String(org.name).replace(/Syatems/gi, 'Systems').replace(/syatems/gi, 'Systems');
    if (fixed === org.name) continue;
    const { rows: updated } = await pool.query(
      `update organizations set name = $2, updated_at = now()
       where id = $1 returning id, name, slug`,
      [org.id, fixed],
    );
    console.log('fixed', updated[0]);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
