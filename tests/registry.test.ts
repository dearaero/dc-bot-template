import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Events, SlashCommandBuilder } from 'discord.js';
import { Registry } from '../src/core/registry.ts';
import { defineEvent } from '../src/core/events.ts';
import { modules } from '../src/modules/index.ts';

const command = {
  data: new SlashCommandBuilder().setName('test').setDescription('Test komutu'),
  execute: () => Promise.resolve(),
};

void test('gerçek modüller kaydolur ve slash payloadları serialize edilir', () => {
  const registry = new Registry(modules);
  assert.equal(registry.commands.size, 5);
  assert.equal(registry.components.size, 3);
  for (const entry of registry.commands.values()) assert.ok(entry.data.toJSON().description);
  assert.equal(registry.component('button', 'form:123')?.kind, 'button');
  assert.equal(registry.component('modal', 'form:123'), undefined);
});

void test('duplicate modül ve komutlar başlangıçta reddedilir', () => {
  assert.throws(() => new Registry([{ name: 'a' }, { name: 'a' }]), /modül/);
  assert.throws(() => new Registry([{ name: 'a', commands: [command, command] }]), /komut/);
});

void test('geçersiz cooldown ve çekirdek interaction listener kaydı reddedilir', () => {
  assert.throws(
    () => new Registry([{ name: 'a', commands: [{ ...command, cooldownMs: NaN }] }]),
    /cooldownMs/,
  );
  assert.throws(
    () =>
      new Registry([
        {
          name: 'a',
          events: [
            defineEvent({
              name: Events.InteractionCreate,
              execute() {
                /* guarded */
              },
            }),
          ],
        },
      ]),
    /çekirdek/,
  );
});

void test('duplicate/geçersiz component ve modal update stratejisi reddedilir', () => {
  const component = { kind: 'button' as const, key: 'test', execute: () => Promise.resolve() };
  assert.throws(
    () => new Registry([{ name: 'a', components: [component, component] }]),
    /Tekrarlanan/,
  );
  assert.throws(
    () => new Registry([{ name: 'a', components: [{ ...component, key: 'bad:key' }] }]),
    /Geçersiz/,
  );
  assert.throws(
    () =>
      new Registry([
        { name: 'a', components: [{ ...component, kind: 'modal', acknowledgement: 'update' }] },
      ]),
    /Modal/,
  );
});
