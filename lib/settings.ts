import { z } from 'zod';

export const AREA_OPTIONS = ['Personal', 'Trabajo', 'Estudio', 'Iglesia', 'Proyectos'] as const;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().regex(timeRegex, 'Hora inválida (HH:MM)');

const notificationSchema = z.object({
  enabled: z.boolean(),
  time: timeSchema,
});

export const settingsSchema = z.object({
  // Planning
  dailyBudget: z.number().int().min(0).max(1440),
  workdayStart: timeSchema,
  // New task defaults
  defaultArea: z.enum(AREA_OPTIONS),
  defaultMinutes: z.number().int().min(5).max(1440),
  defaultPriority: z.number().int().min(1).max(3),
  // Focus mode
  focusMinutes: z.number().int().min(5).max(180),
  breakMinutes: z.number().int().min(1).max(60),
  focusSound: z.boolean(),
  // Telegram notifications
  morningBriefing: notificationSchema,
  eveningReview: notificationSchema,
  deadlineReminder: notificationSchema,
  // AI
  aiAutoEstimate: z.boolean(),
});

export type UserSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = {
  dailyBudget: 120,
  workdayStart: '09:00',
  defaultArea: 'Personal',
  defaultMinutes: 30,
  defaultPriority: 2,
  focusMinutes: 25,
  breakMinutes: 5,
  focusSound: true,
  morningBriefing: { enabled: true, time: '08:00' },
  eveningReview: { enabled: true, time: '20:00' },
  deadlineReminder: { enabled: true, time: '17:00' },
  aiAutoEstimate: true,
};

/**
 * Merges any stored/partial value with defaults, field by field, so that a
 * single invalid or missing field never breaks the whole settings object.
 */
export function normalizeSettings(raw: unknown): UserSettings {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const shape = settingsSchema.shape;

  for (const key of Object.keys(shape) as (keyof UserSettings)[]) {
    if (!(key in input)) continue;
    const parsed = shape[key].safeParse(input[key]);
    if (parsed.success) result[key] = parsed.data;
  }

  return result as UserSettings;
}

/** Converts "HH:MM" into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Converts minutes since midnight into "HH:MM" (wrapping past midnight). */
export function minutesToTime(total: number): string {
  const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
