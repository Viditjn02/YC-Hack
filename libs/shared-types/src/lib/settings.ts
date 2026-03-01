import { z } from 'zod';

export const DEFAULT_AVATAR_ID = 'default';
export const RANDOM_AVATAR_ID = 'random';

/** Pick a random avatar from the character list. */
export function randomAvatarId(): string {
  const pool = VALID_AVATAR_IDS.filter((id) => id !== 'default' && id !== 'random');
  return pool[Math.floor(Math.random() * pool.length)];
}

export const VALID_AVATAR_IDS = [
  'random',
  'default',
  'female-a',
  'female-b',
  'female-c',
  'female-d',
  'female-e',
  'female-f',
  'male-a',
  'male-b',
  'male-c',
  'male-d',
  'male-e',
  'male-f',
] as const;

export const avatarIdSchema = z.enum(VALID_AVATAR_IDS);

export const VOICE_OPTIONS = ['Dominus', 'Pixie', 'Snik', 'Loretta'] as const;

export const userSettingsSchema = z.object({
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
