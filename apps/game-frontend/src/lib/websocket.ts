/**
 * WebSocket client for connecting to the BossRoom game server.
 * Handles connection, reconnection, and message routing to the Zustand store.
 * Gracefully handles server unavailability without console spam.
 */
import { serverMessageSchema, type ClientMessage, type ServerMessage } from '@bossroom/shared-types';
import { log } from './logger';

type MessageHandler = (msg: ServerMessage) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handler: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private username = '';
  private token = '';
  private tokenRefresher: (() => Promise<string>) | null = null;
  private intentionallyClosed = false;

  /** true when no real server URL is configured (e.g. deployed without backend) */
  private disabled = false;

  constructor() {
    // SSR: disable until client-side hydration
    if (typeof window === 'undefined') {
      this.url = '';
      this.disabled = true;
      return;
    }

    // Runtime check: HTTPS pages cannot use ws://, only wss://
    const isProduction = window.location.protocol === 'https:';
    const wsUrl = this.getWebSocketUrl();

    if (isProduction && (!wsUrl || wsUrl.startsWith('ws://'))) {
      // HTTPS page needs wss:// server - if not configured, disable
      this.url = '';
      this.disabled = true;
      console.log('[WS] Production mode: no secure WebSocket server configured. Running offline.');
    } else if (wsUrl) {
      this.url = wsUrl;
    } else {
      // Development fallback
      this.url = 'ws://localhost:8080';
    }
  }

  private getWebSocketUrl(): string | null {
    // Read from meta tag set by Next.js at runtime, not build time
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="ws-url"]');
      if (meta) return meta.getAttribute('content');
    }
    // Fallback to window-injected value
    return (window as any).__WS_URL__ || null;
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler;
  }

  setTokenRefresher(fn: () => Promise<string>) {
    this.tokenRefresher = fn;
  }

  connect(username: string, token: string) {
    if (this.disabled) return;
    log.info(`[ws] connecting as ${username}`);
    this.username = username;
    this.token = token;
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private async doConnect() {
    if (this.disabled) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.intentionallyClosed) return;

    // If reconnecting and tokenRefresher exists, refresh the token first
    if (this.reconnectAttempts > 0 && this.tokenRefresher) {
      try {
        this.token = await this.tokenRefresher();
        log.debug('[ws] token refreshed for reconnect');
      } catch {
        log.warn('[ws] token refresh failed, giving up');
        // Can't refresh token — stop trying
        return;
      }
    }

    this.createConnection();
  }

  private createConnection() {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      log.error('[ws] failed to create WebSocket');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      log.info('[ws] connected');
      this.reconnectAttempts = 0;
      console.log('[WS] Connected to game server');
      this.send({
        type: 'player:join',
        payload: { username: this.username, token: this.token },
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = serverMessageSchema.safeParse(JSON.parse(event.data as string));
        if (!parsed.success) {
          log.warn('[ws] invalid server message:', parsed.error.issues);
          return;
        }
        log.debug(`[ws] recv ${parsed.data.type}`);
        this.handler?.(parsed.data);
      } catch {
        log.warn('[ws] unparseable server message');
      }
    };

    this.ws.onclose = () => {
      log.info('[ws] disconnected');
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Suppress noisy console errors — onclose will handle reconnect
      this.ws?.close();
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (msg.type !== 'player:move') log.debug(`[ws] send ${msg.type}`);
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect() {
    if (this.disabled) return;
    if (this.intentionallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.warn(`[ws] max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      console.log('[WS] Server unavailable — game works offline, connect server with `npm run dev`');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    this.reconnectAttempts++;
    log.info(`[ws] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }
}

export const gameSocket = new GameWebSocket();
