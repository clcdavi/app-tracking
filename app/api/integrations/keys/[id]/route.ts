import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/raw';
import { apiReply, ensureIntegrationKeyTable, sameOrigin } from '@/lib/integration-keys';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, context: { params: Promise<{id:string}> }) {
  const user = await getChatGPTUser();
  if (!user) return apiReply({ error: 'Iniciá sesión para revocar una conexión.' }, 401);
  if (!sameOrigin(req)) return apiReply({ error: 'Origen no permitido.' }, 403);
  try {
    const { id } = await context.params;
    const db = database();
    await ensureIntegrationKeyTable(db);
    const result = await db.prepare('UPDATE integration_keys SET revoked_at = ? WHERE id = ? AND owner = ? AND revoked_at IS NULL').bind(new Date().toISOString(), id, user.userId).run();
    if (!result.meta.changes) return apiReply({ error: 'No encontramos esa conexión activa.' }, 404);
    return apiReply({ revoked: true });
  } catch (error) {
    console.error('Revoke integration key', error);
    return apiReply({ error: 'No se pudo revocar la conexión.' }, 503);
  }
}
