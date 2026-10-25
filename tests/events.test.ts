import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Events } from 'discord.js';
import { defineEvent } from '../src/core/events.ts';
import { services } from './helpers.ts';

void test('event async/sync hataları yakalanır ve listener kaldırılır', async () => {
  const context = services();
  const unbind = defineEvent({
    name: Events.Warn,
    execute() {
      throw new Error('event-failure');
    },
  }).bind(context);
  context.client.emit(Events.Warn, 'test');
  await setImmediate();
  assert.match(context.logs.join(''), /event-failure/);
  unbind();
  assert.equal(context.client.listenerCount(Events.Warn), 0);
  await context.client.destroy();
});

void test('once event yalnızca bir kez çalışır', async () => {
  const context = services();
  let count = 0;
  const unbind = defineEvent({
    name: Events.Warn,
    once: true,
    execute() {
      count++;
    },
  }).bind(context);
  context.client.emit(Events.Warn, 'a');
  context.client.emit(Events.Warn, 'b');
  await setImmediate();
  assert.equal(count, 1);
  unbind();
  await context.client.destroy();
});
