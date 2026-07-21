const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.end();
  console.log('Migration complete');
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
