import { Bot, InlineKeyboard } from 'grammy';
import { db } from '@/db';
import { users, tasks } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { parseTelegramTask } from './telegram-parser';

let botInstance: Bot | null = null;
let isBotStarting = false;

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
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
            `🎉 *¡Cuenta vinculada con éxito, ${escapeMarkdown(matchedUser.displayName)}!*\n\n` +
            `A partir de ahora, cualquier mensaje que me envíes se convertirá en un pendiente en tu Enfoco\\.\n\n` +
            `💡 *Probá enviando ahora:*\n` +
            `• \`Comprar leche\`\n` +
            `• \`Terminar reporte #trabajo !alta hoy 45m\`\n\n` +
            `Usá /help para ver todas las opciones disponibles\\.`,
            { parse_mode: 'MarkdownV2' }
          );
          return;
        }

        await ctx.reply(
          '⚠️ El enlace de vinculación no es válido o ha expirado\\.\n' +
          'Por favor, generá un nuevo enlace desde la sección de *Integraciones* en Enfoco\\.',
          { parse_mode: 'MarkdownV2' }
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
          `👋 ¡Hola de nuevo, *${escapeMarkdown(existingUser.displayName)}*!\n\n` +
          `Tu cuenta ya está conectada\\. Enviame cualquier texto y lo guardaré en tus pendientes de Enfoco\\.\n\n` +
          `Escribí /help para ver la sintaxis y comandos\\.`,
          { parse_mode: 'MarkdownV2' }
        );
      } else {
        await ctx.reply(
          '👋 ¡Hola! Para conectar tu cuenta de *Enfoco* con este bot:\n\n' +
          '1. Entrá a tu cuenta de Enfoco en la web\\.\n' +
          '2. Ve a la sección *Integraciones*\\.\n' +
          '3. Hacé clic en *Conectar Telegram*\\.',
          { parse_mode: 'MarkdownV2' }
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
      `📖 *Guía de captura rápida en Enfoco*\n\n` +
      `Cualquier mensaje que me envíes se guarda al instante\\.\n\n` +
      `🏷️ *Etiquetas inteligentes:*\n` +
      `• *Área:* \`#trabajo\`, \`#personal\`, \`#estudio\`, \`#iglesia\`, \`#proyectos\`\n` +
      `• *Prioridad:* \`!alta\` \\(\`!3\`\\), \`!media\` \\(\`!2\`\\), \`!baja\` \\(\`!1\`\\)\n` +
      `• *Duración:* \`15m\`, \`30m\`, \`45m\`, \`1h\`, \`2h\`, \`1h30m\`\n` +
      `• *Fechas:* \`hoy\`, \`mañana\`, o \`AAAA-MM-DD\`\n\n` +
      `📌 *Ejemplos:*\n` +
      `• \`Llamar a Carlos 15m #trabajo !alta hoy\`\n` +
      `• \`Comprar café en el súper\`\n` +
      `• \`Repasar examen de inglés mañana 1h #estudio\``,
      { parse_mode: 'MarkdownV2' }
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
          '🔒 Tu cuenta de Telegram no está vinculada a Enfoco\\.\n\n' +
          'Ingresá a la web de *Enfoco*, ve a *Integraciones* y hacé clic en *Conectar Telegram*\\.',
          { parse_mode: 'MarkdownV2' }
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
      const dateText = parsed.planDate ? `📅 Día: *${parsed.planDate}*` : '📥 *Bandeja de entrada*';

      const keyboard = new InlineKeyboard()
        .text('✅ Completar', `done:${newTask.id}`)
        .text('📅 Para hoy', `today:${newTask.id}`)
        .text('🗑️ Borrar', `del:${newTask.id}`);

      await ctx.reply(
        `✅ *Guardado en Enfoco*\n\n` +
        `📌 *${escapeMarkdown(parsed.title)}*\n` +
        `📁 Área: *${escapeMarkdown(parsed.area)}* \\| ${prioEmoji}\n` +
        `⏱️ Duración: *${parsed.minutes} min*\n` +
        `${dateText}`,
        {
          parse_mode: 'MarkdownV2',
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
