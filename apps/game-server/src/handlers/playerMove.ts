import { WebSocket } from 'ws';
import { log } from '../logger.js';
import type { PlayerService } from '../domains/players/service.js';

export function handlePlayerMove(
  ws: WebSocket,
  payload: { position: [number, number, number]; rotation: number; animation: string },
  players: PlayerService,
) {
  const uid = players.getUidByWs(ws);
  if (!uid) return;

  // Validate position and rotation
  const { position, rotation, animation } = payload;
  if (
    !position.every((v) => Number.isFinite(v) && v >= -100 && v <= 100) ||
    !Number.isFinite(rotation) ||
    rotation < -2 * Math.PI ||
    rotation > 2 * Math.PI
  ) {
    log.warn('Invalid player:move data', payload);
    return;
  }

  players.updatePosition(uid, position, rotation, animation);
  players.broadcast(
    { type: 'player:moved', payload: { playerId: uid, ...payload } },
    uid,
  );
}
