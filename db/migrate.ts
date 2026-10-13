import { pool } from './index';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_connect_token VARCHAR(32);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_connect_expires_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
      CREATE INDEX IF NOT EXISTS idx_users_telegram_connect_token ON users(telegram_connect_token);
    `);

    // 2. Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);

    // 3. Tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(240) NOT NULL,
        area VARCHAR(40) NOT NULL DEFAULT 'Personal',
        project VARCHAR(120) NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        priority SMALLINT NOT NULL DEFAULT 2,
        minutes INTEGER NOT NULL DEFAULT 30,
        status VARCHAR(20) NOT NULL DEFAULT 'inbox',
        plan_date VARCHAR(10) NOT NULL DEFAULT '',
        deadline VARCHAR(10) NOT NULL DEFAULT '',
        follow_up VARCHAR(10) NOT NULL DEFAULT '',
        top BOOLEAN NOT NULL DEFAULT FALSE,
        external_ref VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_plan_date ON tasks(user_id, plan_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON tasks(user_id, deadline);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_external_ref ON tasks(user_id, external_ref);
    `);

    // 4. Daily budgets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_budgets (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date VARCHAR(10) NOT NULL,
        minutes INTEGER NOT NULL DEFAULT 120,
        PRIMARY KEY (user_id, date)
      );
    `);

    // 5. Integration keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integration_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(80) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_integration_keys_user_id ON integration_keys(user_id);
    `);

    await client.query('COMMIT');
    console.log('Database schema verified / migrated successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow direct execution via node/tsx
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
