import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { integrationKeys } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { apiReply, sameOrigin } from '@/lib/integration-keys';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return apiReply({ error: 'Iniciá sesión para revocar una conexión.' }, 401);
  }

  if (!sameOrigin(req)) {
    return apiReply({ error: 'Origen no permitido.' }, 403);
  }

  try {
    const { id } = await context.params;

    const result = await db
      .update(integrationKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(integrationKeys.id, id),
          eq(integrationKeys.userId, user.id),
          isNull(integrationKeys.revokedAt)
        )
      )
      .returning({ id: integrationKeys.id });

    if (!result.length) {
      return apiReply({ error: 'No encontramos esa conexión activa.' }, 404);
    }

    return apiReply({ revoked: true });
  } catch (error) {
    console.error('Revoke integration key error:', error);
    return apiReply({ error: 'No se pudo revocar la conexión.' }, 503);
  }
}
