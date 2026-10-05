import { getEnv } from './config.js';

const env = getEnv();
let refreshHandle = null;

/**
 * Generate a random string for PKCE
 * @param {number} length - Length of the random string
 * @returns {string} Random string
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  
  window.crypto.getRandomValues(array);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Generate code challenge for PKCE
 * @param {string} str - Code verifier
 * @returns {Promise<string>} Code challenge
 */
async function generateCodeChallenge(str) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return window.btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Redirect to Autodesk OAuth login
 * @param {string} clientId - Forge client ID
 * @param {string} scope - OAuth scope
 */
async function doRedirection(clientId, scope) {
  const redirect_uri = env.loginRedirect;
  const codeVerifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(codeVerifier);

  console.log('🔐 Initiating OAuth login...');
  console.log('Client ID:', clientId);
  console.log('Redirect URI:', redirect_uri);
  console.log('Scope:', scope);

  window.localStorage.setItem('codeVerifier', codeVerifier);
  const url = new URL('https://developer.api.autodesk.com/authentication/v2/authorize');
    
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('client_id', clientId);
  url.searchParams.append('redirect_uri', redirect_uri);
  url.searchParams.append('scope', scope);
  url.searchParams.append('code_challenge', challenge);
  url.searchParams.append('code_challenge_method', 'S256');

  console.log('OAuth URL:', url.toString());
  location.href = url.toString();
}

/**
 * Initiate login flow
 */
export async function login() {
  const scope = 'data:read data:write user-profile:read profapi:img-profile:read';
  await doRedirection(env.apsKey, scope);
}

/**
 * Log out the user
 */
export function logout() {
  delete window.sessionStorage.token;
  delete window.sessionStorage.refreshToken;
  delete window.sessionStorage.tokenExpiry;
  
  if (refreshHandle) {
    clearTimeout(refreshHandle);
    refreshHandle = null;
  }
  
  location.reload();
}

/**
 * Load user profile image
 * @returns {Promise<string>} User profile image URL
 */
async function loadUserProfile() {
  const res = await fetch('https://api.userprofile.autodesk.com/userinfo', {
    headers: { "Authorization": `Bearer ${window.sessionStorage.token}` }
  });
  const user = await res.json();
  return user.picture;
}

/**
 * Refresh the access token
 */
async function refreshToken() {
  console.log('Refreshing token...');

  if (refreshHandle) {
    clearTimeout(refreshHandle);
    refreshHandle = null;
  }

  try {
    const token = window.sessionStorage.refreshToken;
    const payload = {
      'grant_type': 'refresh_token',
      'client_id': env.apsKey,
      'refresh_token': token,
    };

    const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: Object.keys(payload).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key])).join('&')
    });
    
    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const newToken = await resp.json();
    window.sessionStorage.token = newToken['access_token'];
    window.sessionStorage.refreshToken = newToken['refresh_token'];
    
    // Store token expiry time for future reference
    const expiryTime = Date.now() + (newToken['expires_in'] * 1000);
    window.sessionStorage.tokenExpiry = expiryTime;

    // Schedule next token refresh
    const nextRefresh = newToken['expires_in'] - 60;
    refreshHandle = setTimeout(() => refreshToken(), nextRefresh * 1000);
  } catch (err) {
    console.error('Token refresh error:', err);
    logout();
  }
}

/**
 * Check login status and handle OAuth callback
 * @returns {Promise<boolean>} True if logged in, false otherwise
 */
/** Read a cookie value by name (returns null if absent). */
function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Clear a cookie by name. */
function clearCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export async function checkLogin() {
  // ── Hash-based deeplink params (cross-origin punch-out) ───────────────────
  // tandem-sample-portfolio passes account + facility as hash params:
  //   https://…/tandem-sample-stats/#account=NAME&facility=URN
  // We save them to sessionStorage NOW, before any OAuth redirect fires,
  // because sessionStorage survives same-tab redirects but the hash does not.
  // app.js reads them after login completes.
  {
    const _h = new URLSearchParams(window.location.hash.slice(1));
    if (_h.get('account'))  sessionStorage.setItem('tandem_deeplink_account',  _h.get('account'));
    if (_h.get('facility')) sessionStorage.setItem('tandem_deeplink_facility', _h.get('facility'));
    // Strip the hash so a page reload doesn't re-trigger the deeplink
    if (_h.get('account') || _h.get('facility')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }

  // ── Shared-token from companion app (localhost only) ──────────────────────
  // Cookies on localhost are shared across ports.  tandem-sample-portfolio
  // (port 8001) writes 'tandem_shared_token' so stats (port 8000) can reuse
  // the same session without forcing the user to log in again.
  // This has no effect on cross-origin deployments (cookie not readable).
  if (!window.sessionStorage.token) {
    const sharedToken = readCookie('tandem_shared_token');
    if (sharedToken) {
      window.sessionStorage.token = sharedToken;
      clearCookie('tandem_shared_token');
    }
  }

  const url = new URL(location);

  // Handle OAuth callback
  if (url.searchParams.has('code')) {
    console.log('✅ OAuth callback received');
    const code = url.searchParams.get('code');
    const codeVerifier = window.localStorage.getItem('codeVerifier');

    if (code && codeVerifier) {
      try {
        console.log('🔄 Exchanging authorization code for token...');
        const payload = {
          'grant_type': 'authorization_code',
          'client_id': env.apsKey,
          'code_verifier': codeVerifier,
          'code': code,
          'redirect_uri': env.loginRedirect
        };

        const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: Object.keys(payload).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key])).join('&')
        });
        
        if (resp.ok) {
          const token = await resp.json();
          console.log('✅ Token received successfully');
          window.sessionStorage.token = token['access_token'];
          window.sessionStorage.refreshToken = token['refresh_token'];
          
          // Store token expiry time for future reference
          const expiryTime = Date.now() + (token['expires_in'] * 1000);
          window.sessionStorage.tokenExpiry = expiryTime;

          // Schedule token refresh
          const nextRefresh = token['expires_in'] - 60;
          refreshHandle = setTimeout(() => refreshToken(), nextRefresh * 1000);
        } else {
          const errorText = await resp.text();
          console.error('❌ Token exchange failed:', resp.status, resp.statusText);
          console.error('Error details:', errorText);
          alert(`Authentication failed: ${resp.statusText}\n\nCheck console for details.`);
        }
      } catch (err) {
        console.error('❌ Authentication error:', err);
        alert(`Authentication error: ${err.message}\n\nCheck console for details.`);
        return { loggedIn: false, profileImg: null };
      }

      // Remove code from URL
      url.searchParams.delete('code');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }

  // Check if user is logged in
  if (window.sessionStorage.token) {
    try {
      const profileImg = await loadUserProfile();
      
      // Schedule token refresh if not already scheduled
      // This handles cases where the page was refreshed or reopened
      if (!refreshHandle && window.sessionStorage.refreshToken) {
        const tokenExpiry = parseInt(window.sessionStorage.tokenExpiry || '0');
        const now = Date.now();
        const timeUntilExpiry = tokenExpiry - now;
        
        // If token expires in more than 1 minute, schedule refresh 1 minute before expiry
        // Otherwise, refresh immediately
        const refreshDelay = timeUntilExpiry > 60000 ? timeUntilExpiry - 60000 : 0;
        
        console.log(`⏰ Scheduling token refresh in ${Math.round(refreshDelay / 1000)}s (restored session)`);
        refreshHandle = setTimeout(() => refreshToken(), refreshDelay);
      }
      
      return { loggedIn: true, profileImg };
    } catch (err) {
      console.error('Error loading user profile:', err);
      return { loggedIn: false, profileImg: null };
    }
  }

  return { loggedIn: false, profileImg: null };
}
