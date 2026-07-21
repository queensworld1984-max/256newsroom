const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const MIGRATIONS_DIR = path.join(__dirname, '../sql/migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function recordBaseline() {
  const { rows } = await pool.query('select 1 from schema_migrations limit 1');
  if (rows.length > 0) return;

  const { rows: existing } = await pool.query("select to_regclass('public.sources') as reg");
  if (existing[0].reg) {
    await pool.query(
      "insert into schema_migrations (version) values ('0000_baseline_schema') on conflict do nothing",
    );
    console.log('Baseline detected (existing sources table) — recorded 0000_baseline_schema without re-running schema.sql');
    return;
  }

  const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(
    "insert into schema_migrations (version) values ('0000_baseline_schema') on conflict do nothing",
  );
  console.log('Fresh database — ran schema.sql and recorded 0000_baseline_schema');
}

async function runPendingMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const { rows: applied } = await pool.query('select version from schema_migrations');
  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (appliedVersions.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [version]);
      await client.query('commit');
      console.log(`Applied migration: ${version}`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`Migration ${version} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

async function main() {
  await ensureMigrationsTable();
  await recordBaseline();
  await runPendingMigrations();
  await pool.end();
  console.log('Migration complete');
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
