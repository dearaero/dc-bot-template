import { readConfig } from './config.ts';
import { createClient } from './core/client.ts';
import { createLogger } from './core/logger.ts';
import { Registry } from './core/registry.ts';
import { createRuntime } from './core/runtime.ts';
import { modules } from './modules/index.ts';

let logger = createLogger('info', [process.env.DISCORD_TOKEN ?? '']);
let stop: (() => Promise<void>) | undefined;
let stopping = false;

async function shutdown(reason: string, exitCode: number): Promise<void> {
  process.exitCode = Math.max(Number(process.exitCode ?? 0), exitCode);
  if (stopping) return;
  stopping = true;
  logger.info('Kapanış başlatıldı.', { reason });
  // Takılı kalan üçüncü taraf işlerini süreç seviyesinde sınırlandırır.
  const hardLimit = setTimeout(() => process.exit(Number(process.exitCode ?? 1)), 65_000);
  hardLimit.unref();
  try {
    await stop?.();
  } catch (error) {
    logger.fatal('Kapanış sırasında hata.', { error });
    process.exitCode = 1;
  } finally {
    process.exit(Number(process.exitCode ?? 0));
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT', 0);
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM', 0);
});
process.on('unhandledRejection', (error) => {
  logger.fatal('Yakalanmamış Promise rejection.', { error });
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal('Yakalanmamış süreç hatası.', { error });
  // Süreç durumu güvenilir değildir; async recovery/cleanup başlatılmaz.
  process.exit(1);
});

try {
  const config = readConfig(process.env);
  logger = createLogger(config.logLevel, [config.token]);
  const registry = new Registry(modules);
  const runtime = createRuntime({ config, logger, client: createClient(), registry });
  stop = runtime.stop;
  await runtime.start();
} catch (error) {
  logger.fatal('Bot başlatılamadı.', { error });
  await shutdown('startup', 1);
}
