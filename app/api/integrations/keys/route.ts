import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/raw';
import { apiReply, createIntegrationToken, ensureIntegrationKeyTable, hashIntegrationToken, sameOrigin } from '@/lib/integration-keys';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return apiReply({ error: 'Iniciá sesión para administrar tus integraciones.' }, 401);
  try {
    const db = database();
    await ensureIntegrationKeyTable(db);
    const result = await db.prepare('SELECT id, name, created_at AS createdAt, last_used_at AS lastUsedAt FROM integration_keys WHERE owner = ? AND revoked_at IS NULL ORDER BY created_at DESC').bind(user.userId).all<{id:string;name:string;createdAt:string;lastUsedAt:string|null}>();
    return apiReply({ keys: result.results ?? [] });
  } catch (error) {
    console.error('List integration keys', error);
    return apiReply({ error: 'No se pudieron cargar las conexiones.' }, 503);
  }
}

export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return apiReply({ error: 'Iniciá sesión para crear una conexión.' }, 401);
  if (!sameOrigin(req)) return apiReply({ error: 'Origen no permitido.' }, 403);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 2000) return apiReply({ error: 'La solicitud es demasiado grande.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return apiReply({ error: 'Formato inválido.' }, 400); }
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(body);
    if (!parsed.success) return apiReply({ error: 'El nombre debe tener entre 1 y 80 caracteres.' }, 400);

    const db = database();
    await ensureIntegrationKeyTable(db);
    const count = await db.prepare('SELECT COUNT(*) AS total FROM integration_keys WHERE owner = ? AND revoked_at IS NULL').bind(user.userId).first<{total:number}>();
    if ((count?.total ?? 0) >= 10) return apiReply({ error: 'Llegaste al límite de 10 conexiones activas.' }, 409);

    const token = createIntegrationToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.prepare('INSERT INTO integration_keys (id, owner, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, user.userId, parsed.data.name, await hashIntegrationToken(token), createdAt).run();
    return apiReply({ id, name: parsed.data.name, createdAt, token });
  } catch (error) {
    console.error('Create integration key', error);
    return apiReply({ error: 'No se pudo crear la conexión. Intentá nuevamente.' }, 503);
  }
}
