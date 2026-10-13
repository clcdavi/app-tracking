import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { integrationKeys } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import {
  apiReply,
  createIntegrationToken,
  hashIntegrationToken,
  readLimitedBody,
  sameOrigin,
} from '@/lib/integration-keys';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiReply({ error: 'Iniciá sesión para administrar tus integraciones.' }, 401);
  }

  try {
    const list = await db
      .select({
        id: integrationKeys.id,
        name: integrationKeys.name,
        createdAt: integrationKeys.createdAt,
        lastUsedAt: integrationKeys.lastUsedAt,
      })
      .from(integrationKeys)
      .where(and(eq(integrationKeys.userId, user.id), isNull(integrationKeys.revokedAt)))
      .orderBy(desc(integrationKeys.createdAt));

    const formatted = list.map((k) => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    }));

    return apiReply({ keys: formatted });
  } catch (error) {
    console.error('List integration keys error:', error);
    return apiReply({ error: 'No se pudieron cargar las conexiones.' }, 503);
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiReply({ error: 'Iniciá sesión para crear una conexión.' }, 401);
  }

  if (!sameOrigin(req)) {
    return apiReply({ error: 'Origen no permitido.' }, 403);
  }

  try {
    const raw = await readLimitedBody(req, 2000);
    if (raw === null) {
      return apiReply({ error: 'La solicitud es demasiado grande.' }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return apiReply({ error: 'Formato inválido.' }, 400);
    }

    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(body);
    if (!parsed.success) {
      return apiReply({ error: 'El nombre debe tener entre 1 y 80 caracteres.' }, 400);
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationKeys)
      .where(and(eq(integrationKeys.userId, user.id), isNull(integrationKeys.revokedAt)));

    if (Number(countResult[0]?.count || 0) >= 10) {
      return apiReply({ error: 'Llegaste al límite de 10 conexiones activas.' }, 409);
    }

    const token = createIntegrationToken();
    const tokenHash = await hashIntegrationToken(token);

    const [newKey] = await db
      .insert(integrationKeys)
      .values({
        userId: user.id,
        name: parsed.data.name,
        tokenHash,
      })
      .returning({
        id: integrationKeys.id,
        name: integrationKeys.name,
        createdAt: integrationKeys.createdAt,
      });

    return apiReply({
      id: newKey.id,
      name: newKey.name,
      createdAt: newKey.createdAt.toISOString(),
      token,
    });
  } catch (error) {
    console.error('Create integration key error:', error);
    return apiReply({ error: 'No se pudo crear la conexión. Intentá nuevamente.' }, 503);
  }
}
