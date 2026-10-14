import type { Task } from './planner';

export interface ParsedTelegramTask {
  title: string;
  area: Task['area'];
  priority: 1 | 2 | 3;
  minutes: number;
  planDate: string;
  status: Task['status'];
  notes: string;
}

const AREA_MAP: Record<string, Task['area']> = {
  trabajo: 'Trabajo',
  work: 'Trabajo',
  personal: 'Personal',
  estudio: 'Estudio',
  estudios: 'Estudio',
  study: 'Estudio',
  iglesia: 'Iglesia',
  church: 'Iglesia',
  proyecto: 'Proyectos',
  proyectos: 'Proyectos',
  projects: 'Proyectos',
};

const PRIORITY_MAP: Record<string, 1 | 2 | 3> = {
  alta: 3,
  alto: 3,
  urgente: 3,
  p3: 3,
  '3': 3,
  media: 2,
  medio: 2,
  normal: 2,
  p2: 2,
  '2': 2,
  baja: 1,
  bajo: 1,
  p1: 1,
  '1': 1,
};

export function parseTelegramTask(rawText: string, referenceDate?: string): ParsedTelegramTask {
  let text = rawText.trim();

  // 1. Detect area: #area
  let area: Task['area'] = 'Personal';
  const areaMatch = text.match(/(?:^|\s)#([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
  if (areaMatch) {
    const rawTag = areaMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (AREA_MAP[rawTag]) {
      area = AREA_MAP[rawTag];
      text = text.replace(areaMatch[0], ' ');
    }
  }

  // 2. Detect priority: !alta, !media, !baja, !1, !2, !3
  let priority: 1 | 2 | 3 = 2;
  const prioMatch = text.match(/(?:^|\s)!([a-zA-Z0-9]+)/i);
  if (prioMatch) {
    const rawPrio = prioMatch[1].toLowerCase();
    if (PRIORITY_MAP[rawPrio]) {
      priority = PRIORITY_MAP[rawPrio];
      text = text.replace(prioMatch[0], ' ');
    }
  }

  // 3. Detect duration: 15m, 30m, 45m, 1h, 2h, 1h30m, 90min
  let minutes = 30;
  const compDurationMatch = text.match(/(?:^|\s)(\d+)\s*h(?:oras?)?\s*(\d+)?\s*m?(?:in(?:utos?)?)?(?:\s|$)/i);
  if (compDurationMatch && compDurationMatch[2]) {
    const hours = parseInt(compDurationMatch[1], 10) || 0;
    const mins = parseInt(compDurationMatch[2], 10) || 0;
    minutes = Math.max(5, Math.min(1440, hours * 60 + mins));
    text = text.replace(compDurationMatch[0], ' ');
  } else {
    const simpleDurationMatch = text.match(/(?:^|\s)(\d+)\s*(m(?:in(?:utos?)?)?|h(?:oras?)?)(?:\s|$)/i);
    if (simpleDurationMatch) {
      const val = parseInt(simpleDurationMatch[1], 10);
      const unit = simpleDurationMatch[2].toLowerCase();
      if (unit.startsWith('h')) {
        minutes = Math.max(5, Math.min(1440, val * 60));
      } else {
        minutes = Math.max(5, Math.min(1440, val));
      }
      text = text.replace(simpleDurationMatch[0], ' ');
    }
  }

  // 4. Detect planDate: hoy, mañana, manana, YYYY-MM-DD
  const now = new Date();
  const argentinaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = referenceDate || argentinaFormatter.format(now);

  let planDate = '';
  // Check explicit date YYYY-MM-DD
  const dateRegexMatch = text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  if (dateRegexMatch) {
    planDate = dateRegexMatch[1];
    text = text.replace(dateRegexMatch[0], ' ');
  } else {
    // Check keywords: hoy, manana, mañana
    const todayMatch = text.match(/(?:^|\b)(hoy)(?:\b|$)/i);
    if (todayMatch) {
      planDate = todayStr;
      text = text.replace(todayMatch[0], ' ');
    } else {
      const tomorrowMatch = text.match(/(?:^|\b)(mañana|manana)(?:\b|$)/i);
      if (tomorrowMatch) {
        const [y, m, d] = todayStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + 1));
        planDate = dt.toISOString().slice(0, 10);
        text = text.replace(tomorrowMatch[0], ' ');
      }
    }
  }

  // 5. Clean Title
  const cleanTitle = text.replace(/\s+/g, ' ').trim();
  const title = (cleanTitle || rawText.trim()).slice(0, 240);

  return {
    title,
    area,
    priority,
    minutes,
    planDate,
    status: planDate ? 'todo' : 'inbox',
    notes: '',
  };
}
