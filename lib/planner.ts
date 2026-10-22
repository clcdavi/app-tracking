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
  todo: 'Por hacer',
  doing: 'En curso',
  waiting: 'En revisión',
  done: 'Completado',
};

const AREA_PREFIXES: Record<string, string> = {
  Personal: 'PER',
  Trabajo: 'TRA',
  Estudio: 'EST',
  Iglesia: 'IGL',
  Proyectos: 'PRO',
};

/**
 * Generates a readable Jira-style issue key (e.g., 'KAN-1', 'TRA-2' or 'TRA-104')
 * deterministically from the task's project/area and ID (or sequential order when allTasks is provided).
 */
export function taskKey(
  t: Pick<Task, 'id' | 'area' | 'project'> & { created?: string },
  allTasks?: Pick<Task, 'id' | 'created'>[]
): string {
  const rawPrefix = (t.project || t.area || 'KAN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  const prefix =
    rawPrefix.length >= 3
      ? rawPrefix.slice(0, 3)
      : AREA_PREFIXES[t.area] || 'KAN';

  if (allTasks && allTasks.length > 0) {
    const sorted = [...allTasks].sort((a, b) =>
      (a.created || '').localeCompare(b.created || '') || a.id.localeCompare(b.id)
    );
    const idx = sorted.findIndex((item) => item.id === t.id);
    if (idx !== -1) {
      return `${prefix}-${idx + 1}`;
    }
  }

  // Deterministic 2-3 digit number from task.id as fallback
  let hash = 0;
  for (let i = 0; i < t.id.length; i++) {
    hash = (hash * 31 + t.id.charCodeAt(i)) >>> 0;
  }
  const num = (hash % 900) + 100;
  return `${prefix}-${num}`;
}

export type ChecklistSummary = {
  total: number;
  done: number;
  items: { index: number; text: string; checked: boolean }[];
};

/**
 * Parses markdown checklist items (- [ ] or - [x]) from task notes.
 */
export function parseChecklist(notes: string): ChecklistSummary {
  if (!notes) return { total: 0, done: 0, items: [] };
  const lines = notes.split('\n');
  const items: { index: number; text: string; checked: boolean }[] = [];
  lines.forEach((line, idx) => {
    const m = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (m) {
      items.push({
        index: idx,
        checked: m[1].toLowerCase() === 'x',
        text: m[2].trim(),
      });
    }
  });
  return {
    total: items.length,
    done: items.filter((i) => i.checked).length,
    items,
  };
}

/**
 * Toggles a specific markdown checklist line inside task notes.
 */
export function toggleChecklistLine(notes: string, lineIndex: number): string {
  const lines = notes.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return notes;
  lines[lineIndex] = lines[lineIndex].replace(
    /^(\s*[-*]\s*\[)([ xX])(\]\s*.+)$/,
    (_, p1, state, p3) => `${p1}${state.toLowerCase() === 'x' ? ' ' : 'x'}${p3}`
  );
  return lines.join('\n');
}

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
 * Generates a valid UUID v4 string across all environments.
 * Uses crypto.randomUUID() when in secure contexts (HTTPS/Node), and
 * falls back to cryptographically random bytes / standard RFC4122 v4
 * algorithm when accessed via plain HTTP over IP addresses.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version to 4 (0100)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant to RFC4122 (10)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Factory for creating a blank new task.
 */
export function newTask(title = ''): Task {
  const n = new Date().toISOString();
  return {
    id: generateUUID(),
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
