import { pgTable, uuid, text, timestamp, jsonb, pgEnum, unique, boolean, index, bigint } from 'drizzle-orm/pg-core';
import type { UserSettings } from '@bossroom/shared-types';

export const agentModelEnum = pgEnum('agent_model', ['claude', 'gpt-4o', 'gemini']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  settings: jsonb('settings').$type<UserSettings>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  taskSummary: text('task_summary').notNull(),
  status: text('status').notNull().default('active'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('workspace_user_idx').on(t.userId, t.isArchived),
]);

export const workspaceAgents = pgTable('workspace_agents', {
  agentId: text('agent_id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id).notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  zoneName: text('zone_name').notNull(),
  personality: text('personality').notNull(),
  role: text('role').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  status: text('status').notNull().default('idle'),
  position: jsonb('position').$type<[number, number, number]>().notNull(),
  chatHistory: jsonb('chat_history').$type<Array<{ role: 'user' | 'assistant'; content: string }>>().notNull().default([]),
  initialTask: text('initial_task'),
  teamMembers: jsonb('team_members').$type<string[]>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ws_agent_workspace_idx').on(t.workspaceId),
]);

export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: text('agent_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  requiredTools: jsonb('required_tools').$type<string[]>().notNull().default([]),
  creatorType: text('creator_type').notNull().default('system'),
  sessionId: text('session_id'),
  enabled: boolean('enabled').notNull().default(true),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  agentId: text('agent_id').notNull(),
  workspaceId: text('workspace_id').notNull().default('global'),
  messages: jsonb('messages').$type<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>().notNull().default([]),
  aiMessages: jsonb('ai_messages').$type<unknown[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  unique('uq_user_agent').on(t.userId, t.agentId),
]);

export const taskHistory = pgTable('task_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  agentId: text('agent_id').notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  task: text('task').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  toolsUsed: jsonb('tools_used').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const scratchpadEntries = pgTable('scratchpad_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  authorType: text('author_type').notNull(),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  authorColor: text('author_color').notNull(),
  content: text('content').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
}, (table) => [
  index('scratchpad_workspace_idx').on(table.workspaceId, table.timestamp),
]);
