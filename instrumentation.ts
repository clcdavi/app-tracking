export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { runMigrations } = await import('@/db/migrate');
      await runMigrations();
    } catch (e) {
      console.error('[Instrumentation] Error running database migrations:', e);
    }

    try {
      const { startTelegramBot } = await import('@/lib/telegram-bot');
      await startTelegramBot();
    } catch (e) {
      console.error('[Instrumentation] Error starting Telegram bot:', e);
    }

    try {
      const { startProactiveScheduler } = await import('@/lib/proactive-scheduler');
      startProactiveScheduler();
    } catch (e) {
      console.error('[Instrumentation] Error starting proactive scheduler:', e);
    }
  }
}
