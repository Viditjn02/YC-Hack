/**
 * Convex activity logger — fire-and-forget event logging.
 * Sends agent activity events to Convex for the real-time dashboard.
 * Gracefully disabled if CONVEX_URL is not set.
 *
 * Uses raw HTTP POST to the Convex API instead of the generated client,
 * so it works without running `npx convex dev` first.
 */
import { log } from '../logger.js';

const CONVEX_URL = process.env['CONVEX_URL'];

if (CONVEX_URL) {
  log.info('Convex activity logger initialized');
} else {
  log.warn('CONVEX_URL not set — activity dashboard disabled');
}

interface ActivityEvent {
  userId: string;
  workspaceId: string;
  agentName: string;
  eventType: string;
  detail: string;
}

/**
 * Log an activity event to Convex. Fire-and-forget — never blocks or throws.
 */
export function logActivity(event: ActivityEvent): void {
  if (!CONVEX_URL) return;

  // Use Convex HTTP API to call the mutation directly
  const url = `${CONVEX_URL}/api/mutation`;
  const body = JSON.stringify({
    path: 'activity:log',
    args: event,
  });

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch((err) => {
    log.warn('[convex] activity log failed:', err);
  });
}
