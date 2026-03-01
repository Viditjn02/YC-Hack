import type { DrizzleDB } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { UserSettings } from '@bossroom/shared-types';

export function createUserRepository(db: DrizzleDB) {
  return {
    async upsert(userData: {
      id: string;
      email: string;
      displayName: string | null;
      photoURL: string | null;
    }): Promise<void> {
      await db.insert(users).values({
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        lastLoginAt: new Date(),
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          lastLoginAt: new Date(),
        },
      });
    },

    async getSettings(uid: string): Promise<UserSettings> {
      const result = await db.select({ settings: users.settings })
        .from(users).where(eq(users.id, uid)).limit(1);
      return result[0]?.settings ?? {};
    },

    async updateSettings(uid: string, patch: Partial<UserSettings>): Promise<void> {
      const current = await this.getSettings(uid);
      await db.update(users).set({ settings: { ...current, ...patch } }).where(eq(users.id, uid));
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
