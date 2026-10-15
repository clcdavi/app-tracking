export interface GeminiActionResult {
  action: 'create' | 'update' | 'query_today' | 'query_inbox' | 'complete' | 'delete' | 'chat';
  reply: string;
  task?: {
    title: string;
    area: 'Personal' | 'Trabajo' | 'Estudio' | 'Iglesia' | 'Proyectos';
    priority: 1 | 2 | 3;
    minutes: number;
    planDate: string;
    status: 'inbox' | 'todo';
    notes?: string;
  };
  updates?: {
    area?: 'Personal' | 'Trabajo' | 'Estudio' | 'Iglesia' | 'Proyectos';
    priority?: 1 | 2 | 3;
    minutes?: number;
    planDate?: string;
    status?: 'inbox' | 'todo' | 'doing' | 'waiting' | 'done';
    title?: string;
  };
}

export interface TaskContextItem {
  id: string;
  title: string;
  area: string;
  priority: number;
  minutes: number;
  status: string;
  planDate: string;
}

export async function processWithGemini(params: {
  apiKey: string;
  userPrompt?: string;
  audioBase64?: string;
  audioMimeType?: string;
  todayStr: string;
  lastTask?: TaskContextItem | null;
  recentTasks?: TaskContextItem[];
}): Promise<GeminiActionResult | null> {
  const { apiKey, userPrompt, audioBase64, audioMimeType, todayStr, lastTask, recentTasks } = params;
  if (!apiKey) return null;

  const systemInstruction = `Sos el copiloto de productividad e inteligencia artificial de la app Enfoco.
El usuario se comunica con vos por Telegram mediante texto o notas de voz para gestionar sus tareas.
Fecha de referencia de hoy: ${todayStr}.
Zonas horarias y fechas relativas:
- "hoy" -> planDate: "${todayStr}"
- "mañana" -> calcular la fecha del día siguiente en formato YYYY-MM-DD
- "para la bandeja / inbox" -> planDate: "", status: "inbox"

Áreas disponibles: "Personal", "Trabajo", "Estudio", "Iglesia", "Proyectos". Si no especifica, default: "Personal".
Prioridades: 1 (Baja), 2 (Media), 3 (Alta/Urgente). Default: 2.
Duración en minutos: 15, 30, 45, 60, etc. Default: 30.

Contexto actual del usuario:
- Última tarea creada o modificada recientemente: ${lastTask ? JSON.stringify(lastTask) : 'Ninguna'}
- Otras tareas recientes del usuario: ${recentTasks && recentTasks.length ? JSON.stringify(recentTasks) : 'Ninguna'}

REGLAS DE DECISIÓN DE ACCIONES:
1. Si el usuario pide modificar o ajustar la tarea anterior (ej: "guardalo en proyectos", "ponelo para hoy", "que dure 1 hora", "cambiá la prioridad a alta", "cambiale el título a..."), la acción es "update".
2. Si el usuario pide ver o consultar qué tiene ("¿qué tengo para hoy?", "mis tareas", "qué hay hoy", "¿cómo viene mi día?"), la acción es "query_today".
3. Si el usuario pide ver pendientes sin planificar ("¿qué tengo en la bandeja?", "inbox", "pendientes"), la acción es "query_inbox".
4. Si el usuario pide completar ("listo", "completalo", "ya lo terminé"), la acción es "complete".
5. Si el usuario pide borrar o descartar ("borralo", "eliminalo", "cancelá eso"), la acción es "delete".
6. Si describe un pendiente nuevo (ej: "Reunión con cliente mañana 45m"), la acción es "create".
7. Si hace una pregunta o charla sobre productividad ("¿qué me recomendás hacer primero?", "¿cómo organizo mi día?"), la acción es "chat".

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin bloques markdown ni explicaciones adicionales):
{
  "action": "create" | "update" | "query_today" | "query_inbox" | "complete" | "delete" | "chat",
  "reply": "Mensaje cordial, claro y ejecutivo que le responderás al usuario por Telegram en español (máximo 2 a 3 oraciones, podés usar emojis).",
  "task": {
    "title": "título limpio sin etiquetas ni palabras de relleno",
    "area": "Personal" | "Trabajo" | "Estudio" | "Iglesia" | "Proyectos",
    "priority": 1 | 2 | 3,
    "minutes": 30,
    "planDate": "${todayStr}" o "" si va a inbox,
    "status": "todo" o "inbox",
    "notes": ""
  },
  "updates": {
    "area": "Proyectos",
    "planDate": "${todayStr}",
    "priority": 3,
    "minutes": 60,
    "status": "todo",
    "title": "nuevo titulo opcional"
  }
}`;

  const parts: Array<Record<string, unknown>> = [];

  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: audioMimeType || 'audio/ogg',
        data: audioBase64,
      },
    });
    parts.push({
      text: userPrompt
        ? `Mensaje adicional del usuario: "${userPrompt}". Escuchá el audio y ejecutá la acción correspondiente.`
        : 'Escuchá este mensaje de voz del usuario, interpretá su intención y generá la acción correspondiente en formato JSON.',
    });
  } else if (userPrompt) {
    parts.push({
      text: `Mensaje del usuario: "${userPrompt}". Analizá la intención y respondé con el JSON correspondiente.`,
    });
  } else {
    return null;
  }

  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
  ];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Gemini API Error with ${model}]`, response.status, errText);
        continue;
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        console.error(`[Gemini API] Respuesta vacía de ${model}:`, JSON.stringify(data));
        continue;
      }

      const parsed = JSON.parse(candidateText) as GeminiActionResult;
      return parsed;
    } catch (err) {
      console.error(`[Gemini API] Error procesando con ${model}:`, err);
    }
  }

  return null;
}

export interface SubtaskItem {
  title: string;
  minutes: number;
  priority: 1 | 2 | 3;
  area: 'Personal' | 'Trabajo' | 'Estudio' | 'Iglesia' | 'Proyectos';
}

export async function breakdownTaskWithGemini(params: {
  apiKey: string;
  taskTitle: string;
  taskNotes?: string;
  area?: string;
}): Promise<SubtaskItem[] | null> {
  const { apiKey, taskTitle, taskNotes, area } = params;
  if (!apiKey || !taskTitle.trim()) return null;

  const prompt = `Como asistente de productividad de la app Enfoco, dividí la siguiente tarea en 3 a 5 subtareas concretas, accionables, secuenciales y realistas de entre 15 y 45 minutos cada una.
Tarea principal: "${taskTitle}"
${taskNotes ? `Notas/contexto: "${taskNotes}"` : ''}
Área sugerida: "${area || 'Personal'}"

Responde ÚNICAMENTE con un JSON array de objetos con este formato:
[
  {
    "title": "primer paso concreto",
    "minutes": 25,
    "priority": 2,
    "area": "${area || 'Personal'}"
  }
]`;

  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
  ];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) continue;
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const items = JSON.parse(text) as SubtaskItem[];
      if (Array.isArray(items) && items.length > 0) {
        return items;
      }
    } catch (e) {
      console.error(`[Gemini Breakdown Error with ${model}]`, e);
    }
  }

  return null;
}

