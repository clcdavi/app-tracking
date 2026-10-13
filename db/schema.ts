import { pgTable, text, varchar, integer, smallint, boolean, timestamp, uuid, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
]);

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 240 }).notNull(),
  area: varchar('area', { length: 40 }).notNull().default('Personal'),
  project: varchar('project', { length: 120 }).notNull().default(''),
  notes: text('notes').notNull().default(''),
  priority: smallint('priority').notNull().default(2),
  minutes: integer('minutes').notNull().default(30),
  status: varchar('status', { length: 20 }).notNull().default('inbox'),
  planDate: varchar('plan_date', { length: 10 }).notNull().default(''),
  deadline: varchar('deadline', { length: 10 }).notNull().default(''),
  followUp: varchar('follow_up', { length: 10 }).notNull().default(''),
  top: boolean('top').notNull().default(false),
  externalRef: varchar('external_ref', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_tasks_user_status').on(table.userId, table.status),
  index('idx_tasks_user_plan_date').on(table.userId, table.planDate),
  index('idx_tasks_user_deadline').on(table.userId, table.deadline),
  index('idx_tasks_user_external_ref').on(table.userId, table.externalRef),
]);

export const dailyBudgets = pgTable('daily_budgets', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  minutes: integer('minutes').notNull().default(120),
}, (table) => [
  primaryKey({ columns: [table.userId, table.date] }),
]);

export const integrationKeys = pgTable('integration_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('idx_integration_keys_user_id').on(table.userId),
]);

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  sessions: many(sessions),
  dailyBudgets: many(dailyBudgets),
  integrationKeys: many(integrationKeys),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
}));
