import { AsyncLocalStorage } from 'node:async_hooks';
import { writeSync } from 'node:fs';
import { logLevels, type LogLevel } from '../config.ts';

type Fields = Readonly<Record<string, unknown>>;
export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
  fatal(message: string, fields?: Fields): void;
}

export const logContext = new AsyncLocalStorage<Fields>();

/** Native JSON logları: süreç yöneticisi stdout/stderr üzerinden toplar. */
export function createLogger(
  minimum: LogLevel,
  secrets: readonly string[] = [],
  sink: (line: string, level: LogLevel) => void = (line, level) => {
    if (level === 'fatal') {
      writeSync(process.stderr.fd, `${line}\n`);
      return;
    }
    (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`);
  },
): Logger {
  const knownSecrets = secrets.filter(Boolean);
  function clean(value: string): string {
    for (const secret of knownSecrets) value = value.replaceAll(secret, '[REDACTED]');
    return value
      .replace(/(\/webhooks\/\d+\/)[^\s/?"\\]+/g, '$1[REDACTED]')
      .replace(/(\/interactions\/\d+\/)[^\s/?"\\]+/g, '$1[REDACTED]')
      .replace(/(Bot |Bearer )[A-Za-z0-9._-]{20,}/g, '$1[REDACTED]');
  }

  function serialize(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
    if (typeof value === 'string') return clean(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    if (depth > 8) return '[MaxDepth]';
    seen.add(value);
    if (value instanceof Error) {
      return serialize(
        {
          name: value.name,
          message: value.message,
          stack: value.stack,
          cause: value.cause,
          code: 'code' in value ? value.code : undefined,
          status: 'status' in value ? value.status : undefined,
        },
        seen,
        depth + 1,
      );
    }
    if (Array.isArray(value)) return value.map((item) => serialize(item, seen, depth + 1));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /token|password|secret|authorization/i.test(key)
          ? '[REDACTED]'
          : serialize(item, seen, depth + 1),
      ]),
    );
  }

  function write(level: LogLevel, message: string, fields: Fields = {}): void {
    if (logLevels.indexOf(level) < logLevels.indexOf(minimum)) return;
    try {
      sink(
        JSON.stringify(
          serialize({
            ...logContext.getStore(),
            ...fields,
            time: new Date().toISOString(),
            level,
            message,
          }),
        ),
        level,
      );
    } catch {
      // Log serileştirmesi hata yönetimi yolunu tekrar çökertebilmemeli.
      sink(JSON.stringify({ level: 'error', message: 'Log kaydı serileştirilemedi.' }), 'error');
    }
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    fatal: (message, fields) => write('fatal', message, fields),
  };
}
