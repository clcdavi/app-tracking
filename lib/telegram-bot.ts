import { Bot, InlineKeyboard, type Context } from 'grammy';
import { db } from '@/db';
import { users, tasks } from '@/db/schema';
import { eq, and, gt, desc, ne, or, isNull } from 'drizzle-orm';
import { parseTelegramTask, detectTelegramIntent, type ParsedTelegramTask } from './telegram-parser';
import { processWithGemini, type TaskContextItem } from './gemini';

declare global {
  var __enfoco_telegram_bot: Bot | undefined;
  var __enfoco_telegram_bot_starting: boolean | undefined;
  var __enfoco_telegram_bot_stopping: boolean | undefined;
}

let botInstance: Bot | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const HELP_MESSAGE =
  `📖 <b>Guía de conversación con Enfoco</b>\n\n` +
  `Podés hablarme de manera natural, enviarme notas de voz o usar comandos rápidos:\n\n` +
  `💬 <b>Conversación y contexto:</b>\n` +
  `• <i>«Reunión de equipo mañana 45m #trabajo !alta»</i>\n` +
  `• <i>«Guardalo en proyectos»</i> (modifica la última tarea)\n` +
  `• <i>«Ponelo para hoy»</i> o <i>«para mañana»</i>\n` +
  `• <i>«Prioridad alta»</i> o <i>«que dure 1 hora»</i>\n` +
  `• <i>«Listo»</i> (marca completada la última)\n` +
  `• <i>«Borralo»</i> (elimina la última)\n\n` +
  `📋 <b>Consultas y comandos:</b>\n` +
  `• /pendientes o <i>«¿Hay pendientes?»</i> — Ver todos tus pendientes activos\n` +
  `• /hoy o <i>«¿Qué tengo para hoy?»</i> — Ver tareas de hoy\n` +
  `• /inbox o <i>«¿Qué hay en la bandeja?»</i> — Ver bandeja sin fecha\n` +
  `• /completar — Completa la tarea más reciente\n` +
  `• /borrar — Elimina la última tarea creada\n` +
  `• /help — Muestra este menú\n` +
  `• /desconectar — Desvincula tu cuenta de Enfoco\n\n` +
  `🏷️ <b>Etiquetas opcionales:</b>\n` +
  `• <code>#trabajo</code>, <code>#proyectos</code>, <code>#personal</code>, <code>#estudio</code>\n` +
  `• <code>!alta</code>, <code>!media</code>, <code>!baja</code>\n` +
  `• <code>30m</code>, <code>1h</code>, <code>hoy</code>, <code>mañana</code>`;

async function executeCreateTask(
  ctx: Context,
  user: { id: string; displayName: string },
  taskData: {
    title: string;
    area: string;
    priority: 1 | 2 | 3;
    minutes: number;
    planDate: string;
    status: string;
    notes?: string;
  },
  replyPrefix?: string
) {
  const cleanTitle = (taskData.title || '').trim();
  if (!cleanTitle) {
    await ctx.reply('⚠️ No pude identificar el nombre de la tarea. Probá escribiendo: <i>«Comprar pan hoy 15m»</i>.', { parse_mode: 'HTML' });
    return;
  }

  const [newTask] = await db
    .insert(tasks)
    .values({
      userId: user.id,
      title: cleanTitle.slice(0, 240),
      area: taskData.area,
      priority: taskData.priority,
      minutes: taskData.minutes,
      status: taskData.status,
      planDate: taskData.planDate,
      externalRef: ctx.message ? `telegram:${ctx.message.message_id}` : undefined,
      notes: taskData.notes || '',
    })
    .returning();

  const prioEmoji = newTask.priority === 3 ? '🔴 Alta' : newTask.priority === 2 ? '🟡 Media' : '🟢 Baja';
  const dateText = newTask.planDate ? `📅 Día: <b>${escapeHtml(newTask.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';
  const keyboard = new InlineKeyboard()
    .text('✅ Completar', `done:${newTask.id}`)
    .text('📅 Para hoy', `today:${newTask.id}`)
    .text('🗑️ Borrar', `del:${newTask.id}`);

  const header = replyPrefix ? `✅ <b>${escapeHtml(replyPrefix)}</b>` : '✅ <b>Guardado en Enfoco</b>';

  await ctx.reply(
    `${header}\n\n` +
    `📌 <b>${escapeHtml(newTask.title)}</b>\n` +
    `📁 Área: <b>${escapeHtml(newTask.area)}</b> | ${prioEmoji}\n` +
    `⏱️ Duración: <b>${newTask.minutes} min</b>\n` +
    `${dateText}`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
  console.log(`[Telegram Bot] Tarea creada: "${newTask.title}" para ${user.displayName} (${user.id})`);
}

async function executeUpdateTask(
  ctx: Context,
  user: { id: string; displayName: string },
  lastTask: any,
  updates: any,
  replyPrefix?: string
) {
  if (!lastTask) {
    await ctx.reply('No tenés ningún pendiente reciente para modificar.');
    return;
  }

  const [updated] = await db
    .update(tasks)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, lastTask.id), eq(tasks.userId, user.id)))
    .returning();

  const prioEmoji = updated.priority === 3 ? '🔴 Alta' : updated.priority === 2 ? '🟡 Media' : '🟢 Baja';
  const dateText = updated.planDate ? `📅 Día: <b>${escapeHtml(updated.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';
  const keyboard = new InlineKeyboard()
    .text('✅ Completar', `done:${updated.id}`)
    .text('📅 Para hoy', `today:${updated.id}`)
    .text('🗑️ Borrar', `del:${updated.id}`);

  const header = replyPrefix ? `🔄 <b>${escapeHtml(replyPrefix)}</b>` : '🔄 <b>Pendiente actualizado</b>';

  await ctx.reply(
    `${header}\n\n` +
    `📌 <b>${escapeHtml(updated.title)}</b>\n` +
    `📁 Área: <b>${escapeHtml(updated.area)}</b> | ${prioEmoji}\n` +
    `⏱️ Duración: <b>${updated.minutes} min</b>\n` +
    `${dateText}`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
  console.log(`[Telegram Bot] Tarea actualizada: "${updated.title}" para ${user.displayName}`);
}

async function executeQueryToday(
  ctx: Context,
  user: { id: string; displayName: string },
  todayStr: string,
  replyPrefix?: string
) {
  const todayTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), eq(tasks.planDate, todayStr)))
    .orderBy(desc(tasks.priority), desc(tasks.createdAt));

  if (todayTasks.length === 0) {
    const pendingBacklog = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done')))
      .limit(1);

    if (pendingBacklog.length > 0) {
      await ctx.reply(
        `📅 <b>No tenés tareas planificadas específicamente para hoy (${escapeHtml(todayStr)}).</b>\n\n` +
        `💡 Pero tenés tareas activas en tus <b>/pendientes</b> (ej: <i>«${escapeHtml(pendingBacklog[0].title)}»</i>).\n` +
        `Escribí <b>/pendientes</b> para verlas o pedime: <i>«Poné ${escapeHtml(pendingBacklog[0].title.slice(0, 20))} para hoy»</i>.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    await ctx.reply(
      `📅 <b>No tenés tareas planificadas para hoy (${escapeHtml(todayStr)}).</b>\n\n` +
      `¡Tu día está despejado! Podés escribirme cualquier pendiente para agendarlo o consultar tus <b>/pendientes</b>.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const pendingCount = todayTasks.filter((t) => t.status !== 'done').length;
  const totalMinutes = todayTasks.filter((t) => t.status !== 'done').reduce((s, t) => s + t.minutes, 0);

  let msg = replyPrefix ? `💬 <i>${escapeHtml(replyPrefix)}</i>\n\n` : '';
  msg += `📅 <b>Tus tareas para hoy (${escapeHtml(todayStr)})</b>\n`;
  msg += `⏳ Pendientes: <b>${pendingCount}</b> | ⏱️ Tiempo: <b>${totalMinutes} min</b>\n\n`;

  for (let i = 0; i < Math.min(todayTasks.length, 8); i++) {
    const t = todayTasks[i];
    const icon = t.status === 'done' ? '✅' : t.top ? '⭐' : '📌';
    const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
    msg += `${i + 1}. ${icon} <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
  }

  if (todayTasks.length > 8) {
    msg += `\n<i>... y ${todayTasks.length - 8} tareas más en Enfoco web.</i>`;
  }

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

async function executeQueryPending(
  ctx: Context,
  user: { id: string; displayName: string },
  todayStr: string,
  replyPrefix?: string
) {
  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done')))
    .orderBy(desc(tasks.priority), desc(tasks.createdAt));

  if (allTasks.length === 0) {
    await ctx.reply(
      '🎉 <b>¡No tenés ningún pendiente activo en Enfoco!</b>\n\n' +
      'Tu espacio está totalmente al día. Podés escribirme cualquier tarea nueva o mandar un audio cuando surja algo.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const todayTasks = allTasks.filter((t) => t.planDate === todayStr);
  const overdueTasks = allTasks.filter((t) => t.planDate && t.planDate < todayStr);
  const backlogTasks = allTasks.filter((t) => !t.planDate || t.planDate === '');
  const futureTasks = allTasks.filter((t) => t.planDate && t.planDate > todayStr);

  const totalMinutes = allTasks.reduce((s, t) => s + t.minutes, 0);

  let msg = replyPrefix ? `💬 <i>${escapeHtml(replyPrefix)}</i>\n\n` : '';
  msg += `📋 <b>Tus tareas pendientes en Enfoco (${allTasks.length}):</b>\n`;
  msg += `⏱️ Tiempo estimado: <b>${totalMinutes} min</b>\n\n`;

  // Section 1: Overdue
  if (overdueTasks.length > 0) {
    msg += `⚠️ <b>Atrasadas (${overdueTasks.length}):</b>\n`;
    for (const t of overdueTasks.slice(0, 3)) {
      const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
      msg += `• 📌 <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.planDate})\n`;
    }
    msg += '\n';
  }

  // Section 2: Today
  if (todayTasks.length > 0) {
    msg += `📅 <b>Para hoy (${todayTasks.length}):</b>\n`;
    for (let i = 0; i < Math.min(todayTasks.length, 5); i++) {
      const t = todayTasks[i];
      const icon = t.status === 'doing' ? '⏳' : t.top ? '⭐' : '📌';
      const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
      msg += `${i + 1}. ${icon} <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
    }
    msg += '\n';
  }

  // Section 3: Backlog / Sin fecha
  if (backlogTasks.length > 0) {
    const title = todayTasks.length > 0 ? '📥 Bandeja / Backlog' : '📋 Pendientes sin planificar';
    msg += `<b>${title} (${backlogTasks.length}):</b>\n`;
    const showCount = todayTasks.length > 0 ? 5 : 8;
    for (let i = 0; i < Math.min(backlogTasks.length, showCount); i++) {
      const t = backlogTasks[i];
      const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
      msg += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
    }
    if (backlogTasks.length > showCount) {
      msg += `<i>... y ${backlogTasks.length - showCount} pendientes más en tu app.</i>\n`;
    }
    msg += '\n';
  }

  // Section 4: Future
  if (futureTasks.length > 0 && todayTasks.length === 0 && backlogTasks.length < 5) {
    msg += `🗓️ <b>Próximos días (${futureTasks.length}):</b>\n`;
    for (const t of futureTasks.slice(0, 3)) {
      msg += `• 📌 <b>${escapeHtml(t.title)}</b> (${t.planDate})\n`;
    }
    msg += '\n';
  }

  msg += `💡 <i>Tip: Podés decirme «Poné ${escapeHtml(allTasks[0].title.slice(0, 25))} para hoy» o «¿Qué tengo para hoy?».</i>`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

async function executeQueryInbox(
  ctx: Context,
  user: { id: string; displayName: string },
  replyPrefix?: string
) {
  const inboxTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, user.id),
        ne(tasks.status, 'done'),
        or(
          eq(tasks.status, 'inbox'),
          eq(tasks.planDate, ''),
          isNull(tasks.planDate)
        )
      )
    )
    .orderBy(desc(tasks.priority), desc(tasks.createdAt))
    .limit(8);

  if (inboxTasks.length === 0) {
    await ctx.reply('📥 <b>Tu bandeja de entrada está limpia.</b> ¡Excelente trabajo!', { parse_mode: 'HTML' });
    return;
  }

  let msg = replyPrefix ? `💬 <i>${escapeHtml(replyPrefix)}</i>\n\n` : '';
  msg += `📥 <b>Bandeja de entrada (${inboxTasks.length} pendientes sin fecha):</b>\n\n`;
  for (let i = 0; i < inboxTasks.length; i++) {
    const t = inboxTasks[i];
    const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
    msg += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
  }

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

async function executeCompleteLast(
  ctx: Context,
  user: { id: string; displayName: string },
  replyPrefix?: string
) {
  const [toComplete] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done')))
    .orderBy(desc(tasks.createdAt))
    .limit(1);

  if (!toComplete) {
    await ctx.reply('No encontré ningún pendiente reciente sin completar.');
    return;
  }

  await db
    .update(tasks)
    .set({ status: 'done', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, toComplete.id));

  const msg = replyPrefix
    ? `🎉 <b>${escapeHtml(replyPrefix)}</b>\n\n📌 <b>${escapeHtml(toComplete.title)}</b> marcada como hecha.`
    : `🎉 <b>¡Completada!</b>\n\n📌 <b>${escapeHtml(toComplete.title)}</b> marcada como hecha. ¡Gran avance!`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
  console.log(`[Telegram Bot] Tarea completada: "${toComplete.title}" para ${user.displayName}`);
}

async function executeDeleteLast(
  ctx: Context,
  user: { id: string; displayName: string },
  lastTask: any,
  replyPrefix?: string
) {
  if (!lastTask) {
    await ctx.reply('No tenés ningún pendiente reciente para borrar.');
    return;
  }

  await db.delete(tasks).where(eq(tasks.id, lastTask.id));

  const msg = replyPrefix
    ? `🗑️ <b>${escapeHtml(replyPrefix)}</b>\n\n📌 <b>${escapeHtml(lastTask.title)}</b> eliminada.`
    : `🗑️ <b>Pendiente eliminado:</b>\n\n📌 <b>${escapeHtml(lastTask.title)}</b>`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
  console.log(`[Telegram Bot] Tarea eliminada: "${lastTask.title}" para ${user.displayName}`);
}

export function createTelegramBot(token: string): Bot {
  const bot = new Bot(token);

  // Global error safety inside middleware
  bot.catch((err) => {
    console.error('[Telegram Bot Middleware Error]', err.error || err);
  });

  // /start command (with optional connection token)
  bot.command('start', async (ctx) => {
    const connectToken = ctx.match?.trim();
    const chatId = String(ctx.chat.id);
    console.log(`[Telegram Bot] /start recibido de chatId: ${chatId}, token: ${connectToken || '(ninguno)'}`);

    if (connectToken) {
      try {
        const [matchedUser] = await db
          .select({
            id: users.id,
            displayName: users.displayName,
          })
          .from(users)
          .where(
            and(
              eq(users.telegramConnectToken, connectToken),
              gt(users.telegramConnectExpiresAt, new Date())
            )
          )
          .limit(1);

        if (matchedUser) {
          await db
            .update(users)
            .set({
              telegramChatId: chatId,
              telegramConnectToken: null,
              telegramConnectExpiresAt: null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, matchedUser.id));

          await ctx.reply(
            `🎉 <b>¡Cuenta vinculada con éxito, ${escapeHtml(matchedUser.displayName)}!</b>\n\n` +
            `A partir de ahora, podés conversar conmigo para organizar tu día en <b>Enfoco</b>.\n\n` +
            `💡 <b>Probá enviando ahora:</b>\n` +
            `• <code>Continuar proyecto de ventasRF</code>\n` +
            `• <code>Guardalo en el área de proyectos</code>\n` +
            `• <code>¿Qué tengo para hoy?</code>\n\n` +
            `Escribí /help para ver más comandos y consejos.`,
            { parse_mode: 'HTML' }
          );
          console.log(`[Telegram Bot] Usuario vinculado con éxito: ${matchedUser.displayName} (${matchedUser.id}) -> ${chatId}`);
          return;
        }

        await ctx.reply(
          '⚠️ El enlace de vinculación no es válido o ha expirado.\n' +
          'Por favor, generá un nuevo enlace desde la sección de <b>Integraciones</b> en Enfoco.',
          { parse_mode: 'HTML' }
        );
        return;
      } catch (e) {
        console.error('Error connecting Telegram user:', e);
        await ctx.reply('Ocurrió un error al procesar la vinculación. Intentalo de nuevo más tarde.');
        return;
      }
    }

    // Check if user is already connected
    try {
      const [existingUser] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.telegramChatId, chatId))
        .limit(1);

      if (existingUser) {
        await ctx.reply(
          `👋 ¡Hola de nuevo, <b>${escapeHtml(existingUser.displayName)}</b>!\n\n` +
          `Tu cuenta de Enfoco está conectada y activa. Podés:\n` +
          `• Escribirme una tarea (ej: <i>«Llamar al contador mañana 15m»</i>)\n` +
          `• Mandarme una nota de voz 🎙️\n` +
          `• Consultar <b>/pendientes</b> o <b>/hoy</b>\n` +
          `• Escribir <b>/help</b> para ver todas las funciones.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          '👋 ¡Hola! Para conectar tu cuenta de <b>Enfoco</b> con este bot:\n\n' +
          '1. Entrá a tu cuenta de Enfoco en la web.\n' +
          '2. Ve a la sección <b>Integraciones</b>.\n' +
          '3. Hacé clic en <b>Conectar con Telegram</b>.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (e) {
      console.error('Error checking user link:', e);
      await ctx.reply('Hola. Enviá un mensaje después de conectar tu cuenta desde la app web.');
    }
  });

  // /help and /ayuda commands
  bot.command(['help', 'ayuda'], async (ctx) => {
    await ctx.reply(HELP_MESSAGE, { parse_mode: 'HTML' });
  });

  // /pendientes and /tareas commands
  bot.command(['pendientes', 'tareas'], async (ctx) => {
    const chatId = String(ctx.chat.id);
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.telegramChatId, chatId))
      .limit(1);

    if (!user) {
      await ctx.reply('🔒 Tu cuenta de Telegram no está vinculada a Enfoco. Conectala desde la sección Integraciones.');
      return;
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());

    await executeQueryPending(ctx, user, todayStr);
  });

  // /hoy and /today commands
  bot.command(['hoy', 'today', 'dia'], async (ctx) => {
    const chatId = String(ctx.chat.id);
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.telegramChatId, chatId))
      .limit(1);

    if (!user) {
      await ctx.reply('🔒 Tu cuenta de Telegram no está vinculada a Enfoco. Conectala desde la sección Integraciones.');
      return;
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());

    await executeQueryToday(ctx, user, todayStr);
  });

  // /inbox and /bandeja commands
  bot.command(['inbox', 'bandeja'], async (ctx) => {
    const chatId = String(ctx.chat.id);
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.telegramChatId, chatId))
      .limit(1);

    if (!user) {
      await ctx.reply('🔒 Tu cuenta de Telegram no está vinculada a Enfoco. Conectala desde la sección Integraciones.');
      return;
    }

    await executeQueryInbox(ctx, user);
  });

  // /completar and /done commands
  bot.command(['completar', 'done', 'listo'], async (ctx) => {
    const chatId = String(ctx.chat.id);
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.telegramChatId, chatId))
      .limit(1);

    if (!user) {
      await ctx.reply('🔒 Tu cuenta de Telegram no está vinculada a Enfoco. Conectala desde la sección Integraciones.');
      return;
    }

    await executeCompleteLast(ctx, user);
  });

  // /borrar and /del commands
  bot.command(['borrar', 'del', 'eliminar'], async (ctx) => {
    const chatId = String(ctx.chat.id);
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.telegramChatId, chatId))
      .limit(1);

    if (!user) {
      await ctx.reply('🔒 Tu cuenta de Telegram no está vinculada a Enfoco. Conectala desde la sección Integraciones.');
      return;
    }

    const [lastTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(desc(tasks.createdAt))
      .limit(1);

    await executeDeleteLast(ctx, user, lastTask);
  });

  // /desconectar command
  bot.command('desconectar', async (ctx) => {
    const chatId = String(ctx.chat.id);
    try {
      const result = await db
        .update(users)
        .set({ telegramChatId: null, updatedAt: new Date() })
        .where(eq(users.telegramChatId, chatId))
        .returning({ displayName: users.displayName });

      if (result.length > 0) {
        await ctx.reply('🔌 Tu cuenta ha sido desvinculada de Enfoco con éxito.');
        console.log(`[Telegram Bot] Cuenta desvinculada para chatId: ${chatId}`);
      } else {
        await ctx.reply('Este chat no estaba vinculado a ninguna cuenta.');
      }
    } catch (e) {
      console.error('Error disconnecting:', e);
      await ctx.reply('No se pudo desconectar en este momento.');
    }
  });

  // Interactive inline buttons actions
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = String(ctx.chat?.id);

    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.telegramChatId, chatId))
        .limit(1);

      if (!user) {
        await ctx.answerCallbackQuery({ text: 'Cuenta no vinculada.' });
        return;
      }

      if (data.startsWith('done:')) {
        const taskId = data.slice(5);
        await db
          .update(tasks)
          .set({ status: 'done', completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        await ctx.answerCallbackQuery({ text: '¡Marcada como completada! 🎉' });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } else if (data.startsWith('today:')) {
        const taskId = data.slice(6);
        const todayStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Argentina/Buenos_Aires',
        }).format(new Date());

        await db
          .update(tasks)
          .set({ planDate: todayStr, status: 'todo', updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        await ctx.answerCallbackQuery({ text: 'Planificada para hoy 📅' });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } else if (data.startsWith('del:')) {
        const taskId = data.slice(4);
        await db
          .delete(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        await ctx.answerCallbackQuery({ text: 'Pendiente eliminado 🗑️' });
        await ctx.deleteMessage();
      } else if (data.startsWith('defer_tomorrow:')) {
        const refDate = data.slice(15);
        const [y, m, d] = refDate.split('-').map(Number);
        const tomorrowStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

        await db
          .update(tasks)
          .set({ planDate: tomorrowStr, updatedAt: new Date() })
          .where(
            and(
              eq(tasks.userId, user.id),
              eq(tasks.planDate, refDate),
              ne(tasks.status, 'done')
            )
          );

        await ctx.answerCallbackQuery({ text: 'Pendientes pasados a mañana 📅' });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(`📅 Los pendientes no terminados se pasaron para <b>mañana (${tomorrowStr})</b>.`, { parse_mode: 'HTML' });
      } else if (data.startsWith('defer_inbox:')) {
        const refDate = data.slice(12);
        await db
          .update(tasks)
          .set({ planDate: '', status: 'inbox', top: false, updatedAt: new Date() })
          .where(
            and(
              eq(tasks.userId, user.id),
              eq(tasks.planDate, refDate),
              ne(tasks.status, 'done')
            )
          );

        await ctx.answerCallbackQuery({ text: 'Movidos a la bandeja 📥' });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(`📥 Los pendientes no terminados se movieron a tu <b>bandeja de entrada</b>.`, { parse_mode: 'HTML' });
      }
    } catch (e) {
      console.error('Error handling callback query:', e);
      await ctx.answerCallbackQuery({ text: 'Error al actualizar.' });
    }
  });

  // Handle Voice / Audio Notes
  bot.on(['message:voice', 'message:audio'], async (ctx) => {
    const chatId = String(ctx.chat.id);

    try {
      const [user] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.telegramChatId, chatId))
        .limit(1);

      if (!user) {
        await ctx.reply(
          '🔒 Tu cuenta de Telegram no está vinculada a Enfoco.\n\n' +
          'Ingresá a la web de <b>Enfoco</b>, ve a <b>Integraciones</b> y conectá tu cuenta.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        await ctx.reply(
          `🎙️ <b>¡Recibí tu nota de voz!</b>\n\n` +
          `Para transcribir audios y organizar tareas por voz con IA, se requiere configurar la clave de Gemini en el servidor.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const voice = ctx.message.voice || ctx.message.audio;
      if (!voice) return;

      await ctx.replyWithChatAction('typing').catch(() => {});
      await ctx.reply('🎙️ <i>Escuchando audio y organizando tus pendientes...</i>', { parse_mode: 'HTML' });

      const file = await ctx.getFile();
      if (!file.file_path) {
        await ctx.reply('⚠️ No se pudo descargar el archivo de audio de Telegram.');
        return;
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const res = await fetch(fileUrl);
      const arrayBuffer = await res.arrayBuffer();
      const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date());

      const [lastTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(desc(tasks.createdAt))
        .limit(1);

      const aiResult = await processWithGemini({
        apiKey: geminiApiKey,
        audioBase64,
        audioMimeType: voice.mime_type || 'audio/ogg',
        todayStr,
        lastTask: lastTask
          ? {
              id: lastTask.id,
              title: lastTask.title,
              area: lastTask.area,
              priority: lastTask.priority,
              minutes: lastTask.minutes,
              status: lastTask.status,
              planDate: lastTask.planDate,
            }
          : null,
      });

      if (!aiResult) {
        await ctx.reply('⚠️ No pude interpretar el audio correctamente. Probá de nuevo o escribilo en texto.');
        return;
      }

      if (aiResult.action === 'create' && aiResult.task) {
        await executeCreateTask(ctx, user, aiResult.task, aiResult.reply);
      } else if (aiResult.action === 'update' && lastTask && aiResult.updates) {
        await executeUpdateTask(ctx, user, lastTask, aiResult.updates, aiResult.reply);
      } else if (aiResult.action === 'query_pending') {
        await executeQueryPending(ctx, user, todayStr, aiResult.reply);
      } else if (aiResult.action === 'query_today') {
        await executeQueryToday(ctx, user, todayStr, aiResult.reply);
      } else if (aiResult.action === 'query_inbox') {
        await executeQueryInbox(ctx, user, aiResult.reply);
      } else if (aiResult.action === 'complete') {
        await executeCompleteLast(ctx, user, aiResult.reply);
      } else if (aiResult.action === 'delete') {
        await executeDeleteLast(ctx, user, lastTask, aiResult.reply);
      } else {
        await ctx.reply(escapeHtml(aiResult.reply || 'Acción procesada con éxito.'));
      }
    } catch (e) {
      console.error('Error handling voice message:', e);
      await ctx.reply('⚠️ Ocurrió un error al procesar el audio.');
    }
  });

  // Process text messages with conversational context
  bot.on('message:text', async (ctx) => {
    const rawText = ctx.message.text.trim();
    const chatId = String(ctx.chat.id);

    // If it's an unhandled slash command, guide the user
    if (rawText.startsWith('/')) {
      console.log(`[Telegram Bot] Comando no reconocido: "${rawText}" de chatId: ${chatId}`);
      await ctx.reply(
        '⚠️ Comando no reconocido.\n\nEscribí <b>/help</b> para ver la lista de comandos disponibles o hablamé normalmente.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      const [user] = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.telegramChatId, chatId))
        .limit(1);

      if (!user) {
        console.log(`[Telegram Bot] Mensaje de usuario no vinculado: chatId ${chatId}, text: "${rawText}"`);
        await ctx.reply(
          '🔒 Tu cuenta de Telegram no está vinculada a Enfoco.\n\n' +
          'Ingresá a la web de <b>Enfoco</b>, ve a <b>Integraciones</b> y hacé clic en <b>Conectar Telegram</b>.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      console.log(`[Telegram Incoming] From: ${user.displayName} (${chatId}): "${rawText}"`);
      await ctx.replyWithChatAction('typing').catch(() => {});

      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date());

      // Fetch the most recent task of this user for conversational context
      const [lastTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(desc(tasks.createdAt))
        .limit(1);

      // If Gemini AI API Key is provided, try AI-first understanding
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          const aiResult = await processWithGemini({
            apiKey: geminiApiKey,
            userPrompt: rawText,
            todayStr,
            lastTask: lastTask
              ? {
                  id: lastTask.id,
                  title: lastTask.title,
                  area: lastTask.area,
                  priority: lastTask.priority,
                  minutes: lastTask.minutes,
                  status: lastTask.status,
                  planDate: lastTask.planDate,
                }
              : null,
          });

          if (aiResult) {
            console.log(`[Telegram Bot AI] Acción detectada: ${aiResult.action}`);
            if (aiResult.action === 'create' && aiResult.task && aiResult.task.title.trim()) {
              await executeCreateTask(ctx, user, aiResult.task, aiResult.reply);
              return;
            }

            if (aiResult.action === 'update' && lastTask && aiResult.updates) {
              await executeUpdateTask(ctx, user, lastTask, aiResult.updates, aiResult.reply);
              return;
            }

            if (aiResult.action === 'query_pending') {
              await executeQueryPending(ctx, user, todayStr, aiResult.reply);
              return;
            }

            if (aiResult.action === 'query_today') {
              await executeQueryToday(ctx, user, todayStr, aiResult.reply);
              return;
            }

            if (aiResult.action === 'query_inbox') {
              await executeQueryInbox(ctx, user, aiResult.reply);
              return;
            }

            if (aiResult.action === 'complete') {
              await executeCompleteLast(ctx, user, aiResult.reply);
              return;
            }

            if (aiResult.action === 'delete') {
              await executeDeleteLast(ctx, user, lastTask, aiResult.reply);
              return;
            }

            if (aiResult.action === 'chat') {
              await ctx.reply(escapeHtml(aiResult.reply));
              return;
            }
          }
        } catch (geminiErr) {
          console.error('[Telegram Bot] Error en Gemini, recurriendo al motor de intenciones local:', geminiErr);
        }
      }

      // Built-in Smart Conversational Intent Engine (Instant, Zero Config Fallback)
      const intent = detectTelegramIntent(rawText, todayStr);
      console.log(`[Telegram Bot Local Engine] Intent: ${intent.type}`);

      // Case 0a: Greeting
      if (intent.type === 'greeting') {
        await ctx.reply(
          `👋 ¡Hola <b>${escapeHtml(user.displayName)}</b>!\n\n` +
          `¿En qué te puedo ayudar hoy? Podés pedirme:\n` +
          `• Guardar una tarea (ej: <i>«Llamar al banco hoy 15m #trabajo»</i>)\n` +
          `• Preguntarme <i>«¿Hay pendientes?»</i> o <i>«¿Qué tengo para hoy?»</i>\n` +
          `• Consultar <b>/pendientes</b> o tu <b>/inbox</b>\n\n` +
          `O escribir <b>/help</b> para ver todos los comandos.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Case 0b: Thanks
      if (intent.type === 'thanks') {
        await ctx.reply('💪 ¡De nada! Seguimos enfocados.');
        return;
      }

      // Case 0c: Help
      if (intent.type === 'help') {
        await ctx.reply(HELP_MESSAGE, { parse_mode: 'HTML' });
        return;
      }

      // Case A1: Query Pending (General)
      if (intent.type === 'query_pending') {
        await executeQueryPending(ctx, user, todayStr);
        return;
      }

      // Case A2: Query Today
      if (intent.type === 'query_today') {
        await executeQueryToday(ctx, user, todayStr);
        return;
      }

      // Case B: Query Inbox specifically
      if (intent.type === 'query_inbox') {
        await executeQueryInbox(ctx, user);
        return;
      }

      // Case C: Complete Last Task
      if (intent.type === 'complete_last') {
        await executeCompleteLast(ctx, user);
        return;
      }

      // Case D: Delete Last Task
      if (intent.type === 'delete_last') {
        await executeDeleteLast(ctx, user, lastTask);
        return;
      }

      // Case E: Update Last Task Area / Details
      if (intent.type === 'update_last') {
        await executeUpdateTask(ctx, user, lastTask, intent.updates, intent.explanation);
        return;
      }

      // Case F: Create New Task (Standard)
      const parsed = intent.type === 'create' ? intent.task : parseTelegramTask(rawText, todayStr);
      await executeCreateTask(ctx, user, parsed);
    } catch (e) {
      console.error('Error in Telegram message handler:', e);
      await ctx.reply('⚠️ No se pudo procesar tu mensaje en este momento. Por favor intentá de nuevo.');
    }
  });

  return bot;
}

async function runLongPollingLoop(bot: Bot) {
  let consecutiveErrors = 0;

  while (!globalThis.__enfoco_telegram_bot_stopping) {
    try {
      // Clear any stale webhook before starting long polling
      await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});

      await bot.start({
        drop_pending_updates: false,
        onStart: (info) => {
          consecutiveErrors = 0;
          console.log(`[Telegram Bot] Conectado exitosamente como @${info.username}`);
        },
      });

      console.log('[Telegram Bot] Long polling finalizado de forma normal.');
      break;
    } catch (err: any) {
      if (globalThis.__enfoco_telegram_bot_stopping) {
        break;
      }
      consecutiveErrors++;
      const errMsg = err?.message || err?.description || String(err);
      console.error(`[Telegram Bot] Error en long polling (intento ${consecutiveErrors}):`, errMsg);

      // Backoff: 3s up to 15s
      const delay = Math.min(15000, 2000 + consecutiveErrors * 1000);
      console.log(`[Telegram Bot] Reconectando en ${(delay / 1000).toFixed(1)} segundos...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function startTelegramBot(): Promise<Bot | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN no configurado. Servicio inactivo.');
    return null;
  }

  if (globalThis.__enfoco_telegram_bot || globalThis.__enfoco_telegram_bot_starting) {
    return globalThis.__enfoco_telegram_bot || null;
  }

  globalThis.__enfoco_telegram_bot_starting = true;
  globalThis.__enfoco_telegram_bot_stopping = false;

  try {
    const bot = createTelegramBot(token);
    globalThis.__enfoco_telegram_bot = bot;
    botInstance = bot;

    // Run resilient long polling supervisor in background
    runLongPollingLoop(bot);

    return bot;
  } catch (e) {
    console.error('[Telegram Bot] Error al inicializar bot:', e);
    return null;
  } finally {
    globalThis.__enfoco_telegram_bot_starting = false;
  }
}

export async function stopTelegramBot(): Promise<void> {
  globalThis.__enfoco_telegram_bot_stopping = true;
  const currentBot = globalThis.__enfoco_telegram_bot || botInstance;
  if (currentBot) {
    try {
      await currentBot.stop();
      console.log('[Telegram Bot] Detenido.');
    } catch (e) {
      console.error('[Telegram Bot] Error al detener:', e);
    }
    globalThis.__enfoco_telegram_bot = undefined;
    botInstance = null;
  }
}
