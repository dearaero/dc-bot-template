import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { BotModule, Command, Component } from '../../core/contracts.ts';
import { UserError } from '../../core/errors.ts';

function assertOwner(customId: string, userId: string): void {
  if (customId.split(':')[1] !== userId)
    throw new UserError('Bu bileşen başka bir kullanıcıya ait.', 'NOT_OWNER');
}

const example = {
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

const form = {
  kind: 'button',
  key: 'form',
  acknowledgement: 'manual',
  cooldownMs: 3_000,
  async execute(interaction) {
    assertOwner(interaction.customId, interaction.user.id);
    const modal = new ModalBuilder()
      .setCustomId(`feedback:${interaction.user.id}`)
      .setTitle('Örnek form')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Mesajınız')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1_000),
        ),
      );
    await interaction.showModal(modal);
  },
} satisfies Component<'button'>;

const feedback = {
  kind: 'modal',
  key: 'feedback',
  acknowledgement: 'reply',
  cooldownMs: 3_000,
  async execute(interaction) {
    assertOwner(interaction.customId, interaction.user.id);
    const text = interaction.fields.getTextInputValue('message').trim();
    if (!text || text.length > 1_000)
      throw new UserError('Mesaj 1–1000 karakter olmalı.', 'INVALID_INPUT');
    await interaction.editReply({
      content: `Form işlendi. Örnek girdiniz:\n${text}`,
      allowedMentions: { parse: [] },
    });
  },
} satisfies Component<'modal'>;

const topic = {
  kind: 'select',
  key: 'topic',
  acknowledgement: 'reply',
  cooldownMs: 1_000,
  async execute(interaction) {
    assertOwner(interaction.customId, interaction.user.id);
    const descriptions: Record<string, string> = {
      commands:
        'src/modules altında Command sözleşmesine uyan bir komut oluşturun ve modül manifestine ekleyin.',
      errors:
        'Beklenen iş kuralı hatalarında UserError fırlatın. Beklenmeyen hatalar merkezi olarak loglanır ve takip koduyla yanıtlanır.',
      cancellation:
        'Uzun işlemlerde context.signal kullanın. fetch(url, { signal }) ile süre aşımı ve kapanış iptaline uyun.',
    };
    const description = descriptions[interaction.values[0] ?? ''];
    if (!description) throw new UserError('Geçersiz seçim.', 'INVALID_SELECTION');
    await interaction.editReply(description);
  },
} satisfies Component<'select'>;

export const exampleModule = {
  name: 'example',
  commands: [example],
  components: [form, feedback, topic],
} satisfies BotModule;
