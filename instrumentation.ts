export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startTelegramBot } = await import('@/lib/telegram-bot');
      await startTelegramBot();
    } catch (e) {
      console.error('[Instrumentation] Error starting Telegram bot:', e);
    }
  }
}
