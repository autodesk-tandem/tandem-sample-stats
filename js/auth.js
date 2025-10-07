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

  window.localStorage.setItem('codeVerifier', codeVerifier);
  const url = new URL('https://developer.api.autodesk.com/authentication/v2/authorize');
    
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('client_id', clientId);
  url.searchParams.append('redirect_uri', redirect_uri);
  url.searchParams.append('scope', scope);
  url.searchParams.append('code_challenge', challenge);
  url.searchParams.append('code_challenge_method', 'S256');

  location.href = url.toString();
}

/**
 * Initiate login flow
 */
export async function login() {
  const scope = 'data:read data:write user-profile:read';
  await doRedirection(env.forgeKey, scope);
}

/**
 * Log out the user
 */
export function logout() {
  delete window.sessionStorage.token;
  delete window.sessionStorage.refreshToken;
  
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
      'client_id': env.forgeKey,
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
export async function checkLogin() {
  const url = new URL(location);

  // Handle OAuth callback
  if (url.searchParams.has('code')) {
    const code = url.searchParams.get('code');
    const codeVerifier = window.localStorage.getItem('codeVerifier');

    if (code && codeVerifier) {
      try {
        const payload = {
          'grant_type': 'authorization_code',
          'client_id': env.forgeKey,
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
          window.sessionStorage.token = token['access_token'];
          window.sessionStorage.refreshToken = token['refresh_token'];

          // Schedule token refresh
          const nextRefresh = token['expires_in'] - 60;
          refreshHandle = setTimeout(() => refreshToken(), nextRefresh * 1000);
        }
      } catch (err) {
        console.error('Authentication error:', err);
        return false;
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
      return { loggedIn: true, profileImg };
    } catch (err) {
      console.error('Error loading user profile:', err);
      return { loggedIn: false, profileImg: null };
    }
  }

  return { loggedIn: false, profileImg: null };
}
