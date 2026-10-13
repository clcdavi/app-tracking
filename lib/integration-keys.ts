export async function ensureIntegrationKeyTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS integration_keys (
    id TEXT PRIMARY KEY NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
  )`).run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS integration_keys_token_hash_unique ON integration_keys (token_hash)').run();
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createIntegrationToken() {
  return `enf_live_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function hashIntegrationToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export function apiReply(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
