import { startTelegramBot } from '../lib/telegram-bot';

async function main() {
  console.log('[Telegram Bot Runner] Iniciando servicio autónomo...');
  const bot = await startTelegramBot();
  if (!bot) {
    console.error('[Telegram Bot Runner] Error: TELEGRAM_BOT_TOKEN no está definido en el entorno.');
    process.exit(1);
  }

  process.once('SIGINT', () => {
    console.log('[Telegram Bot Runner] Recibido SIGINT, cerrando...');
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    console.log('[Telegram Bot Runner] Recibido SIGTERM, cerrando...');
    process.exit(0);
  });
}

void main();
