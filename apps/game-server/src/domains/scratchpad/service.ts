import { randomUUID } from 'node:crypto';
import type { DrizzleDB } from '../../db/client.js';
import { scratchpadEntries } from '../../db/schema.js';
import { eq, asc, lt } from 'drizzle-orm';
import { log } from '../../logger.js';

interface ScratchpadEntry {
  id: string;
  workspaceId: string;
  authorType: 'agent' | 'user';
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  timestamp: number;
}

const MAX_ENTRIES = 100;

export function createScratchpadService(db: DrizzleDB) {
  const pads = new Map<string, ScratchpadEntry[]>();

  return {
    read(workspaceId: string): ScratchpadEntry[] {
      return pads.get(workspaceId) ?? [];
    },

    write(workspaceId: string, entry: Omit<ScratchpadEntry, 'id' | 'timestamp' | 'workspaceId'>): ScratchpadEntry {
      const full: ScratchpadEntry = {
        ...entry,
        id: randomUUID(),
        workspaceId,
        timestamp: Date.now(),
      };
      const entries = pads.get(workspaceId) ?? [];
      entries.push(full);
      if (entries.length > MAX_ENTRIES) entries.shift();
      pads.set(workspaceId, entries);

      // Fire-and-forget DB persist
      void db.insert(scratchpadEntries).values({
        id: full.id,
        workspaceId: full.workspaceId,
        authorType: full.authorType,
        authorId: full.authorId,
        authorName: full.authorName,
        authorColor: full.authorColor,
        content: full.content,
        timestamp: full.timestamp,
      }).then().catch((err) => {
        log.error('[scratchpad] DB persist failed:', err);
      });

      return full;
    },

    async loadWorkspace(workspaceId: string): Promise<ScratchpadEntry[]> {
      try {
        const rows = await db.select().from(scratchpadEntries)
          .where(eq(scratchpadEntries.workspaceId, workspaceId))
          .orderBy(asc(scratchpadEntries.timestamp))
          .limit(MAX_ENTRIES);

        const entries: ScratchpadEntry[] = rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          authorType: r.authorType as 'agent' | 'user',
          authorId: r.authorId,
          authorName: r.authorName,
          authorColor: r.authorColor,
          content: r.content,
          timestamp: r.timestamp,
        }));

        pads.set(workspaceId, entries);
        return entries;
      } catch (err) {
        log.error('[scratchpad] DB load failed:', err);
        return pads.get(workspaceId) ?? [];
      }
    },

    clear(workspaceId: string): void {
      pads.delete(workspaceId);
      void db.delete(scratchpadEntries)
        .where(eq(scratchpadEntries.workspaceId, workspaceId))
        .then().catch((err) => {
          log.error('[scratchpad] DB clear failed:', err);
        });
    },

    /** Delete DB entries older than maxAgeMs and clear their in-memory caches. */
    async pruneOld(maxAgeMs: number): Promise<void> {
      const cutoff = Date.now() - maxAgeMs;
      try {
        await db.delete(scratchpadEntries)
          .where(lt(scratchpadEntries.timestamp, cutoff));
        pads.clear();
        log.info(`[scratchpad] Pruned old entries (cutoff: ${new Date(cutoff).toISOString()})`);
      } catch (err) {
        log.error('[scratchpad] DB prune failed:', err);
      }
    },
  };
}

export type ScratchpadService = ReturnType<typeof createScratchpadService>;
