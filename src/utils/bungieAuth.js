/**
 * Bungie OAuth2 PKCE Authentication Utility
 * 
 * Handles the complete OAuth2 authorization code flow with PKCE
 * for client-side (GitHub Pages) applications.
 * 
 * Tokens are stored in sessionStorage and cleared when the browser closes.
 */

const BUNGIE_AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const BUNGIE_TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/token/';
const BUNGIE_API_BASE = 'https://www.bungie.net/Platform';

const CLIENT_ID = import.meta.env.VITE_BUNGIE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_BUNGIE_API_KEY;

// ── PKCE Helpers ──────────────────────────────────────────────

function generateRandomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, '0')).join('').substring(0, length);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCE() {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);
  return { codeVerifier, codeChallenge };
}

// ── Login Flow ────────────────────────────────────────────────

export async function startLogin() {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = generateRandomString(32);

  // Store PKCE verifier and state for later validation
  sessionStorage.setItem('bungie_code_verifier', codeVerifier);
  sessionStorage.setItem('bungie_auth_state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Redirect to Bungie authorization
  window.location.href = `${BUNGIE_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(code, state) {
  // Validate state to prevent CSRF
  const savedState = sessionStorage.getItem('bungie_auth_state');
  if (state && savedState && state !== savedState) {
    throw new Error('Invalid state parameter — possible CSRF attack');
  }

  const codeVerifier = sessionStorage.getItem('bungie_code_verifier');
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier — please login again');
  }

  // Exchange authorization code for tokens
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const response = await fetch(BUNGIE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': API_KEY,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${errorText}`);
  }

  const tokenData = await response.json();

  // Store token data
  sessionStorage.setItem('bungie_access_token', tokenData.access_token);
  sessionStorage.setItem('bungie_token_expiry', String(Date.now() + tokenData.expires_in * 1000));
  sessionStorage.setItem('bungie_membership_id', tokenData.membership_id);

  if (tokenData.refresh_token) {
    sessionStorage.setItem('bungie_refresh_token', tokenData.refresh_token);
    sessionStorage.setItem('bungie_refresh_expiry', String(Date.now() + tokenData.refresh_expires_in * 1000));
  }

  // Clean up PKCE artifacts
  sessionStorage.removeItem('bungie_code_verifier');
  sessionStorage.removeItem('bungie_auth_state');

  return tokenData;
}

// ── Token Management ──────────────────────────────────────────

export function getAccessToken() {
  const token = sessionStorage.getItem('bungie_access_token');
  const expiry = sessionStorage.getItem('bungie_token_expiry');

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
  return sessionStorage.getItem('bungie_membership_id');
}

export function logout() {
  sessionStorage.removeItem('bungie_access_token');
  sessionStorage.removeItem('bungie_token_expiry');
  sessionStorage.removeItem('bungie_membership_id');
  sessionStorage.removeItem('bungie_refresh_token');
  sessionStorage.removeItem('bungie_refresh_expiry');
  sessionStorage.removeItem('bungie_code_verifier');
  sessionStorage.removeItem('bungie_auth_state');
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
    throw new Error(`Bungie API request failed: ${response.status}`);
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
