import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/contracts.ts';
import { UserError } from '../../core/errors.ts';

export const server = {
  data: new SlashCommandBuilder()
    .setName('sunucu')
    .setDescription('Sunucu bilgilerini gösterir (Sunucuyu Yönet izni gerekir).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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
