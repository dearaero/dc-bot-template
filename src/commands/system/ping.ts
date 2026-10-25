import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../core/contracts.ts';

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
