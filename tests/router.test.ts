import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, Component } from '../src/core/contracts.ts';
import { UserError } from '../src/core/errors.ts';
import { InteractionRouter } from '../src/core/router.ts';
import { interaction, services, settled } from './helpers.ts';

function command(overrides: Partial<Command> = {}): Command {
  return {
    data: new SlashCommandBuilder().setName('test').setDescription('Test komutu'),
    async execute(i) {
      await i.editReply('ok');
    },
    ...overrides,
  };
}

void test('komut execute öncesinde ephemeral defer edilir', async () => {
  const context = services({ commands: [command()] });
  const router = new InteractionRouter(context);
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  assert.deepEqual(
    i.calls.map((call) => call.method),
    ['deferReply', 'editReply'],
  );
  assert.deepEqual(i.calls[0]?.payload, { flags: 64 });
});

void test('bilinmeyen komut güvenli ve ephemeral yanıt alır', async () => {
  const router = new InteractionRouter(services());
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  assert.equal(i.calls[0]?.method, 'reply');
  assert.match(JSON.stringify(i.calls[0]?.payload), /mevcut değil/);
});

void test('beklenmeyen hata loglanır; kullanıcı secret/stack yerine takip kodu alır', async () => {
  const context = services({
    commands: [
      command({
        execute() {
          throw new Error('test-secret failure');
        },
      }),
    ],
  });
  const router = new InteractionRouter(context);
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  const payload = JSON.stringify(i.calls.at(-1)?.payload);
  assert.match(payload, /Takip kodu/);
  assert.doesNotMatch(payload, /test-secret/);
  assert.doesNotMatch(context.logs.join(''), /test-secret/);
  assert.match(context.logs.join(''), /requestId/);
});

void test('UserError mesajı gösterilir, yanıt sonrası hata followUp kullanır', async () => {
  const context = services({
    commands: [
      command({
        async execute(i) {
          await i.editReply('önceki sonuç');
          throw new UserError('İş kuralı.', 'RULE');
        },
      }),
    ],
  });
  const router = new InteractionRouter(context);
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  assert.equal(i.calls.at(-1)?.method, 'followUp');
  assert.match(JSON.stringify(i.calls.at(-1)?.payload), /İş kuralı/);
});

void test('hata yanıtının kendisi başarısızsa tekrar yanıt döngüsü oluşmaz', async () => {
  const context = services();
  const router = new InteractionRouter(context);
  const i = interaction();
  i.fake.reply = () => Promise.reject(new Error('expired'));
  router.handle(i.value);
  await settled(router);
  assert.match(context.logs.join(''), /expired/);
});

void test('kullanıcı ve bot izin kontrolleri execute çağrısını engeller', async () => {
  for (const policy of [
    { userPermissions: PermissionFlagsBits.ManageGuild },
    { botPermissions: PermissionFlagsBits.SendMessages },
  ]) {
    let executed = false;
    const context = services({
      commands: [
        command({
          ...policy,
          execute() {
            executed = true;
            return Promise.resolve();
          },
        }),
      ],
    });
    const router = new InteractionRouter(context);
    const i = interaction();
    router.handle(i.value);
    await settled(router);
    assert.equal(executed, false);
    assert.equal(i.calls[0]?.method, 'reply');
  }
});

void test('aynı kullanıcının eşzamanlı komutları cooldown atlayamaz', async () => {
  const router = new InteractionRouter(services({ commands: [command({ cooldownMs: 10_000 })] }));
  const a = interaction();
  const b = interaction();
  router.handle(a.value);
  router.handle(b.value);
  await settled(router);
  assert.equal(a.calls[0]?.method, 'deferReply');
  assert.match(JSON.stringify(b.calls[0]?.payload), /saniye bekleyin/);
});

void test('autocomplete failure boş listeyle yanıtlanır; yetkisiz handler çalışmaz', async () => {
  for (const permissions of [undefined, PermissionFlagsBits.ManageGuild]) {
    let called = false;
    const entry = command({
      ...(permissions === undefined ? {} : { userPermissions: permissions }),
      autocomplete() {
        called = true;
        throw new Error('autocomplete failure');
      },
    });
    const router = new InteractionRouter(services({ commands: [entry] }));
    const i = interaction('autocomplete');
    router.handle(i.value);
    await settled(router);
    assert.equal(called, permissions === undefined);
    assert.deepEqual(i.calls, [{ method: 'respond', payload: [] }]);
  }
});

void test('button update hatası kaynak mesaj yerine ephemeral followUp üretir', async () => {
  const component: Component<'button'> = {
    kind: 'button',
    key: 'test',
    acknowledgement: 'update',
    execute() {
      throw new UserError('Bileşen hatası.');
    },
  };
  const router = new InteractionRouter(
    services({ modules: [{ name: 'test', components: [component] }] }),
  );
  const i = interaction('button');
  router.handle(i.value);
  await settled(router);
  assert.deepEqual(
    i.calls.map((call) => call.method),
    ['deferUpdate', 'followUp'],
  );
});

void test('manual handler onay vermezse merkez güvenli hata yanıtı üretir', async () => {
  const router = new InteractionRouter(
    services({
      commands: [command({ acknowledgement: 'manual', execute: () => Promise.resolve() })],
    }),
  );
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  assert.match(JSON.stringify(i.calls), /Takip kodu/);
});

void test('kapanış aktif işe abort sinyali verir ve yeni iş kabul etmez', async () => {
  let receivedSignal: AbortSignal | undefined;
  const router = new InteractionRouter(
    services({
      commands: [
        command({
          execute(_i, { signal }) {
            receivedSignal = signal;
            return new Promise<void>((resolve) => {
              signal.addEventListener(
                'abort',
                () => {
                  resolve();
                },
                { once: true },
              );
            });
          },
        }),
      ],
    }),
  );
  router.handle(interaction().value);
  await setImmediate();
  assert.equal(router.pending, 1);
  assert.equal(await router.drain(100), true);
  assert.equal(receivedSignal?.aborted, true);
  const after = interaction();
  router.handle(after.value);
  assert.equal(router.pending, 0);
  assert.equal(after.calls.length, 0);
});

void test('kapasite sınırı aşılmaz; iptale uymayan işte drain sonlu sürede döner', async () => {
  let release: (() => void) | undefined;
  const router = new InteractionRouter(
    services(
      {
        commands: [
          command({
            execute: () =>
              new Promise<void>((resolve) => {
                release = resolve;
              }),
          }),
        ],
      },
      { maxConcurrentInteractions: 1 },
    ),
  );
  router.handle(interaction().value);
  const rejected = interaction();
  router.handle(rejected.value);
  await setImmediate();
  assert.equal(router.pending, 1);
  assert.equal(rejected.calls.length, 0);
  assert.equal(await router.drain(5), false);
  release?.();
  await settled(router);
});

void test('defer sonrası nihai yanıt vermeyen komutun spinnerı hata ile tamamlanır', async () => {
  const router = new InteractionRouter(
    services({ commands: [command({ execute: () => Promise.resolve() })] }),
  );
  const i = interaction();
  router.handle(i.value);
  await settled(router);
  assert.deepEqual(
    i.calls.map((call) => call.method),
    ['deferReply', 'editReply'],
  );
  assert.match(JSON.stringify(i.calls.at(-1)?.payload), /Takip kodu/);
});

void test('kooperatif handler süre aşımında iptal edilir ve güvenli yanıt alır', async () => {
  const router = new InteractionRouter(
    services(
      {
        commands: [
          command({
            execute(_i, { signal }) {
              return new Promise<void>((_resolve, reject) => {
                signal.addEventListener(
                  'abort',
                  () => {
                    reject(new Error('aborted', { cause: signal.reason }));
                  },
                  { once: true },
                );
              });
            },
          }),
        ],
      },
      { handlerTimeoutMs: 5 },
    ),
  );
  const i = interaction();
  router.handle(i.value);
  // Deadline timerı unref'tir; test süresince event loop'u açık tut.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 15);
  });
  await settled(router);
  assert.match(JSON.stringify(i.calls.at(-1)?.payload), /Takip kodu/);
});

void test('DM ve yabancı sunucuda komut, autocomplete ve tüm bileşen handler’ları engellenir', async () => {
  for (const guildId of [null, '123456789012345699']) {
    for (const kind of ['command', 'autocomplete', 'button', 'select', 'modal'] as const) {
      let executions = 0;
      const executed = () => {
        executions++;
        return Promise.resolve();
      };
      const context = services({
        commands: [command({ execute: executed, autocomplete: executed })],
        modules: [
          {
            name: 'guard',
            components: [
              { kind: 'button', key: 'test', execute: executed },
              { kind: 'select', key: 'test', execute: executed },
              { kind: 'modal', key: 'test', execute: executed },
            ],
          },
        ],
      });
      const router = new InteractionRouter(context);
      const i = interaction(kind);
      i.fake.guildId = guildId;
      router.handle(i.value);
      await settled(router);
      assert.equal(executions, 0);
      assert.equal(i.calls.length, 1);
      assert.equal(i.calls[0]?.method, kind === 'autocomplete' ? 'respond' : 'reply');
      if (kind === 'autocomplete') assert.deepEqual(i.calls[0]?.payload, []);
      else assert.match(JSON.stringify(i.calls[0]?.payload), /yapılandırılmış sunucuda/);
    }
  }
});
