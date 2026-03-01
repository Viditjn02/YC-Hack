import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './apps/game-server/src/db/schema.ts',
  out: './apps/game-server/drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/bossroom',
  },
});
