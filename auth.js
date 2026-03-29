// ─── Microsoft SSO Authentication (MSAL.js v2) ───
// Configura tu Application (client) ID desde Azure AD App Registration
// Guía: https://portal.azure.com > Azure Active Directory > App registrations

const MSAL_CONFIG = {
  auth: {
    // ⚠️ REEMPLAZAR con tu Application (client) ID de Azure AD
    clientId: 'TU_CLIENT_ID_AQUI',
    // Multi-tenant: permite login desde cualquier tenant (incluido siigroup.cl)
    authority: 'https://login.microsoftonline.com/common',
    // Redirect URI — debe coincidir con la configurada en Azure AD
    redirectUri: window.location.origin + window.location.pathname,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// Dominios permitidos para login (solo cuentas corporativas de siigroup.cl)
const ALLOWED_DOMAINS = ['siigroup.cl'];

// Scopes mínimos para SSO (solo perfil del usuario)
const LOGIN_SCOPES = { scopes: ['User.Read'] };

let msalInstance = null;
let currentUser = null;

function initAuth() {
  msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);

  // Manejar redirect después del login
  return msalInstance.handleRedirectPromise().then(response => {
    if (response) {
      return processLoginResponse(response);
    }

    // Verificar si ya hay sesión activa
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      if (validateDomain(account.username)) {
        currentUser = account;
        return account;
      } else {
        // Dominio no permitido: cerrar sesión
        msalInstance.clearCache();
        showLoginError('Solo se permiten cuentas de ' + ALLOWED_DOMAINS.join(', '));
        return null;
      }
    }
    return null;
  });
}

function processLoginResponse(response) {
  const account = response.account;
  if (!validateDomain(account.username)) {
    msalInstance.clearCache();
    showLoginError('Solo se permiten cuentas de ' + ALLOWED_DOMAINS.join(', '));
    return null;
  }
  currentUser = account;
  return account;
}

function validateDomain(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.some(d => domain && domain.toLowerCase() === d.toLowerCase());
}

function login() {
  hideLoginError();
  // Popup login — mejor UX para SPAs
  msalInstance.loginPopup(LOGIN_SCOPES)
    .then(response => {
      const account = processLoginResponse(response);
      if (account) {
        showApp(account);
      }
    })
    .catch(err => {
      console.error('Login error:', err);
      if (err.errorCode === 'user_cancelled') return;
      showLoginError('Error al iniciar sesión: ' + err.message);
    });
}

function logout() {
  msalInstance.logoutPopup({
    postLogoutRedirectUri: window.location.origin + window.location.pathname,
  }).catch(err => {
    // Fallback: limpiar caché y recargar
    msalInstance.clearCache();
    window.location.reload();
  });
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showApp(account) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = '';

  // Mostrar info del usuario en el header
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    const name = account.name || account.username;
    userInfo.innerHTML = `
      <span class="user-name">${name}</span>
      <button class="logout-btn" onclick="logout()" title="Cerrar sesión">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>`;
  }

  // Cargar datos del dashboard
  if (typeof loadData === 'function') {
    loadData();
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideLoginError() {
  const el = document.getElementById('loginError');
  if (el) el.style.display = 'none';
}

// ─── Inicialización ───
document.addEventListener('DOMContentLoaded', function () {
  // Si MSAL no está cargado (falta la librería), mostrar error
  if (typeof msal === 'undefined') {
    console.error('MSAL.js no cargado');
    showLoginScreen();
    showLoginError('Error: librería de autenticación no disponible.');
    return;
  }

  // Verificar que se configuró el clientId
  if (MSAL_CONFIG.auth.clientId === 'TU_CLIENT_ID_AQUI') {
    console.warn('⚠️ Configura tu Client ID de Azure AD en auth.js');
    // En desarrollo, permitir acceso sin SSO
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = '';
    if (typeof loadData === 'function') loadData();
    return;
  }

  showLoginScreen();
  initAuth().then(account => {
    if (account) {
      showApp(account);
    }
  }).catch(err => {
    console.error('Auth init error:', err);
    showLoginError('Error inicializando autenticación.');
  });
});
