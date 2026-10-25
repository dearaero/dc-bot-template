import { ConfigurationError } from './core/errors.ts';

export const logLevels = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof logLevels)[number];

export interface Config {
  readonly token: string;
  readonly applicationId: string;
  readonly guildId: string;
  readonly environment: 'development' | 'test' | 'production';
  readonly logLevel: LogLevel;
  readonly maxConcurrentInteractions: number;
  readonly handlerTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
}

/** Saf fonksiyon: import sırasında process.env okunmaz, bağlantı kurulmaz. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = [];
  const token = env.DISCORD_TOKEN?.trim() ?? '';
  if (!token || /\s/.test(token)) problems.push('DISCORD_TOKEN dolu ve boşluksuz olmalı.');

  function snowflake(key: string): string | undefined {
    const value = env[key]?.trim();
    if (!value || !/^\d{17,20}$/.test(value) || BigInt(value) > 18_446_744_073_709_551_615n) {
      problems.push(`${key} geçerli bir Discord ID olmalı.`);
    }
    return value;
  }

  function integer(key: string, fallback: number, min: number, max: number): number {
    const raw = env[key];
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      problems.push(`${key}, ${min}–${max} aralığında tam sayı olmalı.`);
    }
    return value;
  }

  const applicationId = snowflake('DISCORD_APPLICATION_ID');
  const guildId = snowflake('DISCORD_GUILD_ID');
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)) {
    problems.push('NODE_ENV: development, test veya production olmalı.');
  }
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!logLevels.includes(logLevel as LogLevel)) problems.push('LOG_LEVEL geçerli değil.');
  const maxConcurrentInteractions = integer('MAX_CONCURRENT_INTERACTIONS', 100, 1, 10_000);
  const handlerTimeoutMs = integer('HANDLER_TIMEOUT_MS', 30_000, 100, 120_000);
  const shutdownTimeoutMs = integer('SHUTDOWN_TIMEOUT_MS', 10_000, 100, 60_000);
  if (problems.length) throw new ConfigurationError(problems);

  return Object.freeze({
    token,
    applicationId: applicationId!,
    guildId: guildId!,
    environment: environment as Config['environment'],
    logLevel: logLevel as LogLevel,
    maxConcurrentInteractions,
    handlerTimeoutMs,
    shutdownTimeoutMs,
  });
}
