import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __dbClient: NodePgDatabase<typeof schema> | undefined;
}

let poolInstance: Pool | undefined;
let dbInstance: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  if (poolInstance) return poolInstance;
  if (global.__dbPool) return global.__dbPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required to connect to PostgreSQL.');
  }

  const newPool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  poolInstance = newPool;
  global.__dbPool = newPool;
  return newPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (dbInstance) return dbInstance;
  if (global.__dbClient) return global.__dbClient;

  const p = getPool();
  const client = drizzle(p, { schema });

  dbInstance = client;
  global.__dbClient = client;
  return client;
}

// Proxies for backwards-compatible direct exports without eager module load crashes
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const activePool = getPool();
    const val = (activePool as unknown as Record<string, unknown>)[prop as string];
    return typeof val === 'function' ? val.bind(activePool) : val;
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const activeDb = getDb();
    const val = (activeDb as unknown as Record<string, unknown>)[prop as string];
    return typeof val === 'function' ? val.bind(activeDb) : val;
  },
});
