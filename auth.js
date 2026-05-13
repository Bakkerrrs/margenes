// ─── Password Gate + Import Auth ───
// Passwords stored as SHA-256 hashes in app_settings table

let impCredentials = null; // { url, key } loaded from app_settings after import auth

// ─── Password hashing (SHA-256 via Web Crypto API v) ───

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Password validation against Supabase ───

async function validatePassword(password) {
  const hash = await hashPassword(password);
  const rows = await supabaseFetch('app_settings', `key=eq.site_password&limit=1`);
  if (rows.length === 0) return false;
  return rows[0].value === hash;
}

async function validateImportPassword(password) {
  const hash = await hashPassword(password);
  const rows = await supabaseFetch('app_settings', `key=eq.import_password&limit=1`);
  if (rows.length === 0) return false;
  return rows[0].value === hash;
}

async function loadImportCredentials() {
  const rows = await supabaseFetch('app_settings', `key=in.(import_supabase_url,import_service_key)`);
  const urlRow = rows.find(r => r.key === 'import_supabase_url');
  const keyRow = rows.find(r => r.key === 'import_service_key');
  if (urlRow && keyRow) {
    return { url: urlRow.value, key: keyRow.value };
  }
  return null;
}

// ─── Import auth handler ───

async function impAuth() {
  const input = document.getElementById('impPassword');
  const errEl = document.getElementById('impAuthError');
  const password = input.value.trim();

  if (!password) { errEl.textContent = 'Ingresa la contraseña.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  input.disabled = true;

  try {
    const valid = await validateImportPassword(password);
    if (!valid) {
      errEl.textContent = 'Contraseña incorrecta.';
      errEl.style.display = 'block';
      input.value = '';
      input.focus();
      input.disabled = false;
      return;
    }

    // Load credentials from DB
    impCredentials = await loadImportCredentials();
    if (!impCredentials) {
      errEl.textContent = 'Credenciales de importación no configuradas en app_settings.';
      errEl.style.display = 'block';
      input.disabled = false;
      return;
    }

    // Show success, unlock steps
    document.getElementById('impAuthForm').style.display = 'none';
    document.getElementById('impAuthOk').style.display = '';
    document.getElementById('impStep2').style.opacity = '1';
    document.getElementById('impStep2').style.pointerEvents = '';
    document.getElementById('impStep3').style.opacity = '1';
    document.getElementById('impStep3').style.pointerEvents = '';
  } catch (err) {
    errEl.textContent = 'Error: ' + err.message;
    errEl.style.display = 'block';
    input.disabled = false;
  }
}

// ─── UI functions ───

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideLoginError() {
  const el = document.getElementById('loginError');
  if (el) el.style.display = 'none';
}

function showApp() {
  hideLoginError();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = '';

  if (typeof loadData === 'function') {
    loadData();
  }
}

function logout() {
  sessionStorage.removeItem('margenes_auth');
  window.location.reload();
}

// ─── Password form handler ───

async function handlePasswordSubmit(e) {
  e.preventDefault();
  hideLoginError();

  const input = document.getElementById('passwordInput');
  const password = input.value.trim();

  if (!password) {
    showLoginError('Ingresa la contraseña.');
    return false;
  }

  input.disabled = true;
  const btn = document.querySelector('#passwordForm button');
  const origText = btn.textContent;
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const valid = await validatePassword(password);
    if (valid) {
      sessionStorage.setItem('margenes_auth', 'ok');
      showApp();
    } else {
      showLoginError('Contraseña incorrecta.');
      input.value = '';
      input.focus();
    }
  } catch (err) {
    console.error('Auth error:', err);
    showLoginError('Error al verificar: ' + err.message);
  } finally {
    input.disabled = false;
    btn.textContent = origText;
    btn.disabled = false;
  }

  return false;
}

// ─── Initialization ───

document.addEventListener('DOMContentLoaded', function () {
  if (sessionStorage.getItem('margenes_auth') === 'ok') {
    showApp();
    return;
  }

  showLoginScreen();
  const input = document.getElementById('passwordInput');
  if (input) input.focus();
});
