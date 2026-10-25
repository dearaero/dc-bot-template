import { REST, Routes } from 'discord.js';
import { readConfig } from './config.ts';
import { commands } from './commands/index.ts';
import { createLogger } from './core/logger.ts';
import { Registry } from './core/registry.ts';
import { modules } from './modules/index.ts';

const logger = createLogger('info', [process.env.DISCORD_TOKEN ?? '']);
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== '--allow-empty')) {
    throw new Error('Kullanım: npm run deploy [-- --allow-empty]');
  }
  const config = readConfig(process.env);
  const registry = new Registry(modules, commands);
  const body = [...registry.commands.values()].map((command) => command.data.toJSON());
  if (body.length === 0 && !args.includes('--allow-empty'))
    throw new Error('Boş komut listesi için --allow-empty gerekli.');
  const route = Routes.applicationGuildCommands(config.applicationId, config.guildId);
  // Bulk overwrite yalnızca yapılandırılmış sunucudaki uygulama komutlarını değiştirir.
  const rest = new REST({ version: '10', timeout: 15_000, retries: 3 }).setToken(config.token);
  await rest.put(route, { body });
  logger.info('Komutlar kaydedildi.', { guildId: config.guildId, count: body.length });
} catch (error) {
  logger.error('Komut dağıtımı başarısız.', { error });
  process.exitCode = 1;
}
