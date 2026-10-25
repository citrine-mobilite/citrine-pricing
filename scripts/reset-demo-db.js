const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Citrine2026%21@db.npwauvoacscumdzpbjoc.supabase.co:5432/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const tables = ['shortages', 'trips', 'campaign_results', 'campaigns', 'neighborhoods', 'cities'];

  for (const table of tables) {
    try {
      await client.query('DELETE FROM ' + table);
      console.log('cleaned ' + table);
    } catch (err) {
      console.warn('skip ' + table + ': ' + (err && err.message ? err.message : String(err)));
    }
  }

  await client.end();
  console.log('remote reset complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
