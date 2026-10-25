import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../core/contracts.ts';
import { UserError } from '../../core/errors.ts';

export const ping = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Gateway ve yanıt gecikmesini gösterir.'),
  cooldownMs: 3_000,
  async execute(interaction, { client }) {
    await interaction.editReply(
      `Pong! Gateway: ${client.ws.ping < 0 ? 'ölçülüyor' : `${Math.round(client.ws.ping)} ms`} · İlk onay: ${Date.now() - interaction.createdTimestamp} ms`,
    );
  },
} satisfies Command;

export const info = {
  data: new SlashCommandBuilder()
    .setName('bilgi')
    .setDescription('Botun çalışma durumunu gösterir.'),
  cooldownMs: 5_000,
  async execute(interaction, { client }) {
    const uptime = Math.floor((client.uptime ?? 0) / 1_000);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Bot durumu')
      .addFields(
        {
          name: 'Çalışma süresi',
          value: `${Math.floor(uptime / 3_600)} sa ${Math.floor(uptime / 60) % 60} dk ${uptime % 60} sn`,
          inline: true,
        },
        { name: 'Sunucular (bu süreç)', value: String(client.guilds.cache.size), inline: true },
        {
          name: 'Bellek (RSS)',
          value: `${Math.round(process.memoryUsage().rss / 1_048_576)} MiB`,
          inline: true,
        },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
} satisfies Command;

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

export const server = {
  data: new SlashCommandBuilder()
    .setName('sunucu')
    .setDescription('Sunucu bilgilerini gösterir (Sunucuyu Yönet izni gerekir).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  guildOnly: true,
  userPermissions: PermissionFlagsBits.ManageGuild,
  cooldownMs: 5_000,
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild)
      throw new UserError('Sunucu önbellekte bulunamadı. Tekrar deneyin.', 'GUILD_UNAVAILABLE');
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Sunucu bilgisi')
          .addFields(
            { name: 'Ad', value: guild.name },
            { name: 'ID', value: guild.id },
            { name: 'Üye sayısı', value: String(guild.memberCount) },
          ),
      ],
    });
  },
} satisfies Command;
