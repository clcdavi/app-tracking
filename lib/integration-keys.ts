import crypto from 'node:crypto';

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createIntegrationToken(): string {
  return `enf_live_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function hashIntegrationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const reqUrl = new URL(req.url);

    if (originUrl.origin === reqUrl.origin) return true;

    // Robust check behind reverse proxies (Nginx, Traefik, Docker NAT, Cloudflare)
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host && originUrl.host === host) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function apiReply(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

export async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await req.body?.cancel();
    return null;
  }
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
