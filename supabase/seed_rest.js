/**
 * Seed script using Supabase REST API (no service_role key needed).
 *
 * Prerequisites:
 *   1. Run in SQL Editor:
 *      CREATE POLICY "Allow temp insert actividades" ON actividades FOR INSERT WITH CHECK (true);
 *      CREATE POLICY "Allow temp insert consultores" ON consultores FOR INSERT WITH CHECK (true);
 *
 *   2. Run: node supabase/seed_rest.js
 *
 *   3. After seeding, run in SQL Editor:
 *      DROP POLICY "Allow temp insert actividades" ON actividades;
 *      DROP POLICY "Allow temp insert consultores" ON consultores;
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://byhfwubwzcyufkxhrgti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aGZ3dWJ3emN5dWZreGhyZ3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDA2NjgsImV4cCI6MjA4OTE3NjY2OH0.AK4jZufmMajZcHblLrM_8lZmob7bxy0L7PwwmihHcic';

function extractRAW() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'panel_margenes.html'), 'utf-8');
  const match = html.match(/const RAW = ({.*?});/s);
  if (!match) throw new Error('Could not find RAW data in HTML');
  return JSON.parse(match[1]);
}

async function insertBatch(table, rows) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Insert error ${resp.status}: ${text}`);
  }
}

async function seedTable(table, allRows, batchSize = 200) {
  console.log(`\nSeeding ${table}: ${allRows.length} rows...`);
  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = allRows.slice(i, i + batchSize);
    await insertBatch(table, batch);
    const done = Math.min(i + batchSize, allRows.length);
    process.stdout.write(`  ${done}/${allRows.length} (${Math.round(done / allRows.length * 100)}%)\r`);
  }
  console.log(`  ${allRows.length}/${allRows.length} (100%) - Done!`);
}

async function main() {
  console.log('Extracting data from panel_margenes.html...');
  const RAW = extractRAW();

  // Transform actividades
  const actividades = RAW.a.map(a => ({
    month: a[0],
    customer: a[1],
    act_short: a[2],
    act_desc: a[3],
    tipo_at: a[4],
    bu: a[5],
    prod: a[6],
    cost: a[7],
    margin: a[8],
    billing: a[9],
    jefatura: a[10],
    dias_imputados: a[11],
    working_days: a[12],
    fy: a[13]
  }));

  // Transform consultores
  const consultores = [];
  for (const [key, entries] of Object.entries(RAW.c)) {
    const [act_short, month] = key.split('|');
    for (const entry of entries) {
      consultores.push({
        act_short,
        month,
        profesional: entry[0],
        jefe_directo: entry[1]
      });
    }
  }

  await seedTable('actividades', actividades);
  await seedTable('consultores', consultores);

  console.log('\nSeed complete! Now remove the temp INSERT policies in SQL Editor:');
  console.log('  DROP POLICY "Allow temp insert actividades" ON actividades;');
  console.log('  DROP POLICY "Allow temp insert consultores" ON consultores;');
}

main().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
