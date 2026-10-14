import { Bot, InlineKeyboard } from 'grammy';
import { db } from '@/db';
import { users, tasks } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { parseTelegramTask } from './telegram-parser';

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
    const token = ctx.match?.trim();
    const chatId = String(ctx.chat.id);

    if (token) {
      try {
        const [matchedUser] = await db
          .select({
            id: users.id,
            displayName: users.displayName,
          })
          .from(users)
          .where(
            and(
              eq(users.telegramConnectToken, token),
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
            `A partir de ahora, cualquier mensaje que me envíes se convertirá en un pendiente en tu Enfoco.\n\n` +
            `💡 <b>Probá enviando ahora:</b>\n` +
            `• <code>Comprar leche</code>\n` +
            `• <code>Terminar reporte #trabajo !alta hoy 45m</code>\n\n` +
            `Usá /help para ver todas las opciones disponibles.`,
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
          `Tu cuenta ya está conectada. Enviame cualquier texto y lo guardaré en tus pendientes de Enfoco.\n\n` +
          `Escribí /help para ver la sintaxis y comandos.`,
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
      `📖 <b>Guía de captura rápida en Enfoco</b>\n\n` +
      `Cualquier mensaje que me envíes se guarda al instante.\n\n` +
      `🏷️ <b>Etiquetas inteligentes:</b>\n` +
      `• <b>Área:</b> <code>#trabajo</code>, <code>#personal</code>, <code>#estudio</code>, <code>#iglesia</code>, <code>#proyectos</code>\n` +
      `• <b>Prioridad:</b> <code>!alta</code> (o <code>!3</code>), <code>!media</code> (o <code>!2</code>), <code>!baja</code> (o <code>!1</code>)\n` +
      `• <b>Duración:</b> <code>15m</code>, <code>30m</code>, <code>45m</code>, <code>1h</code>, <code>2h</code>, <code>1h30m</code>\n` +
      `• <b>Fechas:</b> <code>hoy</code>, <code>mañana</code>, o <code>AAAA-MM-DD</code>\n\n` +
      `📌 <b>Ejemplos:</b>\n` +
      `• <code>Llamar a Carlos 15m #trabajo !alta hoy</code>\n` +
      `• <code>Comprar café en el súper</code>\n` +
      `• <code>Repasar examen de inglés mañana 1h #estudio</code>`,
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

  // Process text messages (new tasks)
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return; // Ignore unhandled commands

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

      const parsed = parseTelegramTask(text);

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
      console.error('Error inserting task from Telegram:', e);
      await ctx.reply('⚠️ No se pudo guardar la tarea en este momento. Por favor intentá de nuevo.');
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
