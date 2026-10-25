import { Events } from 'discord.js';
import type { BotModule } from '../../core/contracts.ts';
import { defineEvent } from '../../core/events.ts';

export const systemModule = {
  name: 'system',
  events: [
    defineEvent({
      name: Events.ClientReady,
      once: true,
      execute({ logger, config }, client) {
        logger.info('Bot hazır.', { user: client.user.tag, guildId: config.guildId });
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
