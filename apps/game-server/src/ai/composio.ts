import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import type { ToolSet } from 'ai';
import { log } from '../logger.js';

const COMPOSIO_API_KEY = process.env['COMPOSIO_API_KEY'];

let composio: Composio<VercelProvider> | null = null;

if (COMPOSIO_API_KEY) {
  composio = new Composio({ apiKey: COMPOSIO_API_KEY, provider: new VercelProvider() });
  log.info('Composio initialized');
} else {
  log.warn('COMPOSIO_API_KEY not set — Composio tools disabled');
}

export async function getComposioTools(userId: string): Promise<ToolSet> {
  if (!composio) return {};
  try {
    const session = await composio.create(userId);
    return await session.tools();
  } catch (err) {
    log.error('Failed to fetch Composio tools:', err);
    return {};
  }
}

export { composio };
