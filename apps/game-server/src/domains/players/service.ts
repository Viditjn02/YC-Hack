import { WebSocket } from 'ws';
import type { PlayerState, ServerMessage } from '@bossroom/shared-types';
import { log } from '../../logger.js';

export function createPlayerService() {
  const players = new Map<string, PlayerState>();
  const connections = new Map<string, WebSocket>();
  const wsToUid = new Map<WebSocket, string>();

  return {
    addPlayer(uid: string, state: PlayerState, ws: WebSocket): void {
      players.set(uid, state);
      connections.set(uid, ws);
      wsToUid.set(ws, uid);
    },

    removeByWs(ws: WebSocket): string | undefined {
      const uid = wsToUid.get(ws);
      if (uid) {
        players.delete(uid);
        connections.delete(uid);
        wsToUid.delete(ws);
      }
      return uid;
    },

    getUidByWs(ws: WebSocket): string | undefined {
      return wsToUid.get(ws);
    },

    getPlayer(uid: string): PlayerState | undefined {
      return players.get(uid);
    },

    getConnection(uid: string): WebSocket | undefined {
      return connections.get(uid);
    },

    updatePosition(uid: string, pos: [number, number, number], rotation: number, animation: string): void {
      const p = players.get(uid);
      if (p) {
        p.position = pos;
        p.rotation = rotation;
        p.animation = animation;
      }
    },

    updateAvatarId(uid: string, avatarId: string): void {
      const p = players.get(uid);
      if (p) p.avatarId = avatarId;
    },

    getWorldPlayers(): Record<string, PlayerState> {
      return Object.fromEntries(players);
    },

    send(ws: WebSocket, msg: ServerMessage): void {
      if (ws.readyState === WebSocket.OPEN) {
        log.debug(`[ws] send ${msg.type}`);
        ws.send(JSON.stringify(msg));
      }
    },

    broadcast(msg: ServerMessage, excludeUid?: string): void {
      for (const [uid, conn] of connections) {
        if (uid !== excludeUid) {
          if (conn.readyState === WebSocket.OPEN) {
            log.debug(`[ws] send ${msg.type}`);
            conn.send(JSON.stringify(msg));
          }
        }
      }
    },
  };
}

export type PlayerService = ReturnType<typeof createPlayerService>;
