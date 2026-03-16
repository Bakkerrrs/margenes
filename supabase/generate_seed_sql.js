/**
 * Generates SQL INSERT files from the hardcoded data in panel_margenes.html.
 * Run the output SQL files in the Supabase SQL Editor.
 *
 * Usage: node supabase/generate_seed_sql.js
 *
 * Outputs:
 *   supabase/seed_actividades.sql
 *   supabase/seed_consultores.sql
 */

const fs = require('fs');
const path = require('path');

function extractRAW() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'panel_margenes.html'), 'utf-8');
  const match = html.match(/const RAW = ({.*?});/s);
  if (!match) throw new Error('Could not find RAW data in HTML');
  return JSON.parse(match[1]);
}

function esc(val) {
  if (val == null) return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

function main() {
  console.log('Extracting data from panel_margenes.html...');
  const RAW = extractRAW();

  // --- Actividades ---
  const batchSize = 500;
  let sqlA = '-- Seed data for actividades\n-- Generated from panel_margenes.html\n\n';

  for (let i = 0; i < RAW.a.length; i += batchSize) {
    const batch = RAW.a.slice(i, i + batchSize);
    sqlA += 'INSERT INTO actividades (month, customer, act_short, act_desc, tipo_at, bu, prod, cost, margin, billing, jefatura, dias_imputados, working_days, fy) VALUES\n';
    const rows = batch.map(a =>
      `(${esc(a[0])}, ${esc(a[1])}, ${esc(a[2])}, ${esc(a[3])}, ${esc(a[4])}, ${esc(a[5])}, ${a[6]}, ${a[7]}, ${a[8]}, ${a[9]}, ${esc(a[10])}, ${a[11]}, ${a[12]}, ${esc(a[13])})`
    );
    sqlA += rows.join(',\n') + ';\n\n';
  }

  const actFile = path.join(__dirname, 'seed_actividades.sql');
  fs.writeFileSync(actFile, sqlA);
  console.log(`Written ${RAW.a.length} actividades to ${actFile}`);

  // --- Consultores ---
  const consEntries = [];
  for (const [key, entries] of Object.entries(RAW.c)) {
    const [act_short, month] = key.split('|');
    for (const entry of entries) {
      consEntries.push({ act_short, month, profesional: entry[0], jefe_directo: entry[1] });
    }
  }

  let sqlC = '-- Seed data for consultores\n-- Generated from panel_margenes.html\n\n';

  for (let i = 0; i < consEntries.length; i += batchSize) {
    const batch = consEntries.slice(i, i + batchSize);
    sqlC += 'INSERT INTO consultores (act_short, month, profesional, jefe_directo) VALUES\n';
    const rows = batch.map(c =>
      `(${esc(c.act_short)}, ${esc(c.month)}, ${esc(c.profesional)}, ${esc(c.jefe_directo)})`
    );
    sqlC += rows.join(',\n') + ';\n\n';
  }

  const consFile = path.join(__dirname, 'seed_consultores.sql');
  fs.writeFileSync(consFile, sqlC);
  console.log(`Written ${consEntries.length} consultores to ${consFile}`);

  console.log('\nDone! Run these SQL files in the Supabase SQL Editor.');
}

main();
