/**
 * Cloudflare Worker — Bungie OAuth Token Proxy
 * 
 * Diesen Worker auf Cloudflare deployen (kostenlos).
 * Er leitet die Token-Anfrage an Bungie weiter und umgeht
 * die CORS/Origin-Beschränkung des Bungie Token-Endpoints.
 * 
 * Setup:
 * 1. Gehe zu https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Klicke "Create Worker"
 * 3. Ersetze den Code mit diesem Script
 * 4. Deploy → Die Worker-URL sieht so aus: https://dein-worker.dein-account.workers.dev
 * 5. Trage die Worker-URL als VITE_BUNGIE_TOKEN_PROXY in deine .env ein
 */

const BUNGIE_TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/token/';

// Erlaubte Origins (passe an deine Domains an)
const ALLOWED_ORIGINS = [
  'https://ballaual.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      if (ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // Nur POST erlauben
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Origin prüfen
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden origin', { status: 403 });
    }

    // Request-Body durchleiten an Bungie
    const body = await request.text();

    const bungieResponse = await fetch(BUNGIE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

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
