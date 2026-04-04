// ─── Password Gate + Supabase User Management ───
// Password is stored as SHA-256 hash in app_settings table

// Dominios permitidos (reserved for future SSO use)
const ALLOWED_DOMAINS = ['siigroup.cl'];

let currentDbUser = null;

// ─── Password hashing (SHA-256 via Web Crypto API) ───

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
  if (rows.length === 0) {
    // No password set — allow access (first-time setup)
    return true;
  }
  return rows[0].value === hash;
}

// ─── Supabase user helpers ───

async function fetchAllAppUsers() {
  return supabaseFetch('app_users', 'order=created_at.desc');
}

async function updateAppUser(id, fields) {
  const url = `${SUPABASE_URL}/rest/v1/app_users?id=eq.${id}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify(fields),
  });
  if (!resp.ok) throw new Error('Error updating user: ' + await resp.text());
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

  // Show admin tab (password-gated app = trusted user)
  const adminBtn = document.getElementById('tabAdminBtn');
  if (adminBtn) adminBtn.style.display = '';

  // Load dashboard data
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

  // Disable form while validating
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

// ─── Admin Panel ───

async function loadAdminPanel() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Cargando usuarios...</td></tr>';

  try {
    const users = await fetchAllAppUsers();
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">No hay usuarios registrados</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const statusCls = u.status === 'active' ? 'status-active' : 'status-inactive';
      const roleCls = u.role === 'admin' ? 'role-admin' : 'role-user';
      return `<tr>
        <td style="font-size:12px">${u.email}</td>
        <td>${u.name || '-'}</td>
        <td><span class="admin-badge ${roleCls}">${u.role}</span></td>
        <td><span class="admin-badge ${statusCls}">${u.status}</span></td>
        <td style="font-size:11px;color:var(--text3)">${u.created_at ? new Date(u.created_at).toLocaleDateString('es-CL') : '-'}</td>
        <td style="font-size:11px;color:var(--text3)">${u.last_login ? new Date(u.last_login).toLocaleDateString('es-CL') : '-'}</td>
        <td>
          <select class="admin-action-select" onchange="adminAction(${u.id}, this.value, this)" data-uid="${u.id}">
            <option value="">Acción...</option>
            <option value="role:admin" ${u.role === 'admin' ? 'disabled' : ''}>Hacer Admin</option>
            <option value="role:user" ${u.role === 'user' ? 'disabled' : ''}>Hacer User</option>
            <option value="status:active" ${u.status === 'active' ? 'disabled' : ''}>Activar</option>
            <option value="status:inactive" ${u.status === 'inactive' ? 'disabled' : ''}>Desactivar</option>
          </select>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Admin panel error:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:20px">Error cargando usuarios</td></tr>';
  }
}

async function adminAction(userId, action, selectEl) {
  if (!action) return;
  const [field, value] = action.split(':');
  try {
    await updateAppUser(userId, { [field]: value });
    await loadAdminPanel();
  } catch (err) {
    alert('Error: ' + err.message);
  }
  if (selectEl) selectEl.value = '';
}

// ─── Hook into switchTab ───

function patchSwitchTab() {
  if (typeof switchTab !== 'function') return;
  const original = switchTab;
  window.switchTab = function(tab) {
    const adminPanel = document.getElementById('tabAdmin');
    if (adminPanel) adminPanel.style.display = 'none';

    if (tab === 'admin') {
      ['tabResumen', 'tabDetalle', 'tabConsultor', 'tabImportar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      adminPanel.style.display = '';
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tabAdminBtn').classList.add('active');
      loadAdminPanel();
    } else {
      original(tab);
    }
  };
}

// ─── Initialization ───

document.addEventListener('DOMContentLoaded', function () {
  patchSwitchTab();

  // Check if already authenticated in this session
  if (sessionStorage.getItem('margenes_auth') === 'ok') {
    showApp();
    return;
  }

  // Show password gate
  showLoginScreen();
  // Focus password input
  const input = document.getElementById('passwordInput');
  if (input) input.focus();
});
