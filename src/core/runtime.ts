import { Events, RESTEvents } from 'discord.js';
import type { Services } from './contracts.ts';
import { InteractionRouter } from './router.ts';

export function createRuntime(services: Services) {
  const { client, logger, registry } = services;
  const router = new InteractionRouter(services);
  const unbind = registry.events.map((event) => event.bind(services));
  client.on(Events.InteractionCreate, router.handle);
  const onError = (error: Error): void => {
    logger.error('Discord istemci hatası.', { error });
  };
  const onWarn = (message: string): void => {
    logger.warn('Discord istemci uyarısı.', { detail: message });
  };
  const onShardError = (error: Error, shardId: number): void => {
    logger.error('Gateway shard hatası.', { error, shardId });
  };
  const onRateLimit = (data: { route: string; timeToReset: number; global: boolean }): void => {
    logger.warn('Discord REST hız sınırı.', {
      route: data.route,
      retryAfterMs: data.timeToReset,
      global: data.global,
    });
  };
  client.on(Events.Error, onError);
  client.on(Events.Warn, onWarn);
  client.on(Events.ShardError, onShardError);
  client.rest.on(RESTEvents.RateLimited, onRateLimit);
  let stopping: Promise<void> | undefined;

  return {
    start: async (): Promise<void> => {
      await client.login(services.config.token);
      logger.info('Gateway oturumu başlatıldı.', {
        commands: registry.commands.size,
        components: registry.components.size,
      });
    },
    stop: (): Promise<void> => {
      stopping ??= (async () => {
        client.off(Events.InteractionCreate, router.handle);
        if (!(await router.drain(services.config.shutdownTimeoutMs)))
          logger.warn('Kapanış süresi doldu.', { pending: router.pending });
        for (const dispose of unbind) dispose();
        await client.destroy();
        client.off(Events.Error, onError);
        client.off(Events.Warn, onWarn);
        client.off(Events.ShardError, onShardError);
        client.rest.off(RESTEvents.RateLimited, onRateLimit);
        logger.info('Bot kapatıldı.');
      })();
      return stopping;
    },
  };
}
