import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { Client, GatewayIntentBits, PermissionsBitField, type Interaction } from 'discord.js';
import { readConfig } from '../src/config.ts';
import type { BotModule, Services } from '../src/core/contracts.ts';
import { createLogger } from '../src/core/logger.ts';
import { Registry } from '../src/core/registry.ts';
import type { InteractionRouter } from '../src/core/router.ts';

export function services(
  modules: readonly BotModule[] = [],
  overrides: Partial<Services['config']> = {},
) {
  const logs: string[] = [];
  return {
    client: new Client({ intents: [GatewayIntentBits.Guilds] }),
    config: {
      ...readConfig({ DISCORD_TOKEN: 'test-secret', DISCORD_APPLICATION_ID: '123456789012345678' }),
      ...overrides,
    },
    logger: createLogger('debug', ['test-secret'], (line) => {
      logs.push(line);
    }),
    registry: new Registry(modules),
    logs,
  } satisfies Services & { logs: string[] };
}

type Kind = 'command' | 'autocomplete' | 'button' | 'select' | 'modal' | 'context';
export function interaction(kind: Kind = 'command') {
  const calls: { method: string; payload: unknown }[] = [];
  const fake = {
    id: '123456789012345678',
    guildId: '123456789012345679' as string | null,
    user: { id: '123456789012345680' },
    commandName: 'test',
    customId: 'test:123456789012345680',
    options: {
      getString: (): string | null => null,
      getFocused: (): string => '',
    },
    fields: { getTextInputValue: (): string => 'Merhaba' },
    values: ['commands'],
    guild: { name: 'Test sunucusu', id: '123456789012345679', memberCount: 42 },
    createdTimestamp: Date.now(),
    memberPermissions: new PermissionsBitField(),
    appPermissions: new PermissionsBitField(),
    deferred: false,
    replied: false,
    responded: false,
    ephemeral: null as boolean | null,
    isAutocomplete: () => kind === 'autocomplete',
    isChatInputCommand: () => kind === 'command',
    isButton: () => kind === 'button',
    isStringSelectMenu: () => kind === 'select',
    isModalSubmit: () => kind === 'modal',
    isMessageComponent: () => kind === 'button' || kind === 'select',
    isRepliable: () => kind !== 'autocomplete',
    deferReply(payload: { flags?: number } = {}) {
      calls.push({ method: 'deferReply', payload });
      fake.deferred = true;
      fake.ephemeral = Boolean(payload.flags);
      return Promise.resolve();
    },
    deferUpdate() {
      calls.push({ method: 'deferUpdate', payload: undefined });
      fake.deferred = true;
      return Promise.resolve();
    },
    editReply(payload: unknown) {
      calls.push({ method: 'editReply', payload });
      fake.replied = true;
      return Promise.resolve();
    },
    reply(payload: unknown) {
      calls.push({ method: 'reply', payload });
      fake.replied = true;
      return Promise.resolve();
    },
    followUp(payload: unknown) {
      calls.push({ method: 'followUp', payload });
      return Promise.resolve();
    },
    respond(payload: unknown) {
      calls.push({ method: 'respond', payload });
      fake.responded = true;
      return Promise.resolve();
    },
    showModal(payload: unknown) {
      calls.push({ method: 'showModal', payload });
      fake.replied = true;
      return Promise.resolve();
    },
  };
  return { fake, value: fake as unknown as Interaction, calls };
}

export async function settled(router: InteractionRouter): Promise<void> {
  for (let count = 0; count < 100 && router.pending > 0; count++) await setImmediate();
  assert.equal(router.pending, 0, 'Router test işi tamamlanmalı.');
}
