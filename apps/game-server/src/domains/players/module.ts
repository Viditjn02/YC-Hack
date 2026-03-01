import { createPlayerService, type PlayerService } from './service.js';

export function createPlayerModule(): { service: PlayerService } {
  const service = createPlayerService();
  return { service };
}
