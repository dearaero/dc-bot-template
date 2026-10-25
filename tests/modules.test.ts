import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import { InteractionRouter } from '../src/core/router.ts';
import { modules } from '../src/modules/index.ts';
import { commands } from '../src/commands/index.ts';
import { interaction, services, settled } from './helpers.ts';

void test('temel örnek komutların tamamı gerçek handler üzerinden sonuç verir', async () => {
  const context = services({ modules, commands });
  const router = new InteractionRouter(context);
  for (const name of ['ping', 'bilgi', 'yardim', 'ornek', 'sunucu']) {
    const i = interaction();
    i.fake.commandName = name;
    i.fake.memberPermissions.add(PermissionFlagsBits.ManageGuild);
    router.handle(i.value);
    await settled(router);
    assert.deepEqual(
      i.calls.map((call) => call.method),
      ['deferReply', 'editReply'],
    );
    assert.doesNotMatch(JSON.stringify(i.calls), /Takip kodu/);
  }
  assert.equal(
    context.logs.some((line) => line.includes('"level":"error"')),
    false,
  );
});

void test('yardım autocomplete kayıtlı komutları filtreler', async () => {
  const router = new InteractionRouter(services({ modules, commands }));
  const i = interaction('autocomplete');
  i.fake.commandName = 'yardim';
  i.fake.options.getFocused = () => 'pin';
  router.handle(i.value);
  await settled(router);
  assert.deepEqual(i.calls[0]?.payload, [{ name: '/ping', value: 'ping' }]);
});

void test('form butonu defer olmadan modal açar; başka kullanıcı reddedilir', async () => {
  for (const owner of ['123456789012345680', 'someone-else']) {
    const router = new InteractionRouter(services({ modules, commands }));
    const i = interaction('button');
    i.fake.customId = `form:${owner}`;
    router.handle(i.value);
    await settled(router);
    assert.equal(i.calls[0]?.method, owner === i.fake.user.id ? 'showModal' : 'reply');
    if (owner === i.fake.user.id)
      assert.match(JSON.stringify(i.calls), /feedback:123456789012345680/);
  }
});

void test('modal mesajı işler; boş içerik iş kuralı hatası üretir', async () => {
  for (const message of ['Merhaba', '   ']) {
    const router = new InteractionRouter(services({ modules, commands }));
    const i = interaction('modal');
    i.fake.customId = `feedback:${i.fake.user.id}`;
    i.fake.fields.getTextInputValue = () => message;
    router.handle(i.value);
    await settled(router);
    assert.equal(i.calls[0]?.method, 'deferReply');
    const payload = JSON.stringify(i.calls.at(-1)?.payload);
    assert.match(payload, message.trim() ? /Form işlendi/ : /1–1000/);
    assert.doesNotMatch(payload, /Takip kodu/);
  }
});

void test('menü bilinen seçimi işler ve bilinmeyen değeri reddeder', async () => {
  for (const value of ['commands', 'invalid']) {
    const router = new InteractionRouter(services({ modules, commands }));
    const i = interaction('select');
    i.fake.customId = `topic:${i.fake.user.id}`;
    i.fake.values = [value];
    router.handle(i.value);
    await settled(router);
    assert.match(
      JSON.stringify(i.calls.at(-1)?.payload),
      value === 'commands' ? /manifestine/ : /Geçersiz seçim/,
    );
  }
});
