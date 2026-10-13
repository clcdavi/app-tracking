import { db } from '@/db';
import { integrationKeys, tasks } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  apiReply,
  hashIntegrationToken,
  readLimitedBody,
} from '@/lib/integration-keys';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const dateSchema = z.string().refine(
  (value) =>
    value === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value),
  'Usá una fecha válida con formato AAAA-MM-DD.'
);

const incomingTask = z.object({
  externalId: z.string().trim().min(1).max(180).optional(),
  title: z.string().trim().min(1, 'El título es obligatorio.').max(240),
  area: z.enum(['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos']).optional(),
  project: z.string().trim().max(120).optional(),
  notes: z.string().max(10000).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  minutes: z.number().int().min(5).max(1440).optional(),
  status: z.enum(['inbox', 'todo', 'doing', 'waiting']).optional(),
  planDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  followUp: dateSchema.optional(),
});

const payloadSchema = z.object({
  tasks: z.array(incomingTask).min(1, 'Incluí al menos una tarea.').max(50, 'Máximo 50 tareas por lote.'),
});

const reply = (data: unknown, status = 200, headers?: HeadersInit) =>
  apiReply(data, status, headers);

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  const match = /^Bearer (enf_live_[A-Za-z0-9_-]{40,})$/.exec(authorization);
  if (!match) {
    return reply(
      { error: 'Falta una clave válida en Authorization: Bearer.' },
      401,
      { 'WWW-Authenticate': 'Bearer' }
    );
  }

  try {
    const raw = await readLimitedBody(req, 100_000);
    if (raw === null) {
      return reply({ error: 'El lote supera el máximo de 100 KB.' }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return reply(
        { error: parsed.error.issues[0]?.message ?? 'Revisá las tareas enviadas.' },
        400
      );
    }

    const externalIds = parsed.data.tasks.flatMap((t) => (t.externalId ? [t.externalId] : []));
    if (new Set(externalIds).size !== externalIds.length) {
      return reply({ error: 'No repitas externalId dentro del mismo lote.' }, 400);
    }

    const tokenHash = await hashIntegrationToken(match[1]);
    const keyRecord = await db
      .select({
        id: integrationKeys.id,
        userId: integrationKeys.userId,
      })
      .from(integrationKeys)
      .where(and(eq(integrationKeys.tokenHash, tokenHash), isNull(integrationKeys.revokedAt)))
      .limit(1);

    if (!keyRecord.length) {
      return reply(
        { error: 'La clave no existe o fue revocada.' },
        401,
        { 'WWW-Authenticate': 'Bearer' }
      );
    }

    const key = keyRecord[0];

    // Update last used timestamp
    await db
      .update(integrationKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(integrationKeys.id, key.id));

    // Check user task limit
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.userId, key.userId));

    if (Number(totalCount[0]?.count || 0) + parsed.data.tasks.length > 2000) {
      return reply({ error: 'El espacio admite hasta 2000 tareas en total.' }, 413);
    }

    let created = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      const now = new Date();

      for (const input of parsed.data.tasks) {
        const externalRef = input.externalId ? `${key.id}:${input.externalId}` : null;

        if (externalRef) {
          const [existing] = await tx
            .select()
            .from(tasks)
            .where(and(eq(tasks.userId, key.userId), eq(tasks.externalRef, externalRef)))
            .limit(1);

          if (existing) {
            const planDate = input.planDate ?? existing.planDate;
            const status = existing.status === 'done' ? 'done' : (input.status ?? existing.status);

            await tx
              .update(tasks)
              .set({
                title: input.title,
                area: input.area ?? existing.area,
                project: input.project ?? existing.project,
                notes: input.notes ?? existing.notes,
                priority: input.priority ?? existing.priority,
                minutes: input.minutes ?? existing.minutes,
                status,
                planDate,
                deadline: input.deadline ?? existing.deadline,
                followUp: input.followUp ?? existing.followUp,
                top: status === 'waiting' || planDate !== existing.planDate ? false : existing.top,
                updatedAt: now,
              })
              .where(eq(tasks.id, existing.id));

            updated++;
            continue;
          }
        }

        // Insert new task
        await tx.insert(tasks).values({
          userId: key.userId,
          title: input.title,
          area: input.area ?? 'Personal',
          project: input.project ?? '',
          notes: input.notes ?? '',
          priority: input.priority ?? 2,
          minutes: input.minutes ?? 30,
          status: input.status ?? 'inbox',
          planDate: input.planDate ?? '',
          deadline: input.deadline ?? '',
          followUp: input.followUp ?? '',
          top: false,
          externalRef,
          createdAt: now,
          updatedAt: now,
        });

        created++;
      }
    });

    return reply({ created, updated });
  } catch (error) {
    console.error('Import integration tasks error:', error);
    return reply({ error: 'No se pudieron importar las tareas.' }, 503);
  }
}
