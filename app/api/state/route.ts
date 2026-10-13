import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks, dailyBudgets } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
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
      // 1. Sync tasks
      const currentTaskRows = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.userId, user.id));

      const existingTaskIds = new Set(currentTaskRows.map((r) => r.id));
      const incomingTaskIds = new Set(data.tasks.map((t) => t.id));

      // Delete tasks that were removed
      const toDelete = currentTaskRows
        .filter((r) => !incomingTaskIds.has(r.id))
        .map((r) => r.id);

      if (toDelete.length > 0) {
        await tx.delete(tasks).where(inArray(tasks.id, toDelete));
      }

      // Upsert tasks
      for (const t of data.tasks) {
        const createdAt = t.created ? new Date(t.created) : new Date();
        const updatedAt = t.updated ? new Date(t.updated) : new Date();
        const completedAt = t.completed ? new Date(t.completed) : null;

        if (existingTaskIds.has(t.id)) {
          await tx
            .update(tasks)
            .set({
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
            })
            .where(eq(tasks.id, t.id));
        } else {
          await tx.insert(tasks).values({
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
        }
      }

      // 2. Sync daily budgets
      for (const [dateStr, minutes] of Object.entries(data.budgets)) {
        await tx
          .insert(dailyBudgets)
          .values({
            userId: user.id,
            date: dateStr,
            minutes,
          })
          .onConflictDoUpdate({
            target: [dailyBudgets.userId, dailyBudgets.date],
            set: { minutes },
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
