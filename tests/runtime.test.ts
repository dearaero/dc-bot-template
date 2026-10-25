import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Events } from 'discord.js';
import { createRuntime } from '../src/core/runtime.ts';
import { services } from './helpers.ts';

void test('runtime login kullanır, error listener kaydeder ve idempotent kapanır', async (t) => {
  const context = services();
  const login = t.mock.method(context.client, 'login', () => Promise.resolve('test-secret'));
  const runtime = createRuntime(context);
  await runtime.start();
  assert.equal(login.mock.callCount(), 1);
  assert.deepEqual(login.mock.calls[0]?.arguments, ['test-secret']);
  context.client.emit(Events.Error, new Error('recoverable'));
  assert.match(context.logs.join(''), /recoverable/);
  const first = runtime.stop();
  assert.equal(runtime.stop(), first);
  await first;
  assert.equal(context.client.listenerCount(Events.InteractionCreate), 0);
  assert.equal(context.client.listenerCount(Events.Error), 0);
});

void test('başlangıç login hatası üst sınıra aktarılır, runtime temizlenebilir', async (t) => {
  const context = services();
  t.mock.method(context.client, 'login', () => Promise.reject(new Error('bad token')));
  const runtime = createRuntime(context);
  await assert.rejects(runtime.start(), /bad token/);
  await runtime.stop();
  assert.equal(context.client.listenerCount(Events.InteractionCreate), 0);
});
