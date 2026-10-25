import type { ClientEvents } from 'discord.js';
import type { BotEvent, Services } from './contracts.ts';

/** EventEmitter async rejection'ları dahil tüm modül olaylarını sınırlar. */
export function defineEvent<K extends keyof ClientEvents>(definition: {
  name: K;
  once?: boolean;
  execute(services: Services, ...args: ClientEvents[K]): void | Promise<void>;
}): BotEvent {
  return {
    name: definition.name,
    bind(services) {
      const listener = (...args: ClientEvents[K]): void => {
        void Promise.resolve()
          .then(() => definition.execute(services, ...args))
          .catch((error: unknown) => {
            services.logger.error('Modül olayı başarısız.', { event: definition.name, error });
          });
      };
      if (definition.once) services.client.once(definition.name, listener);
      else services.client.on(definition.name, listener);
      return () => {
        services.client.off(definition.name, listener);
      };
    },
  };
}
