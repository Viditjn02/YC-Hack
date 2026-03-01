import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  activityEvents: defineTable({
    userId: v.string(),
    workspaceId: v.string(),
    agentName: v.string(),
    eventType: v.string(), // "task_started", "task_completed", "tool_used", "call_made"
    detail: v.string(),
    timestamp: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_workspace', ['workspaceId']),
});
