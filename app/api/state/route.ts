import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks, dailyBudgets } from '@/db/schema';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import type { Task, Data } from '@/lib/planner';

export const dynamic = 'force-dynamic';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateSchema = z.string().refine(
  (x) => x === '' || (dateRegex.test(x) && !Number.isNaN(Date.parse(x))),
  'Formato de fecha inválido (AAAA-MM-DD)'
);

const stampSchema = z.string().refine(
  (x) => x === '' || !Number.isNaN(Date.parse(x)),
  'Fecha y hora inválida'
);

const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, 'El título es obligatorio').max(240),
  area: z.enum(['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos']),
  project: z.string().max(120).default(''),
  notes: z.string().max(10000).default(''),
  priority: z.number().int().min(1).max(3).default(2),
  minutes: z.number().int().min(5).max(1440).default(30),
  status: z.enum(['inbox', 'todo', 'doing', 'waiting', 'done']).default('inbox'),
  planDate: dateSchema.default(''),
  deadline: dateSchema.default(''),
  followUp: dateSchema.default(''),
  top: z.boolean().default(false),
  created: stampSchema,
  updated: stampSchema,
  completed: stampSchema.default(''),
  externalRef: z.string().max(255).optional(),
});

const dataSchema = z
  .object({
    tasks: z.array(taskSchema).max(2000, 'Límite de 2000 tareas superado'),
    budgets: z.record(z.string().regex(dateRegex), z.number().int().min(0).max(1440)),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    const topsByDate: Record<string, number> = {};

    for (const t of d.tasks) {
      if (ids.has(t.id)) {
        ctx.addIssue({ code: 'custom', message: 'Hay IDs de tareas duplicados' });
      }
      ids.add(t.id);

      if (t.top) {
        if (!t.planDate || t.status === 'waiting') {
          ctx.addIssue({
            code: 'custom',
            message: 'Una prioridad Top 3 requiere fecha de plan y no puede estar en espera',
          });
        }
        topsByDate[t.planDate] = (topsByDate[t.planDate] || 0) + 1;
      }
    }

    for (const [dateKey, count] of Object.entries(topsByDate)) {
      if (count > 3) {
        ctx.addIssue({
          code: 'custom',
          message: `El día ${dateKey} tiene más de 3 prioridades seleccionadas`,
        });
      }
    }
  });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para ver tus pendientes.' }, { status: 401 });
  }

  try {
    const [userTasks, userBudgets] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.userId, user.id)),
      db.select().from(dailyBudgets).where(eq(dailyBudgets.userId, user.id)),
    ]);

    const formattedTasks: Task[] = userTasks.map((t) => ({
      id: t.id,
      title: t.title,
      area: t.area,
      project: t.project,
      notes: t.notes,
      priority: t.priority,
      minutes: t.minutes,
      status: t.status as Task['status'],
      planDate: t.planDate,
      deadline: t.deadline,
      followUp: t.followUp,
      top: t.top,
      created: t.createdAt.toISOString(),
      updated: t.updatedAt.toISOString(),
      completed: t.completedAt ? t.completedAt.toISOString() : '',
      ...(t.externalRef ? { externalRef: t.externalRef } : {}),
    }));

    const budgetsMap: Record<string, number> = {};
    for (const b of userBudgets) {
      budgetsMap[b.date] = b.minutes;
    }

    return NextResponse.json(
      {
        data: {
          tasks: formattedTasks,
          budgets: budgetsMap,
        },
        version: 1,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Error fetching state:', error);
    return NextResponse.json(
      { error: 'No pudimos cargar tus pendientes. Intentá nuevamente.' },
      { status: 503 }
    );
  }
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para guardar.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = z
      .object({
        data: dataSchema,
        version: z.number().int().optional(),
      })
      .safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || 'Datos inválidos.' },
        { status: 400 }
      );
    }

    const { data } = payload.data;

    await db.transaction(async (tx) => {
      // 1. Fetch current tasks for change detection & deletion
      const currentTasks = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id));

      const existingTaskMap = new Map(currentTasks.map((t) => [t.id, t]));
      const incomingTaskIds = new Set(data.tasks.map((t) => t.id));

      // Delete tasks that were removed
      const toDelete = currentTasks
        .filter((r) => !incomingTaskIds.has(r.id))
        .map((r) => r.id);

      if (toDelete.length > 0) {
        await tx.delete(tasks).where(inArray(tasks.id, toDelete));
      }

      // Separate into batch inserts and modified updates
      const toInsert: Array<typeof tasks.$inferInsert> = [];
      const updates: Array<{ id: string; set: Partial<typeof tasks.$inferInsert> }> = [];

      for (const t of data.tasks) {
        const createdAt = t.created ? new Date(t.created) : new Date();
        const updatedAt = t.updated ? new Date(t.updated) : new Date();
        const completedAt = t.completed ? new Date(t.completed) : null;

        const existing = existingTaskMap.get(t.id);
        if (!existing) {
          toInsert.push({
            id: t.id,
            userId: user.id,
            title: t.title,
            area: t.area,
            project: t.project,
            notes: t.notes,
            priority: t.priority,
            minutes: t.minutes,
            status: t.status,
            planDate: t.planDate,
            deadline: t.deadline,
            followUp: t.followUp,
            top: t.top,
            externalRef: t.externalRef ?? null,
            createdAt,
            updatedAt,
            completedAt,
          });
        } else {
          // Change detection: only update if task properties actually differed
          const hasChanged =
            existing.title !== t.title ||
            existing.area !== t.area ||
            existing.project !== t.project ||
            existing.notes !== t.notes ||
            existing.priority !== t.priority ||
            existing.minutes !== t.minutes ||
            existing.status !== t.status ||
            existing.planDate !== t.planDate ||
            existing.deadline !== t.deadline ||
            existing.followUp !== t.followUp ||
            existing.top !== t.top ||
            (existing.externalRef ?? null) !== (t.externalRef ?? null) ||
            (existing.completedAt ? existing.completedAt.toISOString() : '') !== (t.completed || '');

          if (hasChanged) {
            updates.push({
              id: t.id,
              set: {
                title: t.title,
                area: t.area,
                project: t.project,
                notes: t.notes,
                priority: t.priority,
                minutes: t.minutes,
                status: t.status,
                planDate: t.planDate,
                deadline: t.deadline,
                followUp: t.followUp,
                top: t.top,
                externalRef: t.externalRef ?? null,
                updatedAt,
                completedAt,
              },
            });
          }
        }
      }

      // Batch insert new tasks in a single query
      if (toInsert.length > 0) {
        await tx.insert(tasks).values(toInsert);
      }

      // Only execute updates on rows that actually changed
      for (const update of updates) {
        await tx
          .update(tasks)
          .set(update.set)
          .where(and(eq(tasks.id, update.id), eq(tasks.userId, user.id)));
      }

      // 2. Batch upsert daily budgets in a single query
      const budgetEntries = Object.entries(data.budgets);
      if (budgetEntries.length > 0) {
        const budgetValues = budgetEntries.map(([dateStr, minutes]) => ({
          userId: user.id,
          date: dateStr,
          minutes,
        }));

        await tx
          .insert(dailyBudgets)
          .values(budgetValues)
          .onConflictDoUpdate({
            target: [dailyBudgets.userId, dailyBudgets.date],
            set: { minutes: sql`excluded.minutes` },
          });
      }
    });

    return NextResponse.json(
      {
        data,
        version: (payload.data.version ?? 0) + 1,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Error saving state:', error);
    return NextResponse.json(
      { error: 'No se pudieron guardar los cambios. Intentá nuevamente.' },
      { status: 500 }
    );
  }
}
