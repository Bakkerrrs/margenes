// Panel de Márgenes SIICL — Supabase Integration
// Fetches data from Supabase instead of hardcoded RAW

const SUPABASE_URL = 'https://byhfwubwzcyufkxhrgti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aGZ3dWJ3emN5dWZreGhyZ3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDA2NjgsImV4cCI6MjA4OTE3NjY2OH0.AK4jZufmMajZcHblLrM_8lZmob7bxy0L7PwwmihHcic';

const RANGES = [
  { label: '1. < 25%', lo: -Infinity, hi: 0.25, color: '#1a1a1a', cls: 'mb1' },
  { label: '2. 25% - 28%', lo: 0.25, hi: 0.28, color: '#D64550', cls: 'mb2' },
  { label: '3. 28% - 30%', lo: 0.28, hi: 0.30, color: '#E66C37', cls: 'mb3' },
  { label: '4. 30% - 34%', lo: 0.30, hi: 0.34, color: '#B5C334', cls: 'mb4' },
  { label: '5. 34% - 36%', lo: 0.34, hi: 0.36, color: '#02931C', cls: 'mb5' },
  { label: '6. 36% - 40%', lo: 0.36, hi: 0.40, color: '#02931C', cls: 'mb6' },
  { label: '7. 40% - 50%', lo: 0.40, hi: 0.50, color: '#02931C', cls: 'mb7' },
  { label: '8. 50% and +', lo: 0.50, hi: Infinity, color: '#02931C', cls: 'mb8' },
];

const MNAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function mlabel(m) { const [y, mm] = m.split('-'); return MNAMES[parseInt(mm) - 1] + ' ' + y; }

// Data arrays (populated from Supabase)
let ALL = [];   // actividades as arrays matching original format
let CONS = {};   // consultores keyed by "actShort|month"
let F = { fy: [], bu: [], ta: [], cu: [], je: [] };  // filter options

let sChart, hChart;
let sortCol = 8, sortDir = 'asc';
let detSortCol = 'ad', detSortDir = 'asc';
let activeTab = 'resumen';

// ─── Supabase helpers ───

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseFetch(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const resp = await fetch(url, { headers: supabaseHeaders() });
  if (!resp.ok) throw new Error(`Supabase error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Fetch all rows using pagination (Supabase default limit is 1000)
async function fetchAllRows(table) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const batch = await supabaseFetch(table, `order=id&limit=${pageSize}&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

// ─── Data loading ───

function showLoading(show, message) {
  const overlay = document.getElementById('loadingOverlay');
  const text = document.getElementById('loadingText');
  if (show) {
    text.textContent = message || 'Cargando datos...';
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  banner.textContent = msg;
  banner.style.display = 'block';
}

async function loadData() {
  showLoading(true, 'Conectando con Supabase...');

  try {
    showLoading(true, 'Cargando actividades...');
    const actRows = await fetchAllRows('actividades');

    showLoading(true, 'Cargando consultores...');
    const consRows = await fetchAllRows('consultores');

    // Transform actividades to array format matching original RAW.a
    // [0:month, 1:customer, 2:actShort, 3:actDesc, 4:tipoAT, 5:bu,
    //  6:prod, 7:cost, 8:margin, 9:billing, 10:jefatura,
    //  11:diasImputados, 12:workingDays, 13:fy]
    ALL = actRows.map(r => [
      r.month, r.customer, r.act_short, r.act_desc,
      r.tipo_at, r.bu,
      Number(r.prod), Number(r.cost), Number(r.margin), Number(r.billing),
      r.jefatura, Number(r.dias_imputados), Number(r.working_days), r.fy
    ]);

    // Transform consultores to dict keyed by "actShort|month"
    CONS = {};
    consRows.forEach(r => {
      const key = `${r.act_short}|${r.month}`;
      if (!CONS[key]) CONS[key] = [];
      CONS[key].push([r.profesional, r.jefe_directo]);
    });

    // Build filter options from data
    F.fy = [...new Set(ALL.map(a => a[13]))].sort();
    F.bu = [...new Set(ALL.map(a => a[5]))].sort();
    F.ta = [...new Set(ALL.map(a => a[4]))].sort();
    F.cu = [...new Set(ALL.map(a => a[1]))].sort();
    F.je = [...new Set(ALL.map(a => a[10]))].sort();

    showLoading(false);
    initUI();
  } catch (err) {
    showLoading(false);
    showError('Error al cargar datos: ' + err.message);
    console.error('Load error:', err);
  }
}

// ─── UI initialization (runs after data is loaded) ───

function initUI() {
  const fySel = document.getElementById('filterFY');
  F.fy.forEach(fy => { fySel.innerHTML += `<option value="${fy}">${fy}</option>`; });
  fySel.value = F.fy[F.fy.length - 1];

  F.bu.forEach(v => { if (v && v !== '0') document.getElementById('filterBU').innerHTML += `<option value="${v}">${v}</option>`; });
  F.ta.forEach(v => { document.getElementById('filterTipoAT').innerHTML += `<option value="${v}">${v}</option>`; });
  F.cu.forEach(v => { document.getElementById('filterCustomer').innerHTML += `<option value="${v}">${v}</option>`; });
  F.je.forEach(v => { document.getElementById('filterJefatura').innerHTML += `<option value="${v}">${v}</option>`; });

  document.getElementById('legend').innerHTML = RANGES.map(r =>
    `<div class="legend-item"><div class="legend-dot" style="background:${r.color}"></div>${r.label}</div>`
  ).join('') +
    '<div class="legend-item" style="margin-left:12px"><div style="width:16px;height:16px;border-radius:4px;background:rgba(2,147,28,0.12);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#02931C;font-family:JetBrains Mono">%</div><span style="font-weight:600;color:var(--text2)">Margen Ponderado</span></div>';

  ['filterFY', 'filterBU', 'filterTipoAT', 'filterCustomer', 'filterJefatura', 'filterMonth'].forEach(id =>
    document.getElementById(id).addEventListener('change', id === 'filterFY' ? onFYChange : refresh)
  );
  document.getElementById('filterProdPos').addEventListener('change', refresh);
  document.getElementById('filterProd1M').addEventListener('change', refresh);
  let searchTimer;
  document.getElementById('filterSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 200);
  });

  onFYChange();
}

// ─── Filters & helpers ───

function onFYChange() {
  const fy = document.getElementById('filterFY').value;
  document.getElementById('fyBadge').textContent = 'FY ' + fy;
  const fyMonths = [...new Set(ALL.filter(a => a[13] === fy).map(a => a[0]))].sort();
  const ms = document.getElementById('filterMonth');
  ms.innerHTML = '';
  fyMonths.forEach(m => { ms.innerHTML += `<option value="${m}">${mlabel(m)}</option>`; });
  ms.value = fyMonths[fyMonths.length - 1] || '';
  refresh();
}

function gf() {
  return {
    fy: document.getElementById('filterFY').value,
    bu: document.getElementById('filterBU').value,
    ta: document.getElementById('filterTipoAT').value,
    cu: document.getElementById('filterCustomer').value,
    je: document.getElementById('filterJefatura').value,
    month: document.getElementById('filterMonth').value,
    prodPos: document.getElementById('filterProdPos').checked,
    prod1M: document.getElementById('filterProd1M').checked,
    q: document.getElementById('filterSearch').value.trim().toLowerCase()
  };
}

function flt(data) {
  const f = gf();
  return data.filter(a => {
    if (a[13] !== f.fy) return false;
    if (f.bu && a[5] !== f.bu) return false;
    if (f.ta && a[4] !== f.ta) return false;
    if (f.cu && a[1] !== f.cu) return false;
    if (f.je && a[10] !== f.je) return false;
    if (f.prodPos && a[6] <= 0) return false;
    if (f.prod1M && a[6] < 1000000) return false;
    if (f.q && !(a[2].toLowerCase().includes(f.q) || a[3].toLowerCase().includes(f.q))) return false;
    return true;
  });
}

function gri(mg) { for (let i = RANGES.length - 1; i >= 0; i--) { if (mg >= RANGES[i].lo) return i; } return 0; }
function fmt(n) { if (n == null || isNaN(n)) return '-'; const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'K'; return s + '$' + Math.round(a); }

// ─── Main refresh ───

function refresh() {
  const fd = flt(ALL), f = gf();
  const months = [...new Set(fd.map(a => a[0]))].sort();

  const md = fd.filter(a => a[0] === f.month);
  const tA = md.length, tP = md.reduce((s, a) => s + a[6], 0), tC = md.reduce((s, a) => s + a[7], 0);
  const wM = tP !== 0 ? ((tP + tC) / tP * 100) : 0;
  const tB = md.reduce((s, a) => s + a[9], 0);
  const tDias = md.reduce((s, a) => s + a[11], 0);
  const adr = tDias > 0 ? (tP / tDias) : 0, adc = tDias > 0 ? (tC / tDias) : 0;

  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi"><div class="kpi-label">Actividades</div><div class="kpi-value">${tA}</div></div>
    <div class="kpi"><div class="kpi-label">Producci\u00f3n Total</div><div class="kpi-value">${fmt(tP)}</div></div>
    <div class="kpi"><div class="kpi-label">Margen Ponderado</div><div class="kpi-value" style="color:${wM >= 30 ? '#02931C' : wM >= 25 ? '#E66C37' : '#D64550'}">${wM.toFixed(1)}%</div></div>
    <div class="kpi"><div class="kpi-label">Facturaci\u00f3n Total</div><div class="kpi-value">${fmt(tB)}</div></div>
    <div class="kpi"><div class="kpi-label">ADR <span style="font-weight:400;font-size:9px;color:var(--text3)">(Prod/D\u00eda)</span></div><div class="kpi-value" style="color:var(--accent)">${fmt(adr)}</div></div>
    <div class="kpi"><div class="kpi-label">ADC <span style="font-weight:400;font-size:9px;color:var(--text3)">(Costo/D\u00eda)</span></div><div class="kpi-value" style="color:#c0392b">${fmt(adc)}</div></div>`;

  const sd = {}; months.forEach(m => { sd[m] = new Array(RANGES.length).fill(0); });
  fd.forEach(a => { const ri = gri(a[8]); if (sd[a[0]]) sd[a[0]][ri]++; });
  const dl = {}; months.forEach((m, mi) => { dl[m] = sd[m].map((v, ri) => mi === 0 ? v : v - sd[months[mi - 1]][ri]); });
  const mMg = {}; months.forEach(m => {
    const ma = fd.filter(a => a[0] === m); const p = ma.reduce((s, a) => s + a[6], 0), c = ma.reduce((s, a) => s + a[7], 0);
    mMg[m] = p !== 0 ? ((p + c) / p * 100) : 0;
  });

  const ds = RANGES.map((r, ri) => ({ label: r.label, data: months.map(m => sd[m][ri]), backgroundColor: r.color, borderColor: '#ffffff', borderWidth: 1, borderRadius: 2 }));

  if (sChart) sChart.destroy();
  sChart = new Chart(document.getElementById('stackedChart').getContext('2d'), {
    type: 'bar', data: { labels: months.map(m => mlabel(m)), datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 28 } },
      plugins: {
        legend: { display: false }, tooltip: {
          backgroundColor: '#fff', titleColor: '#1a2b3c', bodyColor: '#5a6a7e', borderColor: '#dfe3e8', borderWidth: 1, cornerRadius: 6, padding: 10,
          callbacks: { label: ctx => { const m = months[ctx.dataIndex], ri = ctx.datasetIndex, v = ctx.raw, d = dl[m][ri]; return `${RANGES[ri].label}: ${v} (${d >= 0 ? '+' : ''}${d})`; } }
        }
      },
      scales: {
        x: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#5a6a7e', font: { family: 'Source Sans 3', size: 12 } }, border: { color: '#dfe3e8' } },
        y: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#5a6a7e', font: { family: 'JetBrains Mono', size: 11 } }, title: { display: true, text: '# Actividades', color: '#5a6a7e', font: { family: 'Source Sans 3', size: 12 } }, border: { color: '#dfe3e8' } }
      }, animation: { duration: 500 }
    },
    plugins: [{
      id: 'bl', afterDatasetsDraw(chart) {
        const c = chart.ctx;
        c.font = '600 9.5px JetBrains Mono'; c.textAlign = 'center';
        chart.data.datasets.forEach((ds, di) => {
          chart.getDatasetMeta(di).data.forEach((bar, i) => {
            const v = ds.data[i]; if (!v) return; const bH = bar.height || 0; if (bH < 16) return;
            const m = months[i], d = dl[m][di], arr = d > 0 ? '\u25B2' : d < 0 ? '\u25BC' : '\u00B7';
            c.fillStyle = di === 3 ? '#1a1a1a' : '#ffffff'; c.globalAlpha = 0.92;
            c.fillText(`${v} (${d >= 0 ? '+' : ''}${d}${arr})`, bar.x, bar.y + bH / 2 + 3.5); c.globalAlpha = 1;
          });
        });
        const topMeta = chart.getDatasetMeta(RANGES.length - 1);
        if (topMeta && topMeta.data) {
          topMeta.data.forEach((bar, i) => {
            const m = months[i], mg = mMg[m]; const txt = mg.toFixed(1) + '%';
            c.font = '700 12px JetBrains Mono';
            const tw = c.measureText(txt).width;
            const px = 5, py = 3, bw = tw + px * 2, bh = 16 + py * 2, rx = bar.x - bw / 2, ry = bar.y - bh - 6;
            c.fillStyle = mg >= 30 ? '#02931C' : mg >= 25 ? '#E66C37' : '#D64550';
            c.globalAlpha = 0.12; c.beginPath(); c.roundRect(rx, ry, bw, bh, 4); c.fill();
            c.globalAlpha = 1; c.fillStyle = mg >= 30 ? '#027015' : mg >= 25 ? '#b45309' : '#D64550';
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, bar.x, ry + bh / 2); c.textBaseline = 'alphabetic';
          });
        }
      }
    }]
  });

  const hd = sd[f.month] || new Array(RANGES.length).fill(0);
  if (hChart) hChart.destroy();
  hChart = new Chart(document.getElementById('horizChart').getContext('2d'), {
    type: 'bar', data: { labels: RANGES.map(r => r.label), datasets: [{ data: hd, backgroundColor: RANGES.map(r => r.color), borderRadius: 4, barThickness: 26 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#1a2b3c', bodyColor: '#5a6a7e', borderColor: '#dfe3e8', borderWidth: 1, cornerRadius: 6 } },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#5a6a7e', font: { family: 'JetBrains Mono', size: 10 } }, title: { display: true, text: '# Actividades', color: '#5a6a7e', font: { family: 'Source Sans 3', size: 11 } }, border: { color: '#dfe3e8' } },
        y: { grid: { display: false }, ticks: { color: '#5a6a7e', font: { family: 'Source Sans 3', size: 11 } }, border: { color: '#dfe3e8' } }
      }, animation: { duration: 400 }
    },
    plugins: [{
      id: 'hl', afterDatasetsDraw(chart) {
        const c = chart.ctx; c.font = '600 12px JetBrains Mono'; c.textAlign = 'left'; c.fillStyle = '#1a2b3c';
        chart.getDatasetMeta(0).data.forEach((bar, i) => { if (hd[i] > 0) c.fillText(hd[i], bar.x + 6, bar.y + 4); });
      }
    }]
  });

  document.getElementById('detailMonthLabel').textContent = mlabel(f.month);
  renderTable(md, f.month);
  if (activeTab === 'detalle') refreshDetalle();
}

// ─── Resumen Table ───

const SORT_COLS = [null, { k: 2, t: 's' }, { k: 3, t: 's' }, { k: 1, t: 's' }, { k: 5, t: 's' }, { k: 10, t: 's' }, { k: 6, t: 'n' }, { k: 7, t: 'n' }, { k: 8, t: 'n' }, { k: 9, t: 'n' }];

function doSort(ci) {
  if (sortCol === ci) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; } else { sortCol = ci; sortDir = 'asc'; }
  const f = gf(), fd = flt(ALL), md = fd.filter(a => a[0] === f.month);
  renderTable(md, f.month);
}

function renderTable(md, month) {
  const sc = SORT_COLS[sortCol];
  const sorted = [...md].sort((a, b) => { let va = a[sc.k], vb = b[sc.k]; if (sc.t === 's') { va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase(); return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); } return sortDir === 'asc' ? (va - vb) : (vb - va); });
  const headers = ['', 'Actividad', 'Descripci\u00f3n', 'Cliente', 'BU', 'Jefatura', 'Producci\u00f3n', 'Costo', 'Margen%', 'Facturaci\u00f3n'];
  const aligns = [null, null, null, null, null, null, 'right', 'right', 'right', 'right'];
  let h = '<table><thead><tr>';
  headers.forEach((hdr, i) => {
    const s = i > 0; const cls = s ? ` class="sortable${sortCol === i ? (' ' + sortDir) : ''}"` : ' style="width:24px"'; const al = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''; const oc = s ? ` onclick="doSort(${i})"` : '';
    h += `<th${cls}${al}${oc}>${hdr}</th>`;
  });
  h += '</tr></thead><tbody>';
  sorted.forEach((a, idx) => {
    const hasProd = a[6] !== 0, mgPct = hasProd ? (a[8] * 100).toFixed(1) : 'N/A';
    const ri = gri(a[8]), cls = RANGES[ri].cls;
    const key = `${a[2]}|${month}`, hasC = CONS[key] && CONS[key].length > 0;
    h += `<tr class="${hasC ? 'expand-row' : ''}" onclick="${hasC ? `toggleRow('cr${idx}')` : ''}">`
      + `<td style="text-align:center;color:var(--accent);font-size:10px">${hasC ? '\u25B6' : ''}</td>`
      + `<td class="td-mono">${a[2]}</td><td class="td-name">${a[3]}</td><td class="td-name">${a[1]}</td>`
      + `<td>${a[5]}</td><td class="td-name">${a[10]}</td>`
      + `<td class="td-mono" style="text-align:right">${fmt(a[6])}</td>`
      + `<td class="td-mono" style="text-align:right;color:${a[7] < 0 ? '#c0392b' : '#229954'}">${fmt(a[7])}</td>`
      + `<td style="text-align:right"><span class="margin-badge ${cls}">${mgPct}${hasProd ? '%' : ''}</span></td>`
      + `<td class="td-mono" style="text-align:right">${fmt(a[9])}</td></tr>`;
    if (hasC) {
      h += `<tr id="cr${idx}" class="consultant-row" style="display:none"><td></td><td colspan="9"><div style="padding:6px 0">`
        + `<table style="width:100%;font-size:12px"><tr><th style="padding:5px 10px;text-align:left">Profesional</th><th style="padding:5px 10px;text-align:left">Jefe Directo</th></tr>`;
      CONS[key].forEach(c => { h += `<tr><td style="padding:5px 10px;border-bottom:1px solid var(--border2)">${c[0]}</td><td style="padding:5px 10px;border-bottom:1px solid var(--border2)">${c[1]}</td></tr>`; });
      h += '</table></div></td></tr>';
    }
  });
  h += '</tbody></table>'; document.getElementById('tableWrap').innerHTML = h;
}

function toggleRow(id) {
  const r = document.getElementById(id); if (!r) return;
  const show = r.style.display === 'none';
  r.style.display = show ? 'table-row' : 'none';
  const p = r.previousElementSibling;
  if (p) p.querySelector('td').textContent = show ? '\u25BC' : '\u25B6';
}

// ─── Tabs ───

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById('tabResumen').style.display = tab === 'resumen' ? '' : 'none';
  document.getElementById('tabDetalle').style.display = tab === 'detalle' ? '' : 'none';
  if (tab === 'detalle') refreshDetalle();
}

// ─── Detalle Tab ───

function refreshDetalle() {
  const fd = flt(ALL);
  const months = [...new Set(fd.map(a => a[0]))].sort();

  const acts = {};
  fd.forEach(a => {
    const key = a[2];
    if (!acts[key]) { acts[key] = { as: a[2], ad: a[3], cu: a[1], bu: a[5], je: a[10], months: {} }; }
    acts[key].months[a[0]] = { mg: a[8], pr: a[6], co: a[7], di: a[11], wd: a[12] };
  });

  let rows = Object.values(acts);
  rows.forEach(row => {
    let tP = 0, tC = 0; Object.values(row.months).forEach(d => { tP += d.pr; tC += d.co; });
    row.ytdProd = tP; row.ytdCost = tC; row.ytdMg = tP !== 0 ? (tP + tC) / tP : -999;
  });

  rows.sort((a, b) => {
    let va, vb;
    if (detSortCol === 'as') { va = a.as; vb = b.as; }
    else if (detSortCol === 'ad') { va = a.ad; vb = b.ad; }
    else if (detSortCol === 'cu') { va = a.cu; vb = b.cu; }
    else if (detSortCol === 'bu') { va = a.bu; vb = b.bu; }
    else if (detSortCol === 'ytd') { va = a.ytdMg; vb = b.ytdMg; return detSortDir === 'asc' ? (va - vb) : (vb - va); }
    else { const am = a.months[detSortCol], bm = b.months[detSortCol]; va = am ? am.mg : -9999; vb = bm ? bm.mg : -9999; return detSortDir === 'asc' ? (va - vb) : (vb - va); }
    va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase();
    return detSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  function mgBg(mg) {
    if (mg >= 0.34) return 'background:#e2f5e5;color:#02931C';
    if (mg >= 0.30) return 'background:#f3f7de;color:#5a6600';
    if (mg >= 0.28) return 'background:#fdf0e6;color:#b45309';
    if (mg >= 0.25) return 'background:#fce8ea;color:#D64550';
    return 'background:#e8e8e8;color:#1a1a1a';
  }
  function shCls(col) { const active = detSortCol === col; return `class="sortable${active ? (' ' + detSortDir) : ''}" onclick="detSort('${col}')" style="cursor:pointer"`; }

  let h = '<table class="pivot-table"><thead><tr>';
  h += `<th class="fixed-col col0" ${shCls('as')}>C\u00f3digo</th>`;
  h += `<th class="fixed-col col1" ${shCls('ad')}>Descripci\u00f3n</th>`;
  h += `<th class="fixed-col col2" ${shCls('cu')}>Cliente</th>`;
  h += `<th class="fixed-col col3" ${shCls('bu')}>BU</th>`;
  months.forEach(m => { h += `<th ${shCls(m)} style="text-align:center;min-width:72px">${mlabel(m)}</th>`; });
  h += `<th ${shCls('ytd')} style="text-align:center;min-width:72px;background:#e8f0fb;color:var(--accent);border-left:2px solid var(--accent)">YTD</th>`;
  h += '</tr></thead><tbody>';

  rows.forEach(row => {
    h += '<tr>';
    h += `<td class="fixed-col col0 td-mono" style="font-size:10px">${row.as}</td>`;
    h += `<td class="fixed-col col1">${row.ad}</td>`;
    h += `<td class="fixed-col col2">${row.cu}</td>`;
    h += `<td class="fixed-col col3">${row.bu}</td>`;
    months.forEach(m => {
      const d = row.months[m];
      if (d && d.pr !== 0) {
        const pct = (d.mg * 100).toFixed(1); const adrV = d.di > 0 ? (d.pr / d.di) : 0; const adcV = d.di > 0 ? (d.co / d.di) : 0;
        h += `<td style="text-align:center"><span class="mg-cell" style="${mgBg(d.mg)}" data-as="${row.as}" data-mo="${m}" data-pr="${d.pr}" data-co="${d.co}" data-mg="${pct}" data-di="${d.di}" data-wd="${d.wd}" data-adr="${Math.round(adrV)}" data-adc="${Math.round(adcV)}" onmouseenter="showTip(event,this)" onmouseleave="hideTip()">${pct}%</span></td>`;
      } else if (d && d.pr === 0) {
        h += `<td style="text-align:center"><span class="mg-cell" style="background:#f0f0f0;color:#999" data-as="${row.as}" data-mo="${m}" data-pr="0" data-co="${d.co}" data-mg="N/A" data-di="${d.di}" data-wd="${d.wd}" data-adr="0" data-adc="0" onmouseenter="showTip(event,this)" onmouseleave="hideTip()">N/A</span></td>`;
      } else { h += `<td style="text-align:center;color:#ccc">\u2014</td>`; }
    });
    if (row.ytdProd !== 0) {
      const ytdPct = (row.ytdMg * 100).toFixed(1);
      h += `<td style="text-align:center;border-left:2px solid var(--accent);background:#f8fafd"><span class="mg-cell" style="${mgBg(row.ytdMg)};font-weight:800">${ytdPct}%</span></td>`;
    } else { h += `<td style="text-align:center;border-left:2px solid var(--accent);background:#f8fafd"><span class="mg-cell" style="background:#f0f0f0;color:#999">N/A</span></td>`; }
    h += '</tr>';
  });
  h += '</tbody></table>'; document.getElementById('detalleTableWrap').innerHTML = h;
}

function detSort(col) {
  if (detSortCol === col) { detSortDir = detSortDir === 'asc' ? 'desc' : 'asc'; } else { detSortCol = col; detSortDir = 'asc'; }
  refreshDetalle();
}

// ─── Hover Tooltip ───

const tip = document.getElementById('hoverTip');

function showTip(ev, el) {
  const ds = el.dataset; const as = ds.as, mo = ds.mo, pr = parseFloat(ds.pr), co = parseFloat(ds.co), mg = ds.mg;
  const di = parseFloat(ds.di), wd = parseFloat(ds.wd), adrV = parseFloat(ds.adr), adcV = parseFloat(ds.adc);
  const key = `${as}|${mo}`; const cons = CONS[key] || [];
  let html = `<div style="margin-bottom:8px;font-weight:700;color:var(--accent);font-size:13px">${mlabel(mo)}</div>`;
  html += `<div class="tip-grid"><div class="tip-kpi"><div class="lbl">Producci\u00f3n</div><div class="val">${fmt(pr)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Costo</div><div class="val" style="color:${co < 0 ? '#c0392b' : '#229954'}">${fmt(co)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Margen</div><div class="val">${mg}${mg !== 'N/A' ? '%' : ''}</div></div></div>`;
  html += `<div class="tip-grid g4">`
    + `<div class="tip-kpi"><div class="lbl">D\u00edas Imput.</div><div class="val">${di.toFixed(1)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Working Days</div><div class="val">${wd}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">ADR</div><div class="val" style="color:var(--accent)">${fmt(adrV)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">ADC</div><div class="val" style="color:#c0392b">${fmt(adcV)}</div></div></div>`;
  if (cons.length > 0) {
    html += `<div style="border-top:1px solid var(--border2);padding-top:6px;margin-top:2px">`;
    html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin-bottom:4px;font-weight:600">Profesionales (${cons.length})</div>`;
    cons.forEach(c => { html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid #f0f0f0"><span>${c[0]}</span><span style="color:var(--text3);font-size:11px">${c[1]}</span></div>`; });
    html += `</div>`;
  }
  tip.innerHTML = html; tip.style.display = 'block';
  const rect = el.getBoundingClientRect();
  let left = rect.right + 8, top = rect.top - 10;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (left + tw > window.innerWidth - 10) left = rect.left - tw - 8;
  if (top + th > window.innerHeight - 10) top = window.innerHeight - th - 10;
  if (top < 10) top = 10;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}

function hideTip() { tip.style.display = 'none'; }

// ─── Start ───
document.addEventListener('DOMContentLoaded', loadData);
