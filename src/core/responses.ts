import { MessageFlags, type RepliableInteraction } from 'discord.js';
import { UserError } from './errors.ts';
import type { Logger } from './logger.ts';

export async function reportInteractionError(
  interaction: RepliableInteraction,
  error: unknown,
  requestId: string,
  logger: Logger,
): Promise<void> {
  const expected = error instanceof UserError;
  if (expected) logger.info('İstek reddedildi.', { code: error.code });
  else logger.error('Etkileşim işlenemedi.', { error });
  const content = expected
    ? error.message
    : `İşlem sırasında bir hata oluştu. Takip kodu: ${requestId}`;
  const payload = { content, allowedMentions: { parse: [] as never[] } };
  try {
    if (
      interaction.deferred &&
      !interaction.replied &&
      interaction.isMessageComponent() &&
      interaction.ephemeral === null
    ) {
      // deferUpdate kaynak mesajı onaylar; hata o mesajın içeriğini değiştirmemeli.
      await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    } else if (interaction.deferred && !interaction.replied) {
      // Başarısız işlem önceki embed/bileşenleri sonuç gibi göstermesin.
      await interaction.editReply({ ...payload, embeds: [], components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  } catch (responseError) {
    // Süresi bitmiş/silinmiş etkileşime ikinci bir fallback denenmez.
    logger.warn('Hata yanıtı Discord’a iletilemedi.', { error: responseError });
  }
}
