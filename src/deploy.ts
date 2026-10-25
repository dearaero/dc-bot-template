import { REST, Routes } from 'discord.js';
import { readConfig } from './config.ts';
import { createLogger } from './core/logger.ts';
import { Registry } from './core/registry.ts';
import { modules } from './modules/index.ts';

const logger = createLogger('info', [process.env.DISCORD_TOKEN ?? '']);
try {
  const args = process.argv.slice(2);
  const scope = args[0];
  if (
    !['guild', 'global'].includes(scope ?? '') ||
    args.some((arg, index) => index > 0 && arg !== '--allow-empty') ||
    args.length > 2
  ) {
    throw new Error('Kullanım: npm run deploy -- guild|global [--allow-empty]');
  }
  const config = readConfig(process.env);
  const registry = new Registry(modules);
  const body = [...registry.commands.values()].map((command) => command.data.toJSON());
  if (body.length === 0 && !args.includes('--allow-empty'))
    throw new Error('Boş komut listesi için --allow-empty gerekli.');
  if (scope === 'guild' && !config.guildId)
    throw new Error('Guild dağıtımı için DISCORD_GUILD_ID gerekli.');
  const route =
    scope === 'guild'
      ? Routes.applicationGuildCommands(config.applicationId, config.guildId!)
      : Routes.applicationCommands(config.applicationId);
  // Bulk overwrite yalnızca bu uygulamanın seçili scope içindeki komutlarını değiştirir.
  const rest = new REST({ version: '10', timeout: 15_000, retries: 3 }).setToken(config.token);
  await rest.put(route, { body });
  logger.info('Komutlar kaydedildi.', { scope, count: body.length });
} catch (error) {
  logger.error('Komut dağıtımı başarısız.', { error });
  process.exitCode = 1;
}
