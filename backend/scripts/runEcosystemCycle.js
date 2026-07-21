require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../src/db');
const { runEcosystemAutomationCycle } = require('../src/ecosystemScheduler');

async function main() {
  const result = await runEcosystemAutomationCycle();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

