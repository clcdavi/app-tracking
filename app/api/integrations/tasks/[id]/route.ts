import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiReply, readLimitedBody } from '@/lib/integration-keys';
import { authenticateIntegration, publicExternalId } from '@/lib/integration-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const dateSchema = z.string().refine(
  (v) =>
    v === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v),
  'Usá una fecha válida con formato AAAA-MM-DD (o vacío para quitarla).'
);

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    area: z.enum(['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos']),
    project: z.string().trim().max(120),
    notes: z.string().max(10000),
    priority: z.number().int().min(1).max(3),
    minutes: z.number().int().min(5).max(1440),
    status: z.enum(['inbox', 'todo', 'doing', 'waiting', 'done']),
    planDate: dateSchema,
    deadline: dateSchema,
    followUp: dateSchema,
    top: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Enviá al menos un campo para actualizar.');

const idSchema = z.string().uuid('El id de la tarea no es válido.');

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const auth = await authenticateIntegration(req);
  if (auth instanceof Response) return auth;

  try {
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiReply({ error: id.error.issues[0].message }, 400);

    const raw = await readLimitedBody(req, 50_000);
    if (raw === null) return apiReply({ error: 'El cuerpo supera el máximo de 50 KB.' }, 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return apiReply({ error: 'El cuerpo debe ser JSON válido.' }, 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiReply({ error: parsed.error.issues[0]?.message ?? 'Revisá los campos enviados.' }, 400);
    }

    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id.data), eq(tasks.userId, auth.userId)))
      .limit(1);
    if (!existing) return apiReply({ error: 'No encontramos esa tarea.' }, 404);

    const input = parsed.data;
    const status = input.status ?? existing.status;
    const planDate = input.planDate ?? existing.planDate;
    const now = new Date();

    const [updated] = await db
      .update(tasks)
      .set({
        ...input,
        status,
        top:
          status === 'waiting' || status === 'done' || planDate !== existing.planDate
            ? (input.top ?? false)
            : (input.top ?? existing.top),
        completedAt: status === 'done' ? (existing.completedAt ?? now) : null,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, id.data), eq(tasks.userId, auth.userId)))
      .returning();

    return apiReply({ task: { ...updated, externalId: publicExternalId(updated.externalRef) } });
  } catch (error) {
    console.error('Integration task patch error:', error);
    return apiReply({ error: 'No se pudo actualizar la tarea.' }, 503);
  }
}

export async function DELETE(req: Request, context: Ctx) {
  const auth = await authenticateIntegration(req);
  if (auth instanceof Response) return auth;

  try {
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return apiReply({ error: id.error.issues[0].message }, 400);

    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id.data), eq(tasks.userId, auth.userId)))
      .returning({ id: tasks.id, title: tasks.title });

    if (!deleted.length) return apiReply({ error: 'No encontramos esa tarea.' }, 404);
    return apiReply({ deleted: deleted[0] });
  } catch (error) {
    console.error('Integration task delete error:', error);
    return apiReply({ error: 'No se pudo borrar la tarea.' }, 503);
  }
}
