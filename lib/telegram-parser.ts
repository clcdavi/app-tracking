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

export type TelegramIntent =
  | { type: 'query_today' }
  | { type: 'query_inbox' }
  | { type: 'complete_last' }
  | { type: 'delete_last' }
  | { type: 'greeting' }
  | { type: 'thanks' }
  | { type: 'help' }
  | {
      type: 'update_last';
      updates: {
        area?: Task['area'];
        planDate?: string;
        status?: Task['status'];
        priority?: 1 | 2 | 3;
        minutes?: number;
      };
      explanation: string;
    }
  | {
      type: 'create';
      task: ParsedTelegramTask;
    };

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

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTelegramTask(rawText: string, referenceDate?: string): ParsedTelegramTask {
  let text = rawText.trim();

  // 1. Detect area: explicit hashtag #area OR natural language "en (el área de) X"
  let area: Task['area'] = 'Personal';
  const areaTagMatch = text.match(/(?:^|\s)#([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
  if (areaTagMatch) {
    const rawTag = normalizeString(areaTagMatch[1]);
    if (AREA_MAP[rawTag]) {
      area = AREA_MAP[rawTag];
      text = text.replace(areaTagMatch[0], ' ');
    }
  } else {
    const naturalAreaMatch = text.match(/(?:^|\s)(?:en|al?|para)\s+(?:el\s*área\s*de\s*|el\s*area\s*de\s*|área\s*|area\s*)?(proyectos?|trabajo|personal|estudios?|iglesia)(?:\s|$)/i);
    if (naturalAreaMatch) {
      const rawTag = normalizeString(naturalAreaMatch[1]);
      if (AREA_MAP[rawTag]) {
        area = AREA_MAP[rawTag];
        text = text.replace(naturalAreaMatch[0], ' ');
      }
    }
  }

  // 2. Detect priority: !alta OR natural "prioridad alta" / "urgente"
  let priority: 1 | 2 | 3 = 2;
  const prioMatch = text.match(/(?:^|\s)!([a-zA-Z0-9]+)/i);
  if (prioMatch) {
    const rawPrio = prioMatch[1].toLowerCase();
    if (PRIORITY_MAP[rawPrio]) {
      priority = PRIORITY_MAP[rawPrio];
      text = text.replace(prioMatch[0], ' ');
    }
  } else {
    const naturalPrioMatch = text.match(/(?:^|\s)(?:prioridad\s+|es\s+)?(urgente|alta|medio|media|normal|baja)(?:\s|$)/i);
    if (naturalPrioMatch) {
      const rawPrio = normalizeString(naturalPrioMatch[1]);
      if (PRIORITY_MAP[rawPrio]) {
        priority = PRIORITY_MAP[rawPrio];
        text = text.replace(naturalPrioMatch[0], ' ');
      }
    }
  }

  // 3. Detect duration: 15m, 30m, 45m, 1h, 2h, 1h30m, 90min, "por 45 minutos"
  let minutes = 30;
  const compDurationMatch = text.match(/(?:^|\s)(\d+)\s*h(?:oras?)?\s*(\d+)?\s*m?(?:in(?:utos?)?)?(?:\s|$)/i);
  if (compDurationMatch && compDurationMatch[2]) {
    const hours = parseInt(compDurationMatch[1], 10) || 0;
    const mins = parseInt(compDurationMatch[2], 10) || 0;
    minutes = Math.max(5, Math.min(1440, hours * 60 + mins));
    text = text.replace(compDurationMatch[0], ' ');
  } else {
    const simpleDurationMatch = text.match(/(?:^|\s)(?:por\s+|durante\s+|duración\s+)?(\d+)\s*(m(?:in(?:utos?)?)?|h(?:oras?)?)(?:\s|$)/i);
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
    // Check keywords: hoy, manana, mañana (with optional "para")
    const todayMatch = text.match(/(?:^|\s)(?:para\s+)?(hoy)(?:\s|$)/i);
    if (todayMatch) {
      planDate = todayStr;
      text = text.replace(todayMatch[0], ' ');
    } else {
      const tomorrowMatch = text.match(/(?:^|\s)(?:para\s+)?(mañana|manana)(?:\s|$)/i);
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

export function detectTelegramIntent(rawText: string, referenceDate?: string): TelegramIntent {
  const norm = normalizeString(rawText);

  const now = new Date();
  const argentinaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = referenceDate || argentinaFormatter.format(now);
  const [y, m, d] = todayStr.split('-').map(Number);
  const tomorrowStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  // 0a. Greetings: "hola", "buen día", "buenas tardes", "buenas noches", "hey", "hola bot", etc.
  if (/^(?:hola|buenas|buen\s+dia|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|que\s+tal|hola\s+bot)(?:\s+como\s+estas|\s+que\s+tal)?$/i.test(norm)) {
    return { type: 'greeting' };
  }

  // 0b. Thanks: "gracias", "muchas gracias", "joya", "genial", "excelente", "perfecto"
  if (/^(?:gracias|muchas\s+gracias|muchisimas\s+gracias|joya|genial|excelente|perfecto|buenisimo|de\s+diez|ok\s+gracias)$/i.test(norm)) {
    return { type: 'thanks' };
  }

  // 0c. Help: "ayuda", "como funciona", "que podes hacer", "comandos"
  if (/^(?:ayuda|help|como\s+funciona|que\s+podes\s+hacer|que\s+haces|comandos|menu)$/i.test(norm)) {
    return { type: 'help' };
  }

  // 1. Query today: "¿qué tengo para hoy?", "mis tareas de hoy", "ver hoy", "plan de hoy"
  if (
    /^(?:que|que\s+es\s+lo\s+que|mostrar|ver|cual\s+es|cuales\s+son|como\s+viene)?\s*(?:tengo|hay|mis\s+tareas|el\s+plan|mi\s+dia|tareas)?\s*(?:para\s+hoy|hoy|de\s+hoy)$/i.test(norm) ||
    /^(?:cuales\s+son\s+mis\s+tareas|que\s+tengo\s+que\s+hacer(\s+hoy)?|ver\s+mis\s+tareas|mis\s+tareas)$/i.test(norm) ||
    /^(?:mis\s+)?tareas(\s+de\s+hoy)?$/i.test(norm) ||
    /^(?:que\s+tengo\s+hoy|que\s+hay\s+hoy|ver\s+hoy|plan\s+de\s+hoy|agenda\s+de\s+hoy|resumen\s+de\s+hoy)$/i.test(norm)
  ) {
    return { type: 'query_today' };
  }

  // 2. Query inbox: "¿qué tengo pendiente?", "¿qué hay en la bandeja?", "bandeja de entrada", "inbox", "pendientes"
  if (
    /^(?:que\s+(?:tengo|hay)\s+)?(?:en\s+la\s+)?(bandeja|bandeja\s+de\s+entrada|inbox|pendientes?)$/i.test(norm) ||
    /^(?:mostrar|ver|listar)\s+(?:la\s+)?(bandeja|bandeja\s+de\s+entrada|inbox|pendientes?)$/i.test(norm) ||
    /^(?:mis\s+)?(bandeja|inbox|pendientes?)$/i.test(norm) ||
    /^(?:que\s+tengo\s+pendiente|que\s+hay\s+pendiente|tareas\s+pendientes)$/i.test(norm)
  ) {
    return { type: 'query_inbox' };
  }

  // 3. Complete last: "listo", "completalo", "ya lo hice", "hecho", "terminado"
  if (/^(?:listo|completalo|completala|completar|ya\s+lo\s+hice|ya\s+termine|hecho|terminado)$/i.test(norm)) {
    return { type: 'complete_last' };
  }

  // 4. Delete last: "borralo", "eliminalo", "cancelalo", "descartalo"
  if (/^(?:borralo|borrala|borrar|eliminalo|eliminala|eliminar|cancelalo|cancelar|descartalo)$/i.test(norm)) {
    return { type: 'delete_last' };
  }

  // 5. Update last task area: "guardalo en el area de proyectos", "pasalo a mis proyectos", "en proyectos", "proyectos", etc.
  const areaUpdateMatch = norm.match(
    /^(?:guardalo|guardala|ponelo|ponela|pasalo|pasala|cambialo|cambiala|cambia|cambie|mover|moverlo|moverla|mandalo|mandala|es|va|dejalo|dejala)?\s*(?:en|al?|a|para)?\s*(?:el\s*area\s*de|la\s*area\s*de|el\s*area|area\s*de|area|mis|mi|los|las)?\s*(proyectos?|trabajo|personal|estudios?|iglesia)$/i
  );
  if (areaUpdateMatch) {
    const rawTag = normalizeString(areaUpdateMatch[1]);
    const targetArea = AREA_MAP[rawTag];
    if (targetArea) {
      return {
        type: 'update_last',
        updates: { area: targetArea },
        explanation: `Área actualizada a <b>${targetArea}</b> 📁`,
      };
    }
  }

  // 6. Update last task planDate: "ponelo para hoy", "pasalo a hoy", "para hoy", "hoy", "para mañana", "a la bandeja"
  if (/^(?:guardalo|guardala|ponelo|ponela|pasalo|pasala|cambialo|cambiala|cambia|planificalo|agendalo|es|mover|moverlo)?\s*(?:para|a|en)?\s*(hoy)$/i.test(norm)) {
    return {
      type: 'update_last',
      updates: { planDate: todayStr, status: 'todo' },
      explanation: 'Planificada para <b>hoy</b> 📅',
    };
  }

  if (/^(?:guardalo|guardala|ponelo|ponela|pasalo|pasala|cambialo|cambiala|cambia|planificalo|agendalo|es|mover|moverlo)?\s*(?:para|a|en)?\s*(manana)$/i.test(norm)) {
    return {
      type: 'update_last',
      updates: { planDate: tomorrowStr, status: 'todo' },
      explanation: 'Planificada para <b>mañana</b> 📅',
    };
  }

  if (/^(?:mandalo|pasalo|dejalo|mover|cambialo)?\s*(?:a\s+la|en\s+la|a|en)?\s*(bandeja|inbox)$/i.test(norm)) {
    return {
      type: 'update_last',
      updates: { planDate: '', status: 'inbox' },
      explanation: 'Movida a la <b>bandeja de entrada</b> 📥',
    };
  }

  // 7. Update last task priority: "prioridad alta", "que sea urgente", "alta", "baja", etc.
  const prioUpdateMatch = norm.match(
    /^(?:prioridad\s+|es\s+|que\s+sea\s+|cambia\s+a\s+)?(urgente|alta|media|medio|normal|baja)$/i
  );
  if (prioUpdateMatch) {
    const rawPrio = normalizeString(prioUpdateMatch[1]);
    const targetPrio = PRIORITY_MAP[rawPrio];
    if (targetPrio) {
      const label = targetPrio === 3 ? '🔴 Alta' : targetPrio === 2 ? '🟡 Media' : '🟢 Baja';
      return {
        type: 'update_last',
        updates: { priority: targetPrio },
        explanation: `Prioridad cambiada a <b>${label}</b>`,
      };
    }
  }

  // 8. Update last task duration: "que dure 45 minutos", "ponele 1 hora", "duracion 30 min"
  const durCompMatch = norm.match(/^(?:que\s+dure|duracion|ponele|tiempo)\s*(\d+)\s*h(?:oras?)?\s*(\d+)?\s*m?(?:in(?:utos?)?)?$/i);
  if (durCompMatch && durCompMatch[2]) {
    const hours = parseInt(durCompMatch[1], 10) || 0;
    const mins = parseInt(durCompMatch[2], 10) || 0;
    const m = Math.max(5, Math.min(1440, hours * 60 + mins));
    return {
      type: 'update_last',
      updates: { minutes: m },
      explanation: `Duración actualizada a <b>${m} min</b> ⏱️`,
    };
  }
  const durSimpleMatch = norm.match(/^(?:que\s+dure|duracion|ponele|tiempo)\s*(\d+)\s*(m(?:in(?:utos?)?)?|h(?:oras?)?)$/i);
  if (durSimpleMatch) {
    const val = parseInt(durSimpleMatch[1], 10);
    const unit = durSimpleMatch[2].toLowerCase();
    const m = Math.max(5, Math.min(1440, unit.startsWith('h') ? val * 60 : val));
    return {
      type: 'update_last',
      updates: { minutes: m },
      explanation: `Duración actualizada a <b>${m} min</b> ⏱️`,
    };
  }

  // 9. Default: It's a new task to create!
  const task = parseTelegramTask(rawText, referenceDate);
  return {
    type: 'create',
    task,
  };
}
