import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users, skills, conversations, taskHistory } from './schema.js';

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSkillSchema = createInsertSchema(skills);
export const selectSkillSchema = createSelectSchema(skills);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertTaskHistorySchema = createInsertSchema(taskHistory);
export const selectTaskHistorySchema = createSelectSchema(taskHistory);
