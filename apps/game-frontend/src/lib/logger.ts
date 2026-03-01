import { createLogger } from '@bossroom/shared-utils';

export const log = createLogger(process.env['NEXT_PUBLIC_LOG_LEVEL'] ?? 'DEBUG');
