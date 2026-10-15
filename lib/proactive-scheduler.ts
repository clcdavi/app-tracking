import { db } from '@/db';
import { users, tasks, userSettings, notificationLogs } from '@/db/schema';
import { eq, and, ne, lte, desc } from 'drizzle-orm';
import { normalizeSettings, type UserSettings } from './settings';
import { createTelegramBot } from './telegram-bot';
import { InlineKeyboard } from 'grammy';

let schedulerInterval: NodeJS.Timeout | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getArgentinaDateTime(): { timeStr: string; dateStr: string } {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    timeStr: timeFormatter.format(now),
    dateStr: dateFormatter.format(now),
  };
}

export async function sendMorningBriefing(userId: string, isManualTest = false): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      chatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.chatId) return false;

  const { dateStr } = getArgentinaDateTime();

  const userTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), eq(tasks.planDate, dateStr)))
    .orderBy(desc(tasks.top), desc(tasks.priority));

  const pending = userTasks.filter((t) => t.status !== 'done');
  const top = pending.filter((t) => t.top);
  const totalMinutes = pending.reduce((s, t) => s + t.minutes, 0);

  let msg = `☀️ <b>¡Buen día, ${escapeHtml(user.displayName)}!</b>\n\n`;

  if (pending.length === 0) {
    msg += `No tenés tareas planificadas para hoy todavía.\n\n` +
      `💡 <i>Escribime un pendiente o mandame un audio para empezar tu día con foco.</i>`;
  } else {
    msg += `Hoy tenés <b>${pending.length} tarea(s)</b> (${totalMinutes} min estimados):\n\n`;
    for (let i = 0; i < Math.min(pending.length, 5); i++) {
      const t = pending[i];
      const icon = t.top ? '⭐' : '📌';
      const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
      msg += `${i + 1}. ${icon} <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
    }
    if (pending.length > 5) {
      msg += `\n<i>... y ${pending.length - 5} más en tu panel web.</i>\n`;
    }
    msg += `\n🎯 <i>¿Arrancamos con la primera?</i>`;
  }

  const bot = createTelegramBot(token);
  await bot.api.sendMessage(user.chatId, msg, { parse_mode: 'HTML' });

  if (!isManualTest) {
    await db.insert(notificationLogs).values({
      userId: user.id,
      type: 'morning_briefing',
      referenceDate: dateStr,
    });
  }

  return true;
}

export async function sendEveningReview(userId: string, isManualTest = false): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      chatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.chatId) return false;

  const { dateStr } = getArgentinaDateTime();

  const dayTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), eq(tasks.planDate, dateStr)));

  const completed = dayTasks.filter((t) => t.status === 'done');
  const remaining = dayTasks.filter((t) => t.status !== 'done');
  const doneMinutes = completed.reduce((s, t) => s + t.minutes, 0);

  let msg = `🌙 <b>Cierre del día, ${escapeHtml(user.displayName)}</b>\n\n`;

  if (completed.length > 0) {
    msg += `🎉 <b>¡Completaste ${completed.length} tarea(s)!</b> (${doneMinutes} min de avance productivo).\n\n`;
  } else {
    msg += `Hoy no marcaste tareas como completadas. Mañana es una nueva oportunidad.\n\n`;
  }

  const keyboard = new InlineKeyboard();

  if (remaining.length > 0) {
    msg += `Te quedaron <b>${remaining.length} pendiente(s)</b> de hoy:\n`;
    for (let i = 0; i < Math.min(remaining.length, 3); i++) {
      msg += `• 📌 <b>${escapeHtml(remaining[i].title)}</b>\n`;
    }
    msg += `\n¿Qué preferís hacer con lo que quedó?`;
    keyboard
      .text('📅 Pasar a mañana', `defer_tomorrow:${dateStr}`)
      .text('📥 A la bandeja', `defer_inbox:${dateStr}`);
  } else if (completed.length > 0) {
    msg += `✨ <i>Completaste todo lo planeado para hoy. ¡Excelente trabajo de foco!</i>`;
  }

  const bot = createTelegramBot(token);
  await bot.api.sendMessage(user.chatId, msg, {
    parse_mode: 'HTML',
    reply_markup: remaining.length > 0 ? keyboard : undefined,
  });

  if (!isManualTest) {
    await db.insert(notificationLogs).values({
      userId: user.id,
      type: 'evening_review',
      referenceDate: dateStr,
    });
  }

  return true;
}

export async function sendDeadlineReminder(userId: string, isManualTest = false): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      chatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.chatId) return false;

  const { dateStr } = getArgentinaDateTime();

  const urgentTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, user.id),
        ne(tasks.status, 'done'),
        lte(tasks.deadline, dateStr),
        ne(tasks.deadline, '')
      )
    );

  if (urgentTasks.length === 0 && !isManualTest) {
    return false;
  }

  let msg = `⏰ <b>Recordatorio de vencimiento, ${escapeHtml(user.displayName)}</b>\n\n`;
  if (urgentTasks.length === 0) {
    msg += `No tenés tareas con vencimiento pendiente para hoy. Todo al día. ✨`;
  } else {
    msg += `Tenés <b>${urgentTasks.length} tarea(s)</b> con fecha límite para hoy o vencidas:\n\n`;
    for (let i = 0; i < Math.min(urgentTasks.length, 4); i++) {
      const t = urgentTasks[i];
      msg += `• 📌 <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${t.minutes}m)\n`;
    }
  }

  const bot = createTelegramBot(token);
  await bot.api.sendMessage(user.chatId, msg, { parse_mode: 'HTML' });

  if (!isManualTest) {
    await db.insert(notificationLogs).values({
      userId: user.id,
      type: 'deadline_reminder',
      referenceDate: dateStr,
    });
  }

  return true;
}

async function checkAndSendNotifications(): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const { timeStr, dateStr } = getArgentinaDateTime();

    // Get all users with telegramChatId
    const linkedUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        chatId: users.telegramChatId,
      })
      .from(users)
      .where(ne(users.telegramChatId, ''));

    for (const u of linkedUsers) {
      if (!u.chatId) continue;

      // Get user settings
      const [settingsRow] = await db
        .select({ settings: userSettings.settings })
        .from(userSettings)
        .where(eq(userSettings.userId, u.id))
        .limit(1);

      const settings = normalizeSettings(settingsRow?.settings);

      // Check morning briefing
      if (settings.morningBriefing.enabled && settings.morningBriefing.time === timeStr) {
        const [alreadySent] = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.userId, u.id),
              eq(notificationLogs.type, 'morning_briefing'),
              eq(notificationLogs.referenceDate, dateStr)
            )
          )
          .limit(1);

        if (!alreadySent) {
          await sendMorningBriefing(u.id);
        }
      }

      // Check evening review
      if (settings.eveningReview.enabled && settings.eveningReview.time === timeStr) {
        const [alreadySent] = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.userId, u.id),
              eq(notificationLogs.type, 'evening_review'),
              eq(notificationLogs.referenceDate, dateStr)
            )
          )
          .limit(1);

        if (!alreadySent) {
          await sendEveningReview(u.id);
        }
      }

      // Check deadline reminder
      if (settings.deadlineReminder.enabled && settings.deadlineReminder.time === timeStr) {
        const [alreadySent] = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.userId, u.id),
              eq(notificationLogs.type, 'deadline_reminder'),
              eq(notificationLogs.referenceDate, dateStr)
            )
          )
          .limit(1);

        if (!alreadySent) {
          await sendDeadlineReminder(u.id);
        }
      }
    }
  } catch (err) {
    console.error('[Proactive Scheduler Error]', err);
  }
}

export function startProactiveScheduler(): void {
  if (schedulerInterval) return;

  // Run immediately on start, then every 30 seconds
  schedulerInterval = setInterval(() => {
    void checkAndSendNotifications();
  }, 30000);

  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }

  console.log('[Proactive Scheduler] Iniciado para notificaciones de Telegram.');
}

export function stopProactiveScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
