/**
 * Seed script: extracts hardcoded data from panel_margenes.html
 * and uploads it to Supabase.
 *
 * Usage:
 *   node supabase/seed.js
 *
 * Requires: npm install @supabase/supabase-js
 * Set env vars SUPABASE_URL and SUPABASE_SERVICE_KEY before running.
 * Use the SERVICE ROLE key (not anon) for inserts.
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://byhfwubwzcyufkxhrgti.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: set SUPABASE_SERVICE_KEY env var (use service_role key, not anon)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Extract RAW JSON from the HTML file
function extractRAW() {
  const html = fs.readFileSync('panel_margenes.html', 'utf-8');
  const match = html.match(/const RAW = ({.*?});/s);
  if (!match) throw new Error('Could not find RAW data in HTML');
  return JSON.parse(match[1]);
}

// Insert rows in batches
async function batchInsert(table, rows, batchSize = 500) {
  console.log(`Inserting ${rows.length} rows into ${table}...`);
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`Error at batch ${i}-${i + batchSize}:`, error.message);
      throw error;
    }
    process.stdout.write(`  ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log(`  Done: ${rows.length} rows inserted into ${table}`);
}

async function main() {
  const RAW = extractRAW();

  // Transform actividades (RAW.a)
  // Fields: [0:month, 1:customer, 2:actShort, 3:actDesc, 4:tipoAT, 5:bu,
  //          6:prod, 7:cost, 8:margin, 9:billing, 10:jefatura,
  //          11:diasImputados, 12:workingDays, 13:fy]
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

  // Transform consultores (RAW.c)
  // Keys are "actShort|month", values are arrays of [profesional, jefeDirecto]
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

  await batchInsert('actividades', actividades);
  await batchInsert('consultores', consultores);

  console.log('\nSeed complete!');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
