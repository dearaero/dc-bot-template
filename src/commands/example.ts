import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { Command } from '../core/contracts.ts';

export const example = {
  data: new SlashCommandBuilder()
    .setName('ornek')
    .setDescription('Buton, modal ve seçim menüsü örneğini açar.'),
  cooldownMs: 5_000,
  async execute(interaction) {
    await interaction.editReply({
      content: 'Modüler etkileşim örneği. Form girdileri yalnızca size gösterilir; kaydedilmez.',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`form:${interaction.user.id}`)
            .setLabel('Form aç')
            .setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`topic:${interaction.user.id}`)
            .setPlaceholder('Bir konu seçin')
            .addOptions(
              { label: 'Komut eklemek', value: 'commands' },
              { label: 'Hata yönetimi', value: 'errors' },
              { label: 'İptal sinyali', value: 'cancellation' },
            ),
        ),
      ],
    });
  },
} satisfies Command;
