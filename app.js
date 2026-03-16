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
let HOLI = {};   // holidays keyed by "employee|month" → total dias
let CONS_RAW = []; // raw consultores rows for Consultor tab
let F = { fy: [], bu: [], ta: [], cu: [], je: [] };  // filter options

let sChart, hChart;
let sortCol = 8, sortDir = 'asc';
let detSortCol = 'ad', detSortDir = 'asc';
let activeTab = 'resumen';
let selRange = -1; // selected RANGES index from hChart click (-1 = no filter)

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
    //  6:prod, 7:total_costo_corregido, 8:margin (calculated), 9:billing, 10:jefatura,
    //  11:diasImputados, 12:workingDays, 13:fy, 14:pais, 15:quarter,
    //  16:project, 17:projectName, 18:subproject, 19:subprojectName,
    //  20:irm, 21:keyBuFinal, 22:starterDate, 23:finisherDate]
    ALL = actRows.map(r => [
      r.month, r.customer, r.act_short, r.act_desc,
      r.tipo_at, r.bu,
      Number(r.prod), Number(r.total_costo_corregido), Number(r.prod) !== 0 ? (Number(r.prod) + Number(r.total_costo_corregido)) / Number(r.prod) : 0, Number(r.billing),
      r.jefatura, Number(r.dias_imputados), Number(r.working_days), r.fy,
      r.pais || '', r.quarter || '',
      r.project || '', r.project_name || '', r.subproject || '', r.subproject_name || '',
      r.irm || '', r.key_bu_final || '', r.starter_date || '', r.finisher_date || ''
    ]);

    // Store raw consultores for Consultor tab
    CONS_RAW = consRows;

    // Transform consultores to dict keyed by "actShort|month"
    CONS = {};
    HOLI = {};
    consRows.forEach(r => {
      const key = `${r.act_short}|${r.month}`;
      if (!CONS[key]) CONS[key] = [];
      CONS[key].push([r.profesional || r.employee_name, r.jefe_directo, r.responsible_id || '']);
      // Build holiday lookup: employee|month → dias
      const name = r.profesional || r.employee_name;
      if (r.report_code === 'Holiday' && name && r.month) {
        const hKey = `${name}|${r.month}`;
        HOLI[hKey] = (HOLI[hKey] || 0) + (Number(r.dias) || 0);
      }
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

  // BU, TipoAT, Customer, Jefatura and Month filters are populated dynamically in onFYChange()

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
  const fyData = ALL.filter(a => a[13] === fy);

  function updateSelect(id, values, prevVal, allLabel) {
    const sel = document.getElementById(id);
    sel.innerHTML = allLabel ? `<option value="">${allLabel}</option>` : '';
    values.forEach(v => { sel.innerHTML += `<option value="${v}">${v}</option>`; });
    sel.value = values.includes(prevVal) ? prevVal : (allLabel ? '' : values[values.length - 1] || '');
  }

  const fyBU = [...new Set(fyData.map(a => a[5]))].filter(v => v && v !== '0').sort();
  const fyTA = [...new Set(fyData.map(a => a[4]))].sort();
  const fyCU = [...new Set(fyData.map(a => a[1]))].sort();
  const fyJE = [...new Set(fyData.map(a => a[10]))].sort();
  const fyMonths = [...new Set(fyData.map(a => a[0]))].sort();

  updateSelect('filterBU', fyBU, document.getElementById('filterBU').value, 'Todas');
  updateSelect('filterTipoAT', fyTA, document.getElementById('filterTipoAT').value, 'Todas');
  updateSelect('filterCustomer', fyCU, document.getElementById('filterCustomer').value, 'Todas');
  updateSelect('filterJefatura', fyJE, document.getElementById('filterJefatura').value, 'Todas');

  const prevMonth = document.getElementById('filterMonth').value;
  const ms = document.getElementById('filterMonth');
  ms.innerHTML = '';
  fyMonths.forEach(m => { ms.innerHTML += `<option value="${m}">${mlabel(m)}</option>`; });
  ms.value = fyMonths.includes(prevMonth) ? prevMonth : fyMonths[fyMonths.length - 1] || '';

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
  selRange = -1; // reset range filter on any refresh
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

  // Click handler: filter table by margin range
  document.getElementById('horizChart').onclick = function(evt) {
    const els = hChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
    if (els.length > 0) {
      const ri = els[0].index;
      selRange = selRange === ri ? -1 : ri; // toggle
    } else {
      selRange = -1;
    }
    // Visual feedback: dim unselected bars
    const bgColors = RANGES.map((r, i) => selRange === -1 || selRange === i ? r.color : r.color + '30');
    hChart.data.datasets[0].backgroundColor = bgColors;
    hChart.update();
    const filtered = selRange === -1 ? md : md.filter(a => gri(a[8]) === selRange);
    renderTable(filtered, f.month);
  };

  document.getElementById('detailMonthLabel').textContent = mlabel(f.month);
  const filtered = selRange === -1 ? md : md.filter(a => gri(a[8]) === selRange);
  renderTable(filtered, f.month);
  if (activeTab === 'detalle') refreshDetalle();
}

// ─── Resumen Table ───

const SORT_COLS = [null, { k: 2, t: 's' }, { k: 3, t: 's' }, { k: 1, t: 's' }, { k: 5, t: 's' }, { k: 10, t: 's' }, { k: 6, t: 'n' }, { k: 7, t: 'n' }, { k: 8, t: 'n' }, { k: 9, t: 'n' }];

function doSort(ci) {
  if (sortCol === ci) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; } else { sortCol = ci; sortDir = 'asc'; }
  const f = gf(), fd = flt(ALL), md = fd.filter(a => a[0] === f.month);
  const filtered = selRange === -1 ? md : md.filter(a => gri(a[8]) === selRange);
  renderTable(filtered, f.month);
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
        + `<table style="width:100%;font-size:12px"><tr><th style="padding:5px 10px;text-align:left">Profesional</th><th style="padding:5px 10px;text-align:left">Jefe Directo</th><th style="padding:5px 10px;text-align:left">ADV</th></tr>`;
      CONS[key].forEach(c => { h += `<tr><td style="padding:5px 10px;border-bottom:1px solid var(--border2)">${c[0]}</td><td style="padding:5px 10px;border-bottom:1px solid var(--border2)">${c[1]}</td><td style="padding:5px 10px;border-bottom:1px solid var(--border2)">${c[2]}</td></tr>`; });
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
  document.getElementById('tabConsultor').style.display = tab === 'consultor' ? '' : 'none';
  document.getElementById('tabImportar').style.display = tab === 'importar' ? '' : 'none';
  if (tab === 'detalle') refreshDetalle();
  if (tab === 'consultor') initConsultorTab();
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

// ─── Consultor Tab ───

let consultorInited = false;
let consultorNames = [];
let consultorActiveIdx = -1;

function initConsultorTab() {
  if (consultorInited) return;
  consultorInited = true;
  consultorNames = [...new Set(CONS_RAW.map(r => r.profesional || r.employee_name).filter(Boolean))].sort();

  const inp = document.getElementById('consultorInput');
  const dd = document.getElementById('consultorDropdown');

  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    consultorActiveIdx = -1;
    if (!q) { dd.classList.remove('open'); dd.innerHTML = ''; return; }
    const matches = consultorNames.filter(n => n.toLowerCase().includes(q)).slice(0, 30);
    if (matches.length === 0) {
      dd.innerHTML = '<div class="cd-empty">Sin resultados</div>';
    } else {
      dd.innerHTML = matches.map((n, i) => `<div class="cd-item" data-idx="${i}" onmousedown="selectConsultor('${n.replace(/'/g, "\\'")}')">${highlightMatch(n, q)}</div>`).join('');
    }
    dd.classList.add('open');
  });

  inp.addEventListener('keydown', (e) => {
    const items = dd.querySelectorAll('.cd-item');
    if (!items.length) {
      if (e.key === 'Enter') { e.preventDefault(); tryExactMatch(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); consultorActiveIdx = Math.min(consultorActiveIdx + 1, items.length - 1); updateActiveItem(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); consultorActiveIdx = Math.max(consultorActiveIdx - 1, 0); updateActiveItem(items); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (consultorActiveIdx >= 0 && items[consultorActiveIdx]) {
        items[consultorActiveIdx].onmousedown();
      } else if (items.length === 1) {
        items[0].onmousedown();
      } else { tryExactMatch(); }
    }
    else if (e.key === 'Escape') { dd.classList.remove('open'); }
  });

  inp.addEventListener('blur', () => { setTimeout(() => dd.classList.remove('open'), 150); });
  inp.addEventListener('focus', () => { if (inp.value.trim() && dd.innerHTML) dd.classList.add('open'); });
}

function updateActiveItem(items) {
  items.forEach((it, i) => it.classList.toggle('active', i === consultorActiveIdx));
  if (items[consultorActiveIdx]) items[consultorActiveIdx].scrollIntoView({ block: 'nearest' });
}

function highlightMatch(name, query) {
  const idx = name.toLowerCase().indexOf(query);
  if (idx < 0) return name;
  return name.slice(0, idx) + '<strong style="color:var(--accent)">' + name.slice(idx, idx + query.length) + '</strong>' + name.slice(idx + query.length);
}

function tryExactMatch() {
  const q = document.getElementById('consultorInput').value.trim().toLowerCase();
  const match = consultorNames.find(n => n.toLowerCase() === q);
  if (match) selectConsultor(match);
}

function selectConsultor(name) {
  document.getElementById('consultorInput').value = name;
  document.getElementById('consultorDropdown').classList.remove('open');
  refreshConsultor(name);
}

function refreshConsultor(name) {
  if (!name) name = document.getElementById('consultorInput').value.trim();
  const wrap = document.getElementById('consultorTableWrap');
  if (!name) { wrap.innerHTML = '<p style="color:var(--text3);padding:20px;text-align:center">Selecciona un consultor para ver su historial</p>'; return; }

  // Filter rows for this consultant, get activity description from ALL lookup
  const actDesc = {}; ALL.forEach(a => { actDesc[a[2]] = a[3]; });
  const rows = CONS_RAW
    .filter(r => (r.profesional || r.employee_name) === name)
    .map(r => ({
      act: r.act_short || '',
      desc: actDesc[r.act_short] || r.activity_name || '',
      month: r.month || '',
      adv: r.responsible_id || '',
      jef: r.jefe_directo || '',
      dias: Number(r.dias) || 0,
      costo: Number(r.costo_mensual) || 0,
      report: r.report_code || ''
    }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.act.localeCompare(b.act));

  let h = '<table><thead><tr>';
  h += '<th class="sortable" style="cursor:default">Actividad</th>';
  h += '<th class="sortable" style="cursor:default">Descripci\u00f3n</th>';
  h += '<th class="sortable" style="cursor:default">Mes</th>';
  h += '<th class="sortable" style="cursor:default">ADV</th>';
  h += '<th class="sortable" style="cursor:default">Jefatura</th>';
  h += '<th class="sortable" style="cursor:default;text-align:right">D\u00edas</th>';
  h += '<th class="sortable" style="cursor:default;text-align:right">Costo</th>';
  h += '</tr></thead><tbody>';

  rows.forEach(r => {
    h += '<tr>';
    h += `<td class="td-mono" style="font-size:11px">${r.act}</td>`;
    h += `<td class="td-name">${r.desc}</td>`;
    h += `<td class="td-mono" style="font-size:11px">${mlabel(r.month)}</td>`;
    h += `<td class="td-name" style="font-size:11px">${r.adv}</td>`;
    h += `<td class="td-name" style="font-size:11px">${r.jef}</td>`;
    h += `<td class="td-mono" style="text-align:right">${r.dias.toFixed(1)}</td>`;
    h += `<td class="td-mono" style="text-align:right;color:${r.costo < 0 ? '#c0392b' : '#229954'}">${fmt(r.costo)}</td>`;
    h += '</tr>';
  });

  if (rows.length === 0) {
    h += '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Sin registros</td></tr>';
  }

  h += '</tbody></table>';
  wrap.innerHTML = h;
}

// ─── Hover Tooltip ───

const tip = document.getElementById('hoverTip');

function showTip(ev, el) {
  const ds = el.dataset; const as = ds.as, mo = ds.mo, pr = parseFloat(ds.pr), co = parseFloat(ds.co), mg = ds.mg;
  const di = parseFloat(ds.di), wd = parseFloat(ds.wd), adrV = parseFloat(ds.adr), adcV = parseFloat(ds.adc);
  const key = `${as}|${mo}`; const cons = CONS[key] || [];
  // Calculate total holiday days for professionals on this activity-month
  const uniqueProfs = [...new Set(cons.map(c => c[0]))];
  const totalHoli = uniqueProfs.reduce((sum, name) => sum + (HOLI[`${name}|${mo}`] || 0), 0);
  let html = `<div style="margin-bottom:8px;font-weight:700;color:var(--accent);font-size:13px">${mlabel(mo)}</div>`;
  html += `<div class="tip-grid"><div class="tip-kpi"><div class="lbl">Producci\u00f3n</div><div class="val">${fmt(pr)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Costo</div><div class="val" style="color:${co < 0 ? '#c0392b' : '#229954'}">${fmt(co)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Margen</div><div class="val">${mg}${mg !== 'N/A' ? '%' : ''}</div></div></div>`;
  html += `<div class="tip-grid g5">`
    + `<div class="tip-kpi"><div class="lbl">D\u00edas Imput.</div><div class="val">${di.toFixed(1)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Working Days</div><div class="val">${wd}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">Holidays</div><div class="val" style="color:#8e44ad">${totalHoli.toFixed(1)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">ADR</div><div class="val" style="color:var(--accent)">${fmt(adrV)}</div></div>`
    + `<div class="tip-kpi"><div class="lbl">ADC</div><div class="val" style="color:#c0392b">${fmt(adcV)}</div></div></div>`;
  if (cons.length > 0) {
    html += `<div style="border-top:1px solid var(--border2);padding-top:6px;margin-top:2px">`;
    html += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin-bottom:4px;font-weight:600">Profesionales (${cons.length})</div>`;
    cons.forEach(c => { const hd = HOLI[`${c[0]}|${mo}`] || 0; html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid #f0f0f0"><span>${c[0]}</span><span style="color:#8e44ad;font-size:11px;min-width:40px;text-align:right">${hd > 0 ? hd.toFixed(1) + 'd vac' : ''}</span>${c[2] ? `<span style="color:var(--text3);font-size:11px">${c[2]}</span>` : ''}<span style="color:var(--text3);font-size:11px">${c[1]}</span></div>`; });
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

// ─── Import Tab Logic ───

let impWorkbook = null, impBDD1 = null, impBDD2 = null;

const IMP_BDD1_MAP = {
  'Ejercicio':'fy','Ejercicio actividad':'fy','Month':'month','Customer':'customer',
  'Activity Short Name':'act_short','Activity Description':'act_desc',
  'IRM vs2':'irm','Income recognition Method':'irm',
  'End of period WIP':'wip','Total Facturacion mensual':'billing',
  'Total Monthly Prod':'prod','Total Monthly costs':'cost',
  'Total Monthly Margen':'margin','Total dias imputados':'dias_imputados',
  'Dias Actividad':'dias_actividad','Dias Gratuidad':'dias_gratuidad',
  'ADV - Responsible ID':'adv_responsible_id','Project':'project',
  'Project name':'project_name','Subproject':'subproject',
  'Subproject name':'subproject_name','Tipo-AT':'tipo_at',
  'Key BU FINAL':'key_bu_final','Key':'key_bu_final','BU FINAL':'bu',
  'Working Days':'working_days',
  'Total Costo Corregido':'total_costo_corregido',
  'UF Gestionable':'uf_gestionable','Gestionable':'uf_gestionable',
  'OPS':'ops','AUX_AMR':'aux_amr','Quarter':'quarter','Pais':'pais',
  'Subco':'subco','Standarized Project':'standarized_project',
  'BU FINAL 2':'bu','Code Report':'code_report','Desc Report':'desc_report',
  'Total_Prod_UF':'total_prod_uf','Jefatura':'jefatura',
  'Starter Date':'starter_date','Finisher Date':'finisher_date'
};

const IMP_BDD2_MAP = {
  'RUT':'rut','Emp ID2 (Unique)':'emp_id2','Jefe directo':'jefe_directo',
  'Month':'month','Cliente':'cliente','BU2':'bu2','Employee Type':'employee_type',
  'Project':'project','Sub-project':'subproject','Employee ID':'employee_id',
  'Employee Name':'employee_name','Responsible ID':'responsible_id',
  'Activity Name':'activity_name','Activity Short Name':'act_short',
  'Report code':'report_code','Hours':'hours','Dias':'dias',
  'Working Days':'working_days','FTE2':'fte','Costo diario':'costo_diario',
  'Costo mensual':'costo_mensual','IFS':'ifs',
  'Fecha de contratación':'fecha_contratacion','Unlink Date':'unlink_date',
  'Project name':'project_name','Tipologia':'tipologia',
  'End of month':'end_of_month','Sueldo Base Nominal':'sueldo_base_nominal',
  'Sueldo Liquido Teoricó':'sueldo_liquido_teorico',
  'Producción mensual (UF)':'prod_mensual_uf',
  'Producción mensual (Pesos chilenos)':'prod_mensual_pesos',
  'Gratuidad':'gratuidad','Key BU FINAL 2':'key_bu_final_2',
  'BU-Jefatura':'bu_jefatura','Grupo Cliente':'grupo_cliente',
  'TipoAT':'tipo_at','Pais':'pais','Subco':'subco',
  'Standarized Project':'standarized_project','Code Report':'code_report',
  'Costo mensual IFS':'costo_mensual','BU FINAL 2':'bu2',
  'Pais Subco':'pais','Mission Yerie':'mission',
  'Mission':'mission','Yerie':'yerie','BM':'bm',
  'Employee ID 2':'employee_id_2','Employee Name 2':'employee_name_2','RUT 2':'rut_2'
};

const IMP_NUM1 = new Set(['wip','billing','prod','cost','margin','dias_imputados','dias_actividad','dias_gratuidad','working_days','total_costo_corregido','total_prod_uf']);
const IMP_NUM2 = new Set(['hours','dias','working_days','fte','costo_diario','costo_mensual','sueldo_base_nominal','sueldo_liquido_teorico','prod_mensual_uf','prod_mensual_pesos']);

function impLog(type, msg) {
  const el = document.getElementById('impLog');
  const t = new Date().toLocaleTimeString('es-CL');
  el.innerHTML += `<div><span style="color:#666">[${t}]</span> <span class="${type}">${msg}</span></div>`;
  el.scrollTop = el.scrollHeight;
}

function impProgress(pct) {
  document.getElementById('impProgressFill').style.width = pct + '%';
  document.getElementById('impProgressLabel').textContent = pct + '%';
}

function impFormatMonth(val) {
  if (!val) return '';
  if (val instanceof Date) return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}`;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,7);
  // US format M/D/YY or M/D/YYYY (last day of month → extract month)
  const mdy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (mdy) {
    let yr = parseInt(mdy[3]); if (yr < 100) yr += 2000;
    return `${yr}-${mdy[1].padStart(2,'0')}`;
  }
  // DD-MM-YYYY or DD/MM/YYYY (day > 12 distinguishes from US)
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy && parseInt(dmy[1]) > 12) return `${dmy[3]}-${dmy[2].padStart(2,'0')}`;
  const mn = {'ene':'01','feb':'02','mar':'03','abr':'04','may':'05','jun':'06','jul':'07','ago':'08','sep':'09','oct':'10','nov':'11','dic':'12'};
  const mx = s.match(/^([a-z]{3})-(\d{2})$/i);
  if (mx && mn[mx[1].toLowerCase()]) return `${parseInt(mx[2])+2000}-${mn[mx[1].toLowerCase()]}`;
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 50000) {
    const d = new Date((num - 25569) * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  return s;
}

function impFormatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function impParseSheet(sheet, colMap, numSet) {
  // Read as raw array of arrays to find the real header row
  // (Excel files often have title/merged rows before the actual headers)
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!aoa.length) return { rows: [], mappedCols: 0, totalCols: 0, unmapped: [], debug: 'empty sheet' };

  // Known header names to search for (lowercase)
  const knownHeaders = new Set(Object.keys(colMap).map(k => k.toLowerCase()));

  // Find the row that contains the most known headers (scan first 20 rows)
  let bestRow = 0, bestCount = 0;
  const debugRows = [];
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i];
    if (!row || !row.length) continue;
    let count = 0;
    const matched = [];
    row.forEach(cell => {
      if (cell == null) return;
      const v = String(cell).trim().toLowerCase();
      if (knownHeaders.has(v)) { count++; matched.push(String(cell).trim()); }
    });
    if (count > 0) debugRows.push(`Fila ${i}: ${count} matches (${matched.slice(0,5).join(', ')}${matched.length>5?'...':''})`);
    if (count > bestCount) { bestCount = count; bestRow = i; }
  }

  const debugInfo = `Header detectado en fila ${bestRow} con ${bestCount} coincidencias. ${debugRows.join('; ')}`;

  // If no headers found at all, return debug info
  if (bestCount === 0) {
    // Show what's actually in the first 10 rows for debugging
    const sampleRows = [];
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const row = aoa[i];
      if (!row || !row.length) continue;
      const cells = row.filter(c => c != null && String(c).trim()).slice(0, 6).map(c => String(c).trim());
      if (cells.length) sampleRows.push(`Fila ${i}: [${cells.join(' | ')}]`);
    }
    return { rows: [], mappedCols: 0, totalCols: aoa[0] ? aoa[0].length : 0, unmapped: [],
      debug: `No se encontraron headers conocidos. Primeras filas: ${sampleRows.join('; ')}` };
  }

  // Use bestRow as headers, everything after as data
  const headerRow = aoa[bestRow].map(c => c == null ? '' : String(c).trim());
  const hMap = {}, unmapped = [];
  let mapped = 0;

  headerRow.forEach((h, idx) => {
    if (!h) return;
    const k = colMap[h] || colMap[Object.keys(colMap).find(k2 => k2.toLowerCase() === h.toLowerCase())];
    if (k) { hMap[idx] = k; mapped++; } else { unmapped.push(h); }
  });

  const rows = [];
  for (let i = bestRow + 1; i < aoa.length; i++) {
    const raw = aoa[i];
    if (!raw || !raw.length) continue;
    const hasData = raw.some(c => c !== '' && c != null);
    if (!hasData) continue;

    const obj = {};
    Object.entries(hMap).forEach(([idxStr, dbC]) => {
      const idx = parseInt(idxStr);
      let v = raw[idx];
      if (v instanceof Date) v = impFormatDate(v);
      if (typeof v === 'string' && v.startsWith('#')) v = null;
      if (numSet.has(dbC)) {
        if (v === '' || v == null) { v = 0; }
        else if (typeof v === 'number') { v = v; }
        else { v = parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0; }
      }
      else { v = (v == null) ? '' : String(v).trim(); }
      obj[dbC] = v;
    });
    rows.push(obj);
  }

  return { rows, mappedCols: mapped, totalCols: headerRow.filter(h => h).length,
    unmapped: unmapped.filter(u => u && !u.startsWith('__')), debug: debugInfo };
}

function impPreview(title, data) {
  if (!data || !data.rows.length) return '';
  const sample = data.rows.slice(0, 5), cols = Object.keys(sample[0]).slice(0, 8);
  let h = `<div style="margin-top:10px"><strong>${title}</strong> <span class="import-tag import-tag-ok">${data.rows.length} filas</span>`;
  h += `<div class="import-preview"><table><thead><tr>`;
  cols.forEach(c => { h += `<th>${c}</th>`; });
  if (Object.keys(sample[0]).length > 8) h += `<th>...(+${Object.keys(sample[0]).length - 8})</th>`;
  h += '</tr></thead><tbody>';
  sample.forEach(row => {
    h += '<tr>';
    cols.forEach(c => {
      let v = row[c];
      if (typeof v === 'number') v = v.toLocaleString('es-CL', { maximumFractionDigits: 2 });
      else if (!v) v = '<span style="color:#ccc">—</span>';
      else if (String(v).length > 25) v = String(v).substring(0, 25) + '…';
      h += `<td>${v}</td>`;
    });
    if (Object.keys(row).length > 8) h += '<td>…</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div></div>';
  return h;
}

// File input handler
document.addEventListener('DOMContentLoaded', function() {
  const fi = document.getElementById('impFileInput');
  if (!fi) return;
  fi.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('impFileInfo').innerHTML = `<strong>${file.name}</strong> (${(file.size/1024/1024).toFixed(1)} MB)`;
    document.getElementById('impLog').innerHTML = '';
    impLog('info', `Leyendo: ${file.name}...`);
    document.getElementById('impProgressCard').style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        impWorkbook = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const sheets = impWorkbook.SheetNames;
        impLog('ok', `Hojas: ${sheets.join(', ')}`);

        const s1 = sheets.find(s => s.toUpperCase().includes('BDD1'));
        const s2 = sheets.find(s => s.toUpperCase().includes('BDD2'));
        let preview = '';

        if (s1) {
          impBDD1 = impParseSheet(impWorkbook.Sheets[s1], IMP_BDD1_MAP, IMP_NUM1);
          impLog('ok', `BDD1 ("${s1}"): ${impBDD1.rows.length} filas, ${impBDD1.mappedCols}/${impBDD1.totalCols} cols mapeadas [v2]`);
          if (impBDD1.debug) impLog('info', `BDD1 debug: ${impBDD1.debug}`);
          if (impBDD1.unmapped.length) impLog('warn', `BDD1 sin mapear: ${impBDD1.unmapped.join(', ')}`);
          preview += impPreview('BDD1 → actividades', impBDD1);
        } else { impLog('err', 'Hoja BDD1 no encontrada'); impBDD1 = null; }

        if (s2) {
          impBDD2 = impParseSheet(impWorkbook.Sheets[s2], IMP_BDD2_MAP, IMP_NUM2);
          impBDD2.rows.forEach(r => { if (!r.profesional && r.employee_name) r.profesional = r.employee_name; });
          impLog('ok', `BDD2 ("${s2}"): ${impBDD2.rows.length} filas, ${impBDD2.mappedCols}/${impBDD2.totalCols} cols mapeadas [v2]`);
          if (impBDD2.debug) impLog('info', `BDD2 debug: ${impBDD2.debug}`);
          if (impBDD2.unmapped.length) impLog('warn', `BDD2 sin mapear: ${impBDD2.unmapped.join(', ')}`);
          preview += impPreview('BDD2 → consultores', impBDD2);
        } else { impLog('err', 'Hoja BDD2 no encontrada'); impBDD2 = null; }

        document.getElementById('impSheetPreview').innerHTML = preview;
        document.getElementById('impBtnGo').disabled = !(impBDD1 || impBDD2);
        document.getElementById('impBtnClear').style.display = 'inline-block';
      } catch (err) {
        impLog('err', `Error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  });
});

function impSbHeaders(key) {
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
}

async function impTruncate(table, url, key) {
  const resp = await fetch(`${url}/rest/v1/${table}?id=gte.0`, { method: 'DELETE', headers: impSbHeaders(key) });
  if (!resp.ok) throw new Error(`TRUNCATE ${table}: ${resp.status} - ${await resp.text()}`);
}

async function impInsert(table, rows, url, key) {
  if (!rows.length) return;
  const resp = await fetch(`${url}/rest/v1/${table}`, { method: 'POST', headers: impSbHeaders(key), body: JSON.stringify(rows) });
  if (!resp.ok) throw new Error(`INSERT ${table}: ${resp.status} - ${await resp.text()}`);
}

function impNormalize(rows, type) {
  return rows.map(r => {
    const o = { ...r };
    if (o.month) o.month = impFormatMonth(o.month);
    if (type === 'bdd2') {
      if (!o.profesional && o.employee_name) o.profesional = o.employee_name;
      if (o.end_of_month) o.end_of_month = impFormatMonth(o.end_of_month);
    }
    Object.keys(o).forEach(k => { if (o[k] === '') o[k] = null; });
    return o;
  });
}

async function impStart() {
  const url = document.getElementById('impUrl').value.replace(/\/$/, '');
  const key = document.getElementById('impKey').value.trim();
  if (!url || !key) { alert('Completa URL y Service Role Key'); return; }

  const doClear = document.getElementById('impOptClear').checked;
  const do1 = document.getElementById('impOptBDD1').checked && impBDD1;
  const do2 = document.getElementById('impOptBDD2').checked && impBDD2;
  const bs = parseInt(document.getElementById('impBatchSize').value) || 200;

  document.getElementById('impBtnGo').disabled = true;
  document.getElementById('impProgressCard').style.display = 'block';
  impProgress(0);

  const total = (do1 ? impBDD1.rows.length : 0) + (do2 ? impBDD2.rows.length : 0);
  let done = 0, errors = 0;
  const t0 = Date.now();

  try {
    if (doClear) {
      if (do2) { impLog('info', 'Limpiando consultores...'); await impTruncate('consultores', url, key); impLog('ok', 'consultores limpiada'); }
      if (do1) { impLog('info', 'Limpiando actividades...'); await impTruncate('actividades', url, key); impLog('ok', 'actividades limpiada'); }
    }

    if (do1) {
      impLog('info', `BDD1 → actividades (${impBDD1.rows.length} filas)...`);
      // Log mapped columns for debugging
      if (impBDD1.rows.length > 0) {
        const sampleKeys = Object.keys(impBDD1.rows[0]);
        impLog('info', `Columnas mapeadas BDD1: ${sampleKeys.join(', ')}`);
        const reqFields = ['fy','month','customer','act_short','act_desc'];
        const missing = reqFields.filter(f => !sampleKeys.includes(f));
        if (missing.length) impLog('warn', `Columnas obligatorias NO mapeadas: ${missing.join(', ')}`);
      }
      const rows = impNormalize(impBDD1.rows, 'bdd1');
      const valid = rows.filter(r => r.fy && r.month && r.act_short);
      const skipped = rows.length - valid.length;
      if (skipped) impLog('warn', `${skipped} filas sin fy/month/act_short omitidas`);

      for (let i = 0; i < valid.length; i += bs) {
        const batch = valid.slice(i, i + bs);
        try { await impInsert('actividades', batch, url, key); done += batch.length; }
        catch (err) { errors += batch.length; impLog('err', `Batch actividades [${i}]: ${err.message}`); }
        impProgress(Math.round(done / total * 100));
      }
      impLog('ok', `actividades: ${done} filas importadas`);
    }

    if (do2) {
      impLog('info', `BDD2 → consultores (${impBDD2.rows.length} filas)...`);
      const rows = impNormalize(impBDD2.rows, 'bdd2');
      const valid = rows.filter(r => r.month && r.act_short && r.profesional);
      const skipped = rows.length - valid.length;
      if (skipped) impLog('warn', `${skipped} filas sin campos obligatorios omitidas`);

      let d2 = 0;
      for (let i = 0; i < valid.length; i += bs) {
        const batch = valid.slice(i, i + bs);
        try { await impInsert('consultores', batch, url, key); d2 += batch.length; done += batch.length; }
        catch (err) { errors += batch.length; impLog('err', `Batch consultores [${i}]: ${err.message}`); }
        impProgress(Math.round(done / total * 100));
      }
      impLog('ok', `consultores: ${d2} filas importadas`);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    impProgress(100);
    impLog('ok', `Completado en ${elapsed}s`);

    const sum = document.getElementById('impSummary');
    sum.style.display = 'grid';
    sum.innerHTML = `
      <div class="import-summary-item"><div class="num">${done}</div><div class="lbl">Importadas</div></div>
      <div class="import-summary-item"><div class="num" style="color:${errors?'#D64550':'#02931C'}">${errors}</div><div class="lbl">Errores</div></div>
      <div class="import-summary-item"><div class="num">${elapsed}s</div><div class="lbl">Tiempo</div></div>`;

    if (done > 0) {
      impLog('info', 'Recargando datos del dashboard...');
      await loadData();
      impLog('ok', 'Dashboard actualizado');
    }
  } catch (err) {
    impLog('err', `Error fatal: ${err.message}`);
  }
  document.getElementById('impBtnGo').disabled = false;
}

async function impClearTables() {
  const url = document.getElementById('impUrl').value.replace(/\/$/, '');
  const key = document.getElementById('impKey').value.trim();
  if (!url || !key) { alert('Completa URL y Service Role Key'); return; }
  if (!confirm('¿Eliminar TODOS los datos de ambas tablas?')) return;
  document.getElementById('impProgressCard').style.display = 'block';
  try {
    impLog('info', 'Limpiando consultores...'); await impTruncate('consultores', url, key); impLog('ok', 'OK');
    impLog('info', 'Limpiando actividades...'); await impTruncate('actividades', url, key); impLog('ok', 'OK');
    impLog('ok', 'Tablas limpiadas');
  } catch (err) { impLog('err', err.message); }
}

// ─── Start ───
document.addEventListener('DOMContentLoaded', loadData);
