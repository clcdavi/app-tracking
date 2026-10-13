export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('@/db/migrate');
    try {
      await runMigrations();
    } catch (error) {
      console.error('Failed to run database migrations during startup:', error);
    }
  }
}
