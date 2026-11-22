import { db } from '@/db';
import { integrationKeys } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { apiReply, hashIntegrationToken } from '@/lib/integration-keys';

export type IntegrationAuth = { keyId: string; userId: string };

/**
 * Autentica una petición con `Authorization: Bearer enf_live_...`.
 * Devuelve los datos de la clave o una Response de error lista para retornar.
 */
export async function authenticateIntegration(req: Request): Promise<IntegrationAuth | Response> {
  const authorization = req.headers.get('authorization') ?? '';
  const match = /^Bearer (enf_live_[A-Za-z0-9_-]{40,})$/.exec(authorization);
  if (!match) {
    return apiReply({ error: 'Falta una clave válida en Authorization: Bearer.' }, 401, {
      'WWW-Authenticate': 'Bearer',
    });
  }

  const tokenHash = await hashIntegrationToken(match[1]);
  const [key] = await db
    .select({ id: integrationKeys.id, userId: integrationKeys.userId })
    .from(integrationKeys)
    .where(and(eq(integrationKeys.tokenHash, tokenHash), isNull(integrationKeys.revokedAt)))
    .limit(1);

  if (!key) {
    return apiReply({ error: 'La clave no existe o fue revocada.' }, 401, {
      'WWW-Authenticate': 'Bearer',
    });
  }

  await db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, key.id));
  return { keyId: key.id, userId: key.userId };
}

/** Quita el prefijo `<keyId>:` del externalRef para exponer solo el externalId. */
export function publicExternalId(externalRef: string | null): string | null {
  if (!externalRef) return null;
  const i = externalRef.indexOf(':');
  return i >= 0 ? externalRef.slice(i + 1) : externalRef;
}
