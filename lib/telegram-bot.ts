import { Bot, InlineKeyboard } from 'grammy';
import { db } from '@/db';
import { users, tasks } from '@/db/schema';
import { eq, and, gt, desc, ne } from 'drizzle-orm';
import { parseTelegramTask, detectTelegramIntent } from './telegram-parser';
import { processWithGemini, type TaskContextItem } from './gemini';

let botInstance: Bot | null = null;
let isBotStarting = false;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createTelegramBot(token: string): Bot {
  const bot = new Bot(token);

  // Error handling so no unhandled exception ever crashes the Node process
  bot.catch((err) => {
    console.error('[Telegram Bot Error]', err.error || err);
  });

  // /start command (with optional connection token)
  bot.command('start', async (ctx) => {
    const connectToken = ctx.match?.trim();
    const chatId = String(ctx.chat.id);

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
          `Tu cuenta está conectada. Podés pedirme guardar tareas, modificar la anterior (ej: <i>«guardalo en proyectos»</i>), o preguntarme <i>«¿qué tengo para hoy?»</i>.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          '👋 ¡Hola! Para conectar tu cuenta de <b>Enfoco</b> con este bot:\n\n' +
          '1. Entrá a tu cuenta de Enfoco en la web.\n' +
          '2. Ve a la sección <b>Integraciones</b>.\n' +
          '3. Hacé clic en <b>Conectar Telegram</b>.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (e) {
      console.error('Error checking user link:', e);
      await ctx.reply('Hola. Enviá un mensaje después de conectar tu cuenta desde la app web.');
    }
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 <b>Guía de conversación con Enfoco</b>\n\n` +
      `Podés hablarme naturalmente o enviar pendientes rápidos:\n\n` +
      `💬 <b>Conversación y contexto:</b>\n` +
      `• <i>«Continuar proyecto de ventasRF»</i>\n` +
      `• <i>«Guardalo en el área de proyectos»</i> (ajusta la tarea anterior)\n` +
      `• <i>«Ponelo para hoy»</i> o <i>«para mañana»</i>\n` +
      `• <i>«Prioridad alta»</i> o <i>«que dure 45 min»</i>\n` +
      `• <i>«Listo»</i> (marca completada la última)\n` +
      `• <i>«Borralo»</i> (elimina la última)\n\n` +
      `📋 <b>Consultas:</b>\n` +
      `• <i>«¿Qué tengo para hoy?»</i>\n` +
      `• <i>«¿Qué hay en la bandeja?»</i>\n\n` +
      `🏷️ <b>Etiquetas rápidas (opcional):</b>\n` +
      `• <code>#trabajo</code>, <code>#proyectos</code>, <code>#personal</code>\n` +
      `• <code>!alta</code>, <code>!media</code>, <code>!baja</code>\n` +
      `• <code>30m</code>, <code>1h</code>, <code>hoy</code>, <code>mañana</code>`,
      { parse_mode: 'HTML' }
    );
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
          `Para que pueda transcribir audios y organizar tareas por voz con Inteligencia Artificial, podés activar una clave gratuita de <b>Google Gemini</b>.\n\n` +
          `💡 <i>Es 100% gratis y la generás en 30 segundos en <a href="https://aistudio.google.com/app/apikey">aistudio.google.com/app/apikey</a>.</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const voice = ctx.message.voice || ctx.message.audio;
      if (!voice) return;

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
        await ctx.reply('⚠️ No pude interpretar el audio correctamente. Probá de nuevo o escribílo en texto.');
        return;
      }

      if (aiResult.action === 'create' && aiResult.task) {
        const [newTask] = await db
          .insert(tasks)
          .values({
            userId: user.id,
            title: aiResult.task.title,
            area: aiResult.task.area,
            priority: aiResult.task.priority,
            minutes: aiResult.task.minutes,
            status: aiResult.task.status,
            planDate: aiResult.task.planDate,
            externalRef: `telegram:${ctx.message.message_id}`,
            notes: aiResult.task.notes || '',
          })
          .returning();

        const prioEmoji = newTask.priority === 3 ? '🔴 Alta' : newTask.priority === 2 ? '🟡 Media' : '🟢 Baja';
        const dateText = newTask.planDate ? `📅 Día: <b>${escapeHtml(newTask.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';
        const keyboard = new InlineKeyboard()
          .text('✅ Completar', `done:${newTask.id}`)
          .text('📅 Para hoy', `today:${newTask.id}`)
          .text('🗑️ Borrar', `del:${newTask.id}`);

        await ctx.reply(
          `✅ <b>${escapeHtml(aiResult.reply || 'Guardado en Enfoco')}</b>\n\n` +
          `📌 <b>${escapeHtml(newTask.title)}</b>\n` +
          `📁 Área: <b>${escapeHtml(newTask.area)}</b> | ${prioEmoji}\n` +
          `⏱️ Duración: <b>${newTask.minutes} min</b>\n` +
          `${dateText}`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
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
    if (rawText.startsWith('/')) return; // Ignore unhandled commands

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
          'Ingresá a la web de <b>Enfoco</b>, ve a <b>Integraciones</b> y hacé clic en <b>Conectar Telegram</b>.',
          { parse_mode: 'HTML' }
        );
        return;
      }

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

      // If Gemini AI API Key is provided, use full conversational LLM
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
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
          if (aiResult.action === 'create' && aiResult.task) {
            const [newTask] = await db
              .insert(tasks)
              .values({
                userId: user.id,
                title: aiResult.task.title,
                area: aiResult.task.area,
                priority: aiResult.task.priority,
                minutes: aiResult.task.minutes,
                status: aiResult.task.status,
                planDate: aiResult.task.planDate,
                externalRef: `telegram:${ctx.message.message_id}`,
                notes: aiResult.task.notes || '',
              })
              .returning();

            const prioEmoji = newTask.priority === 3 ? '🔴 Alta' : newTask.priority === 2 ? '🟡 Media' : '🟢 Baja';
            const dateText = newTask.planDate ? `📅 Día: <b>${escapeHtml(newTask.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';
            const keyboard = new InlineKeyboard()
              .text('✅ Completar', `done:${newTask.id}`)
              .text('📅 Para hoy', `today:${newTask.id}`)
              .text('🗑️ Borrar', `del:${newTask.id}`);

            await ctx.reply(
              `✅ <b>${escapeHtml(aiResult.reply || 'Guardado en Enfoco')}</b>\n\n` +
              `📌 <b>${escapeHtml(newTask.title)}</b>\n` +
              `📁 Área: <b>${escapeHtml(newTask.area)}</b> | ${prioEmoji}\n` +
              `⏱️ Duración: <b>${newTask.minutes} min</b>\n` +
              `${dateText}`,
              { parse_mode: 'HTML', reply_markup: keyboard }
            );
            return;
          }

          if (aiResult.action === 'update' && lastTask && aiResult.updates) {
            const [updated] = await db
              .update(tasks)
              .set({
                ...aiResult.updates,
                updatedAt: new Date(),
              })
              .where(eq(tasks.id, lastTask.id))
              .returning();

            const prioEmoji = updated.priority === 3 ? '🔴 Alta' : updated.priority === 2 ? '🟡 Media' : '🟢 Baja';
            const dateText = updated.planDate ? `📅 Día: <b>${escapeHtml(updated.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';
            const keyboard = new InlineKeyboard()
              .text('✅ Completar', `done:${updated.id}`)
              .text('📅 Para hoy', `today:${updated.id}`)
              .text('🗑️ Borrar', `del:${updated.id}`);

            await ctx.reply(
              `🔄 <b>${escapeHtml(aiResult.reply || 'Pendiente actualizado')}</b>\n\n` +
              `📌 <b>${escapeHtml(updated.title)}</b>\n` +
              `📁 Área: <b>${escapeHtml(updated.area)}</b> | ${prioEmoji}\n` +
              `⏱️ Duración: <b>${updated.minutes} min</b>\n` +
              `${dateText}`,
              { parse_mode: 'HTML', reply_markup: keyboard }
            );
            return;
          }

          if (aiResult.action === 'chat') {
            await ctx.reply(escapeHtml(aiResult.reply));
            return;
          }
        }
      }

      // Built-in Smart Conversational Intent Engine (Instant & 0 Config)
      const intent = detectTelegramIntent(rawText, todayStr);

      // Case A: Query Today
      if (intent.type === 'query_today') {
        const todayTasks = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), eq(tasks.planDate, todayStr)))
          .orderBy(desc(tasks.priority), desc(tasks.createdAt));

        if (todayTasks.length === 0) {
          await ctx.reply(
            `📅 <b>No tenés tareas planificadas para hoy (${escapeHtml(todayStr)}).</b>\n\n` +
            `Podés escribirme cualquier pendiente para agendarlo o consultar tu <b>bandeja</b>.`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        const pendingCount = todayTasks.filter((t) => t.status !== 'done').length;
        const totalMinutes = todayTasks.filter((t) => t.status !== 'done').reduce((s, t) => s + t.minutes, 0);

        let msg = `📅 <b>Tus tareas para hoy (${escapeHtml(todayStr)})</b>\n`;
        msg += `⏳ Pendientes: <b>${pendingCount}</b> | ⏱️ Tiempo: <b>${totalMinutes} min</b>\n\n`;

        for (let i = 0; i < Math.min(todayTasks.length, 8); i++) {
          const t = todayTasks[i];
          const icon = t.status === 'done' ? '✅' : t.top ? '⭐' : '📌';
          const prio = t.priority === 3 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
          msg += `${i + 1}. ${icon} <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${prio} | ${t.minutes}m)\n`;
        }

        if (todayTasks.length > 8) {
          msg += `\n<i>... y ${todayTasks.length - 8} tareas más en la web.</i>`;
        }

        await ctx.reply(msg, { parse_mode: 'HTML' });
        return;
      }

      // Case B: Query Inbox
      if (intent.type === 'query_inbox') {
        const inboxTasks = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), eq(tasks.status, 'inbox')))
          .orderBy(desc(tasks.createdAt))
          .limit(8);

        if (inboxTasks.length === 0) {
          await ctx.reply('📥 <b>Tu bandeja de entrada está limpia.</b> ¡Buen trabajo!', { parse_mode: 'HTML' });
          return;
        }

        let msg = `📥 <b>Bandeja de entrada (${inboxTasks.length} pendientes):</b>\n\n`;
        for (let i = 0; i < inboxTasks.length; i++) {
          const t = inboxTasks[i];
          msg += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b> (${escapeHtml(t.area)} | ${t.minutes}m)\n`;
        }

        await ctx.reply(msg, { parse_mode: 'HTML' });
        return;
      }

      // Case C: Complete Last Task
      if (intent.type === 'complete_last') {
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

        await ctx.reply(
          `🎉 <b>¡Completada!</b>\n\n📌 <b>${escapeHtml(toComplete.title)}</b> marcada como hecha. Buen avance.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Case D: Delete Last Task
      if (intent.type === 'delete_last') {
        if (!lastTask) {
          await ctx.reply('No tenés ningún pendiente reciente para borrar.');
          return;
        }

        await db.delete(tasks).where(eq(tasks.id, lastTask.id));

        await ctx.reply(
          `🗑️ <b>Pendiente eliminado:</b>\n\n📌 <b>${escapeHtml(lastTask.title)}</b>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Case E: Update Last Task (Exact User Screenshot Case: "Guardalo en el area de proyectos")
      if (intent.type === 'update_last' && lastTask) {
        const [updated] = await db
          .update(tasks)
          .set({
            ...intent.updates,
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

        await ctx.reply(
          `🔄 <b>Pendiente modificado</b>\n\n` +
          `📌 <b>${escapeHtml(updated.title)}</b>\n` +
          `✨ ${intent.explanation}\n\n` +
          `📁 Área: <b>${escapeHtml(updated.area)}</b> | ${prioEmoji}\n` +
          `⏱️ Duración: <b>${updated.minutes} min</b>\n` +
          `${dateText}`,
          {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          }
        );
        return;
      }

      // Case F: Create New Task (Standard)
      const parsed = intent.type === 'create' ? intent.task : parseTelegramTask(rawText, todayStr);

      const [newTask] = await db
        .insert(tasks)
        .values({
          userId: user.id,
          title: parsed.title,
          area: parsed.area,
          priority: parsed.priority,
          minutes: parsed.minutes,
          status: parsed.status,
          planDate: parsed.planDate,
          externalRef: `telegram:${ctx.message.message_id}`,
          notes: parsed.notes || '',
        })
        .returning({ id: tasks.id });

      const prioEmoji = parsed.priority === 3 ? '🔴 Alta' : parsed.priority === 2 ? '🟡 Media' : '🟢 Baja';
      const dateText = parsed.planDate ? `📅 Día: <b>${escapeHtml(parsed.planDate)}</b>` : '📥 <b>Bandeja de entrada</b>';

      const keyboard = new InlineKeyboard()
        .text('✅ Completar', `done:${newTask.id}`)
        .text('📅 Para hoy', `today:${newTask.id}`)
        .text('🗑️ Borrar', `del:${newTask.id}`);

      await ctx.reply(
        `✅ <b>Guardado en Enfoco</b>\n\n` +
        `📌 <b>${escapeHtml(parsed.title)}</b>\n` +
        `📁 Área: <b>${escapeHtml(parsed.area)}</b> | ${prioEmoji}\n` +
        `⏱️ Duración: <b>${parsed.minutes} min</b>\n` +
        `${dateText}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      );
    } catch (e) {
      console.error('Error in Telegram message handler:', e);
      await ctx.reply('⚠️ No se pudo procesar tu mensaje en este momento. Por favor intentá de nuevo.');
    }
  });

  return bot;
}

export async function startTelegramBot(): Promise<Bot | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN no configurado. Servicio inactivo.');
    return null;
  }

  if (botInstance || isBotStarting) {
    return botInstance;
  }

  isBotStarting = true;
  try {
    const bot = createTelegramBot(token);
    botInstance = bot;

    // Start long-polling in background
    bot.start({
      onStart: (info) => {
        console.log(`[Telegram Bot] Conectado exitosamente como @${info.username}`);
      },
    }).catch((err) => {
      console.error('[Telegram Bot] Error en ejecución de long polling:', err);
    });

    return bot;
  } catch (e) {
    console.error('[Telegram Bot] Error al iniciar bot:', e);
    return null;
  } finally {
    isBotStarting = false;
  }
}

export async function stopTelegramBot(): Promise<void> {
  if (botInstance) {
    try {
      await botInstance.stop();
      console.log('[Telegram Bot] Detenido.');
    } catch (e) {
      console.error('[Telegram Bot] Error al detener:', e);
    }
    botInstance = null;
  }
}
