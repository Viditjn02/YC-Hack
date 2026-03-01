type Level = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;

export function createLogger(levelName: string = 'DEBUG') {
  const currentLevel =
    LEVELS[levelName.toUpperCase() as Level] ?? LEVELS.DEBUG;

  function timestamp() {
    return new Date().toISOString();
  }

  function serialize(data: unknown): string {
    if (data instanceof Error) {
      const obj: Record<string, unknown> = {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
      if (data.cause) obj.cause = String(data.cause);
      return JSON.stringify(obj);
    }
    // Handle AI SDK and other errors that embed an Error as a property
    if (data && typeof data === 'object' && 'message' in data) {
      return JSON.stringify(data);
    }
    if (data === undefined) return '';
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  function format(level: Level, msg: string, data?: unknown): string {
    const d = data !== undefined ? ` ${serialize(data)}` : '';
    return `${timestamp()} [${level}] ${msg}${d}`;
  }

  return {
    error(msg: string, data?: unknown) {
      if (currentLevel >= LEVELS.ERROR) console.error(format('ERROR', msg, data));
    },
    warn(msg: string, data?: unknown) {
      if (currentLevel >= LEVELS.WARN) console.warn(format('WARN', msg, data));
    },
    info(msg: string, data?: unknown) {
      if (currentLevel >= LEVELS.INFO) console.info(format('INFO', msg, data));
    },
    debug(msg: string, data?: unknown) {
      if (currentLevel >= LEVELS.DEBUG) console.debug(format('DEBUG', msg, data));
    },
  };
}
