import { Events } from 'discord.js';
import type { BotModule } from '../../core/contracts.ts';
import { defineEvent } from '../../core/events.ts';
import { help, info, ping, server } from './commands.ts';

export const systemModule = {
  name: 'system',
  commands: [ping, info, help, server],
  events: [
    defineEvent({
      name: Events.ClientReady,
      once: true,
      execute({ logger }, client) {
        logger.info('Bot hazır.', { user: client.user.tag, guilds: client.guilds.cache.size });
      },
    }),
    defineEvent({
      name: Events.ShardReconnecting,
      execute({ logger }, shardId) {
        logger.warn('Gateway yeniden bağlanıyor.', { shardId });
      },
    }),
    defineEvent({
      name: Events.ShardResume,
      execute({ logger }, shardId, replayedEvents) {
        logger.info('Gateway oturumu sürdürüldü.', { shardId, replayedEvents });
      },
    }),
  ],
} satisfies BotModule;
