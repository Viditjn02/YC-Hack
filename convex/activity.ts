import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** Log an activity event from the game server (fire-and-forget). */
export const log = mutation({
  args: {
    userId: v.string(),
    workspaceId: v.string(),
    agentName: v.string(),
    eventType: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('activityEvents', {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/** List recent activity events for a user (real-time reactive query). */
export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(50);
  },
});

/** List all recent activity events (real-time reactive query — for dashboard). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('activityEvents')
      .order('desc')
      .take(100);
  },
});

/** List recent activity events for a workspace (real-time reactive query). */
export const listByWorkspace = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(50);
  },
});
