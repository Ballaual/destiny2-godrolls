/**
 * Bungie OAuth2 Authentication Utility
 * 
 * Handles the OAuth2 authorization code flow for public clients
 * on GitHub Pages (no client_secret needed).
 * 
 * Tokens are stored in localStorage and persist across browser sessions.
 * Use logout() to clear them.
 */

const BUNGIE_AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const PROXY_BASE = import.meta.env.VITE_BUNGIE_TOKEN_PROXY;

// Direct Bungie URLs (fallback if no proxy)
const BUNGIE_API_BASE_DIRECT = 'https://www.bungie.net/Platform';

const CLIENT_ID = import.meta.env.VITE_BUNGIE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_BUNGIE_API_KEY;

// Route through proxy to bypass Bungie's Origin header restrictions
const BUNGIE_TOKEN_URL = PROXY_BASE ? `${PROXY_BASE}/token` : 'https://www.bungie.net/Platform/App/OAuth/token/';
const BUNGIE_API_BASE = PROXY_BASE ? `${PROXY_BASE}/api` : BUNGIE_API_BASE_DIRECT;

// ── Helpers ───────────────────────────────────────────────────

function generateRandomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, '0')).join('').substring(0, length);
}

// ── Login Flow ────────────────────────────────────────────────

export async function startLogin() {
  const state = generateRandomString(32);

  // Store state for CSRF validation — use localStorage so it survives redirects
  localStorage.setItem('bungie_auth_state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: state,
  });

  // Redirect to Bungie authorization
  window.location.href = `${BUNGIE_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(code, state) {
  // Validate state to prevent CSRF
  const savedState = localStorage.getItem('bungie_auth_state');
  if (savedState && state !== savedState) {
    throw new Error('Invalid state parameter — possible CSRF attack');
  }

  // Exchange authorization code for tokens (public client — no secret needed)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: CLIENT_ID,
  });

  const response = await fetch(BUNGIE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  console.log('[Auth] Token exchange status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${errorText}`);
  }

  const tokenData = await response.json();

  // Store token data in localStorage
  localStorage.setItem('bungie_access_token', tokenData.access_token);
  localStorage.setItem('bungie_token_expiry', String(Date.now() + tokenData.expires_in * 1000));
  localStorage.setItem('bungie_membership_id', tokenData.membership_id);

  if (tokenData.refresh_token) {
    localStorage.setItem('bungie_refresh_token', tokenData.refresh_token);
    localStorage.setItem('bungie_refresh_expiry', String(Date.now() + tokenData.refresh_expires_in * 1000));
  }

  // Clean up auth state
  localStorage.removeItem('bungie_auth_state');

  return tokenData;
}

// ── Token Management ──────────────────────────────────────────

export function getAccessToken() {
  const token = localStorage.getItem('bungie_access_token');
  const expiry = localStorage.getItem('bungie_token_expiry');

  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    // Token expired
    logout();
    return null;
  }

  return token;
}

export function isLoggedIn() {
  return getAccessToken() !== null;
}

export function getBungieMembershipId() {
  return localStorage.getItem('bungie_membership_id');
}

export function logout() {
  localStorage.removeItem('bungie_access_token');
  localStorage.removeItem('bungie_token_expiry');
  localStorage.removeItem('bungie_membership_id');
  localStorage.removeItem('bungie_refresh_token');
  localStorage.removeItem('bungie_refresh_expiry');
  localStorage.removeItem('bungie_auth_state');
}

// ── Authenticated API Requests ────────────────────────────────

export async function bungieApiRequest(path) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BUNGIE_API_BASE}${path}`, {
    headers: {
      'X-API-Key': API_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Bungie API ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  if (data.ErrorCode && data.ErrorCode !== 1) {
    throw new Error(`Bungie API error: ${data.ErrorStatus} — ${data.Message}`);
  }

  return data.Response;
}

// ── Profile Data Fetching ─────────────────────────────────────

export async function getCurrentUser() {
  return bungieApiRequest('/User/GetMembershipsForCurrentUser/');
}

export async function getDestinyProfile(membershipType, membershipId) {
  // Components: 100=Profiles, 200=Characters
  return bungieApiRequest(
    `/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200`
  );
}

export async function getFullProfileData() {
  const userData = await getCurrentUser();

  if (!userData || !userData.destinyMemberships || userData.destinyMemberships.length === 0) {
    return { bungieNetUser: userData?.bungieNetUser, memberships: [], characters: [] };
  }

  // Fetch character data for each membership
  const characterPromises = userData.destinyMemberships.map(async (membership) => {
    try {
      const profileData = await getDestinyProfile(
        membership.membershipType,
        membership.membershipId
      );
      return {
        membership,
        characters: profileData?.characters?.data || {},
        profile: profileData?.profile?.data || {},
      };
    } catch {
      return { membership, characters: {}, profile: {} };
    }
  });

  const profiles = await Promise.all(characterPromises);

  return {
    bungieNetUser: userData.bungieNetUser,
    memberships: userData.destinyMemberships,
    profiles,
  };
}
