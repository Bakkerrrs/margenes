// ─── Clerk SSO Authentication + Supabase User Management ───
// La Publishable Key se configura en el atributo data-clerk-publishable-key
// del script tag en index.html

// Dominios permitidos para login
const ALLOWED_DOMAINS = ['siigroup.cl'];

let currentUser = null;   // Clerk user object
let currentDbUser = null;  // Supabase app_users row

// ─── Supabase user helpers ───

async function upsertAppUser(clerkUser) {
  const email = clerkUser.primaryEmailAddress.emailAddress;
  const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0];
  const clerkId = clerkUser.id;

  // Check if user exists
  const existing = await supabaseFetch('app_users', `clerk_id=eq.${encodeURIComponent(clerkId)}&limit=1`);

  if (existing.length > 0) {
    // Update last_login
    const url = `${SUPABASE_URL}/rest/v1/app_users?clerk_id=eq.${encodeURIComponent(clerkId)}`;
    await fetch(url, {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ name, last_login: new Date().toISOString() }),
    });
    // Re-fetch to get updated row
    const updated = await supabaseFetch('app_users', `clerk_id=eq.${encodeURIComponent(clerkId)}&limit=1`);
    return updated[0];
  } else {
    // Insert new user (default: role=user, status=active)
    const url = `${SUPABASE_URL}/rest/v1/app_users`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ clerk_id: clerkId, email, name, role: 'user', status: 'active' }),
    });
    if (!resp.ok) throw new Error('Error creating user: ' + await resp.text());
    const created = await resp.json();
    return created[0];
  }
}

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

// ─── Domain validation ───

function validateDomain(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.some(d => domain && domain.toLowerCase() === d.toLowerCase());
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

async function showApp(clerkUser) {
  hideLoginError();

  // Sync user to Supabase
  try {
    currentDbUser = await upsertAppUser(clerkUser);
  } catch (err) {
    console.error('User sync error:', err);
    showLoginError('Error sincronizando usuario. Intenta nuevamente.');
    return;
  }

  // Check if user is inactive
  if (currentDbUser && currentDbUser.status === 'inactive') {
    showLoginError('Tu cuenta está desactivada. Contacta al administrador.');
    return;
  }

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = '';

  // Show user info in header
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    const name = clerkUser.fullName || clerkUser.firstName || 'Usuario';
    const isAdmin = currentDbUser && currentDbUser.role === 'admin';
    userInfo.innerHTML = `
      ${isAdmin ? '<span class="role-badge">Admin</span>' : ''}
      <span class="user-name">${name}</span>
      <button class="logout-btn" onclick="logout()" title="Cerrar sesión">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>`;
  }

  // Show admin tab if user is admin
  const adminBtn = document.getElementById('tabAdminBtn');
  if (adminBtn) {
    adminBtn.style.display = (currentDbUser && currentDbUser.role === 'admin') ? '' : 'none';
  }

  // Load dashboard data
  if (typeof loadData === 'function') {
    loadData();
  }
}

function logout() {
  if (typeof Clerk !== 'undefined') {
    Clerk.signOut().then(() => {
      window.location.reload();
    });
  }
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
      const isSelf = currentDbUser && u.id === currentDbUser.id;
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
          ${isSelf ? '<span style="font-size:11px;color:var(--text3)">Tú</span>' : `
            <select class="admin-action-select" onchange="adminAction(${u.id}, this.value, this)" data-uid="${u.id}">
              <option value="">Acción...</option>
              <option value="role:admin" ${u.role === 'admin' ? 'disabled' : ''}>Hacer Admin</option>
              <option value="role:user" ${u.role === 'user' ? 'disabled' : ''}>Hacer User</option>
              <option value="status:active" ${u.status === 'active' ? 'disabled' : ''}>Activar</option>
              <option value="status:inactive" ${u.status === 'inactive' ? 'disabled' : ''}>Desactivar</option>
            </select>
          `}
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
    // Hide admin tab content
    const adminPanel = document.getElementById('tabAdmin');
    if (adminPanel) adminPanel.style.display = 'none';

    if (tab === 'admin') {
      // Hide other tabs
      ['tabResumen', 'tabDetalle', 'tabConsultor', 'tabImportar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      adminPanel.style.display = '';
      // Update active tab style
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tabAdminBtn').classList.add('active');
      loadAdminPanel();
    } else {
      original(tab);
    }
  };
}

// ─── Initialization ───
// Uses the global Clerk object loaded via CDN script tags in index.html
// The publishable key is set via data-clerk-publishable-key attribute

window.addEventListener('load', async function () {
  // Dev mode: if key not configured, skip auth
  const clerkScript = document.getElementById('clerkScript');
  const publishableKey = clerkScript ? clerkScript.getAttribute('data-clerk-publishable-key') : '';

  if (!publishableKey || publishableKey === 'TU_CLERK_PUBLISHABLE_KEY') {
    console.warn('⚠️ Configura tu Clerk Publishable Key en el script tag de index.html');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = '';
    patchSwitchTab();
    // In dev mode, show admin tab for testing
    const adminBtn = document.getElementById('tabAdminBtn');
    if (adminBtn) adminBtn.style.display = '';
    if (typeof loadData === 'function') loadData();
    return;
  }

  showLoginScreen();

  try {
    // Load Clerk (global object from CDN)
    await Clerk.load();

    patchSwitchTab();

    if (Clerk.user) {
      // Already signed in
      const email = Clerk.user.primaryEmailAddress?.emailAddress;
      if (!validateDomain(email)) {
        await Clerk.signOut();
        showLoginError('Solo se permiten cuentas de ' + ALLOWED_DOMAINS.join(', '));
        return;
      }
      currentUser = Clerk.user;
      await showApp(Clerk.user);
    } else {
      // Mount Clerk sign-in component
      Clerk.mountSignIn(document.getElementById('clerkSignIn'), {
        appearance: {
          elements: {
            rootBox: { width: '100%' },
            card: { boxShadow: 'none', border: 'none' },
          },
        },
      });

      // Listen for sign-in completion
      Clerk.addListener(({ user }) => {
        if (user) {
          const email = user.primaryEmailAddress?.emailAddress;
          if (!validateDomain(email)) {
            Clerk.signOut();
            showLoginError('Solo se permiten cuentas de ' + ALLOWED_DOMAINS.join(', '));
            return;
          }
          currentUser = user;
          Clerk.unmountSignIn(document.getElementById('clerkSignIn'));
          showApp(user);
        }
      });
    }
  } catch (err) {
    console.error('Clerk init error:', err);
    showLoginError('Error inicializando autenticación: ' + err.message);
  }
});
