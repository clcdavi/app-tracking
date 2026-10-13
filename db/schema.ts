import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', { owner: text('owner').primaryKey(), data: text('data').notNull(), version: integer('version').notNull().default(0) });
export const integrationKeys = sqliteTable('integration_keys', { id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), tokenHash: text('token_hash').notNull().unique(), createdAt: text('created_at').notNull(), lastUsedAt: text('last_used_at'), revokedAt: text('revoked_at') });
