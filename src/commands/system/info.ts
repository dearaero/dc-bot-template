import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/contracts.ts';

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
        { name: 'Sunucu', value: interaction.guild?.name ?? 'Bilinmiyor', inline: true },
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
