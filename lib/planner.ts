export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'waiting' | 'done';

export type Task = {
  id: string;
  title: string;
  area: string;
  project: string;
  notes: string;
  priority: number;
  minutes: number;
  status: TaskStatus;
  planDate: string;
  deadline: string;
  followUp: string;
  top: boolean;
  updated: string;
  created: string;
  completed: string;
  externalRef?: string;
};

export type Data = {
  tasks: Task[];
  budgets: Record<string, number>;
};

export const areas = ['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos'] as const;

export const states: Record<TaskStatus, string> = {
  inbox: 'Sin organizar',
  todo: 'Pendiente',
  doing: 'En curso',
  waiting: 'Esperando',
  done: 'Completada',
};

/**
 * Returns today's date string (YYYY-MM-DD) in the Buenos Aires timezone.
 */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Adds N days to a date string (YYYY-MM-DD) safely using UTC arithmetic.
 */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats a date string (YYYY-MM-DD) to a human-friendly Spanish label (e.g., '14 oct').
 */
export function dayLabel(date: string): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Determines whether a task needs user attention today.
 */
export function attention(t: Task, d: string): boolean {
  return (
    t.status !== 'done' &&
    ((Boolean(t.deadline) && t.deadline < d) ||
      (Boolean(t.followUp) && t.followUp <= d) ||
      (Boolean(t.planDate) && t.planDate < d))
  );
}

/**
 * Returns an explanatory reason for why a task is suggested or highlighted.
 */
export function reason(t: Task, d: string): string {
  if (t.deadline && t.deadline < d) return 'Vencimiento pendiente';
  if (t.deadline === d) return 'Vence hoy';
  if (t.status === 'doing') return 'Ya la empezaste';
  if (t.priority === 3) return 'Prioridad alta';
  if (t.deadline && t.deadline <= addDays(d, 3)) return 'Vence pronto';
  return t.minutes <= 30 ? 'Cabe en un bloque corto' : 'Avance en tus pendientes';
}

/**
 * Calculates priority score for daily planning suggestions.
 */
export function score(t: Task, d: string): number {
  const deadlineScore =
    t.deadline && t.deadline < d
      ? 1000
      : t.deadline === d
        ? 800
        : t.deadline && t.deadline <= addDays(d, 3)
          ? 400
          : 0;
  const doingScore = t.status === 'doing' ? 200 : 0;
  const priorityScore = t.priority * 60;
  const planScore = t.planDate && t.planDate <= d ? 40 : 0;

  return deadlineScore + doingScore + priorityScore + planScore;
}

/**
 * Generates task suggestions for the day based on remaining capacity and available slots.
 */
export function suggestions(tasks: Task[], date: string, budget: number): Task[] {
  const planned = tasks.filter((t) => t.planDate === date && t.status !== 'waiting');
  let left = Math.max(0, budget - planned.reduce((s, t) => s + t.minutes, 0));
  let slots = Math.max(0, 3 - tasks.filter((t) => t.planDate === date && t.top).length);

  const chosen: Task[] = [];
  const candidates = tasks
    .filter(
      (t) =>
        t.status !== 'done' &&
        t.status !== 'waiting' &&
        !(t.top && t.planDate === date) &&
        (!t.planDate || t.planDate <= date)
    )
    .sort((a, b) => score(b, date) - score(a, date) || a.created.localeCompare(b.created));

  for (const t of candidates) {
    const cost = t.planDate === date ? 0 : t.minutes;
    if (slots && cost <= left) {
      chosen.push(t);
      left -= cost;
      slots--;
    }
  }

  return chosen;
}

/**
 * Factory for creating a blank new task.
 */
export function newTask(title = ''): Task {
  const n = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    area: 'Personal',
    project: '',
    notes: '',
    priority: 2,
    minutes: 30,
    status: 'inbox',
    planDate: '',
    deadline: '',
    followUp: '',
    top: false,
    created: n,
    updated: n,
    completed: '',
  };
}
