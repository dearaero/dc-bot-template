import { Client, GatewayIntentBits, Options } from 'discord.js';

export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: false },
    failIfNotExists: false,
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 0,
      PresenceManager: 0,
      ReactionManager: 0,
      VoiceStateManager: 0,
      GuildMemberManager: {
        maxSize: 100,
        keepOverLimit: (member) => member.id === member.client.user.id,
      },
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      guildMembers: {
        interval: 300,
        filter: () => (member) => member.id !== member.client.user.id,
      },
    },
    rest: { timeout: 15_000, retries: 3 },
  });
}
