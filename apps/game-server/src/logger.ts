import { createLogger } from '@bossroom/shared-utils';

export const log = createLogger(process.env['LOG_LEVEL']);
