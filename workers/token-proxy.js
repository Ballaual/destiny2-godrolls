/**
 * Cloudflare Worker — Bungie API Proxy
 * 
 * Leitet alle Bungie API Requests durch und entfernt den Origin-Header,
 * der von Bungie blockiert wird.
 * 
 * Unterstützt:
 * - POST /token → Token-Austausch
 * - GET /api/* → Alle Bungie Platform API Calls
 */

const BUNGIE_BASE = 'https://www.bungie.net';
const BUNGIE_TOKEN_PATH = '/Platform/App/OAuth/token/';

// Erlaubte Origins
const ALLOWED_ORIGINS = [
  'https://ballaual.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
  };
}

function isAllowed(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      if (isAllowed(origin)) {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // Origin prüfen
    if (!isAllowed(origin)) {
      return new Response('Forbidden origin', { status: 403 });
    }

    let bungieUrl;
    let bungieInit;

    if (request.method === 'POST' && url.pathname === '/token') {
      // ── Token Exchange ──────────────────────────
      const body = await request.text();
      bungieUrl = `${BUNGIE_BASE}${BUNGIE_TOKEN_PATH}`;
      bungieInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      };

    } else if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
      // ── API Proxy ───────────────────────────────
      // /api/User/GetMembershipsForCurrentUser/ → /Platform/User/GetMembershipsForCurrentUser/
      const apiPath = url.pathname.replace('/api/', '/Platform/');
      const search = url.search || '';
      bungieUrl = `${BUNGIE_BASE}${apiPath}${search}`;

      // Forward auth headers
      const headers = {};
      if (request.headers.has('X-API-Key')) {
        headers['X-API-Key'] = request.headers.get('X-API-Key');
      }
      if (request.headers.has('Authorization')) {
        headers['Authorization'] = request.headers.get('Authorization');
      }

      bungieInit = { method: 'GET', headers };

    } else {
      return new Response('Not found', { status: 404 });
    }

    // Request an Bungie senden (ohne Origin-Header!)
    const bungieResponse = await fetch(bungieUrl, bungieInit);
    const responseBody = await bungieResponse.text();

    return new Response(responseBody, {
      status: bungieResponse.status,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/json',
      },
    });
  },
};
