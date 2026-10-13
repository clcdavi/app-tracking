import { database } from '@/db/raw';
import { apiReply, ensureIntegrationKeyTable, hashIntegrationToken } from '@/lib/integration-keys';
import { Task, Data } from '@/lib/planner';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const date = z.string().refine(value => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), 'Usá una fecha válida con formato AAAA-MM-DD.');
const incomingTask = z.object({
  externalId: z.string().trim().min(1).max(180).optional(),
  title: z.string().trim().min(1).max(240),
  area: z.enum(['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos']).optional(),
  project: z.string().trim().max(120).optional(),
  notes: z.string().max(10000).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  minutes: z.number().int().min(5).max(1440).optional(),
  status: z.enum(['inbox', 'todo', 'doing', 'waiting']).optional(),
  planDate: date.optional(),
  deadline: date.optional(),
  followUp: date.optional(),
});
const payloadSchema = z.object({ tasks: z.array(incomingTask).min(1).max(50) });
const reply = (data: unknown, status = 200, headers?: HeadersInit) => apiReply(data, status, headers);

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  const match = /^Bearer (enf_live_[A-Za-z0-9_-]{40,})$/.exec(authorization);
  if (!match) return reply({ error: 'Falta una clave válida en Authorization: Bearer.' }, 401, { 'WWW-Authenticate': 'Bearer' });

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 100_000) return reply({ error: 'El lote supera el máximo de 100 KB.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Revisá las tareas enviadas.' }, 400);
    const externalIds = parsed.data.tasks.flatMap(task => task.externalId ? [task.externalId] : []);
    if (new Set(externalIds).size !== externalIds.length) return reply({ error: 'No repitas externalId dentro del mismo lote.' }, 400);

    const db = database();
    await ensureIntegrationKeyTable(db);
    const key = await db.prepare('SELECT id, owner FROM integration_keys WHERE token_hash = ? AND revoked_at IS NULL').bind(await hashIntegrationToken(match[1])).first<{id:string;owner:string}>();
    if (!key) return reply({ error: 'La clave no existe o fue revocada.' }, 401, { 'WWW-Authenticate': 'Bearer' });
    await db.prepare('UPDATE integration_keys SET last_used_at = ? WHERE id = ?').bind(new Date().toISOString(), key.id).run();
    await db.prepare('INSERT OR IGNORE INTO workspaces (owner, data, version) VALUES (?, ?, 0)').bind(key.owner, JSON.stringify({ tasks: [], budgets: {} })).run();

    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await db.prepare('SELECT data, version FROM workspaces WHERE owner = ?').bind(key.owner).first<{data:string;version:number}>();
      if (!row) return reply({ error: 'No se pudo abrir el espacio de tareas.' }, 503);
      const current = JSON.parse(row.data) as Data;
      const tasks = Array.isArray(current.tasks) ? current.tasks : [];
      const now = new Date().toISOString();
      let created = 0;
      let updated = 0;

      for (const input of parsed.data.tasks) {
        const externalRef = input.externalId ? `${key.id}:${input.externalId}` : undefined;
        const previous = externalRef ? tasks.find(task => task.externalRef === externalRef) : undefined;
        if (previous) {
          const planDate = input.planDate ?? previous.planDate;
          const status = previous.status === 'done' ? 'done' : (input.status ?? previous.status);
          const changed = {
            ...previous,
            title: input.title,
            area: input.area ?? previous.area,
            project: input.project ?? previous.project,
            notes: input.notes ?? previous.notes,
            priority: input.priority ?? previous.priority,
            minutes: input.minutes ?? previous.minutes,
            status,
            planDate,
            deadline: input.deadline ?? previous.deadline,
            followUp: input.followUp ?? previous.followUp,
            top: status === 'waiting' || planDate !== previous.planDate ? false : previous.top,
            completed: status === 'done' ? previous.completed : '',
            updated: now,
          };
          tasks[tasks.indexOf(previous)] = changed;
          updated++;
          continue;
        }

        const task: Task = {
          id: crypto.randomUUID(),
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
          created: now,
          updated: now,
          completed: '',
          ...(externalRef ? { externalRef } : {}),
        };
        tasks.unshift(task);
        created++;
      }

      if (tasks.length > 2000) return reply({ error: 'El espacio admite hasta 2000 tareas.' }, 413);
      const next: Data = { tasks, budgets: current.budgets ?? {} };
      const serialized = JSON.stringify(next);
      if (new TextEncoder().encode(serialized).length > 2_000_000) return reply({ error: 'El espacio superaría el límite de 2 MB.' }, 413);
      const saved = await db.prepare('UPDATE workspaces SET data = ?, version = version + 1 WHERE owner = ? AND version = ?').bind(serialized, key.owner, row.version).run();
      if (saved.meta.changes) return reply({ created, updated, version: row.version + 1 });
    }
    return reply({ error: 'El espacio cambió al mismo tiempo. Reintentá la solicitud; externalId evita crear duplicados.' }, 409);
  } catch (error) {
    console.error('Import integration tasks', error);
    return reply({ error: 'No se pudieron importar las tareas.' }, 503);
  }
}
