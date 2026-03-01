import type { IncomingMessage, ServerResponse } from 'node:http';
import { composio } from '../ai/composio.js';
import { log } from '../logger.js';

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

export function handleComposioAuthRoutes(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/auth/composio/url' && req.method === 'GET') {
    const app = url.searchParams.get('app');
    const userId = url.searchParams.get('userId');

    if (!app || !userId) {
      jsonResponse(res, 400, { error: 'Missing required params: app, userId' });
      return true;
    }

    if (!composio) {
      jsonResponse(res, 503, { error: 'Composio not configured' });
      return true;
    }

    (async () => {
      try {
        const connRequest = await composio.connectedAccounts.initiate(userId, app, {
          callbackUrl: url.searchParams.get('callbackUrl') ?? undefined,
        });
        jsonResponse(res, 200, { redirectUrl: connRequest.redirectUrl });
      } catch (err) {
        log.error('Composio auth initiate error:', err);
        jsonResponse(res, 500, { error: 'Failed to initiate auth' });
      }
    })();

    return true;
  }

  if (path === '/auth/composio/status' && req.method === 'GET') {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      jsonResponse(res, 400, { error: 'Missing required param: userId' });
      return true;
    }

    if (!composio) {
      jsonResponse(res, 503, { error: 'Composio not configured' });
      return true;
    }

    (async () => {
      try {
        const accounts = await composio.connectedAccounts.list({ userIds: [userId], statuses: ['ACTIVE'] });
        const connections = accounts.items.map(a => ({
          id: a.id,
          toolkit: a.toolkit.slug,
          status: a.status,
        }));
        jsonResponse(res, 200, { connections });
      } catch (err) {
        log.error('Composio status error:', err);
        jsonResponse(res, 500, { error: 'Failed to fetch status' });
      }
    })();

    return true;
  }

  return false;
}
