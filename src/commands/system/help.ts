import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/contracts.ts';
import { UserError } from '../../core/errors.ts';

export const help = {
  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Komutları listeler veya bir komutu açıklar.')
    .addStringOption((option) =>
      option.setName('komut').setDescription('Komut adı').setAutocomplete(true),
    ),
  cooldownMs: 2_000,
  async autocomplete(interaction, { registry }) {
    const query = interaction.options.getFocused().toLocaleLowerCase('tr');
    const names = [...registry.commands.keys()].filter((name) => name.includes(query)).slice(0, 25);
    await interaction.respond(names.map((name) => ({ name: `/${name}`, value: name })));
  },
  async execute(interaction, { registry }) {
    const selected = interaction.options.getString('komut');
    if (selected && !registry.commands.has(selected))
      throw new UserError('Böyle bir komut bulunamadı.', 'UNKNOWN_COMMAND');
    const commands = selected
      ? [registry.commands.get(selected)!]
      : [...registry.commands.values()];
    // Discord'un 2000 karakter sınırına göre listeyi sayfalara böl.
    const lines = commands.map((command) => {
      const data = command.data.toJSON();
      return `**/${data.name}** — ${data.description}`;
    });
    const pages: string[] = [];
    let page = '';
    for (const line of lines) {
      if (page.length + line.length + 1 > 1_900) {
        pages.push(page);
        page = '';
      }
      page += `${line}\n`;
    }
    if (page) pages.push(page);
    await interaction.editReply(pages[0] ?? 'Kayıtlı komut yok.');
    for (const content of pages.slice(1))
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  },
} satisfies Command;
