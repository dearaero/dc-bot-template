import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Cooldowns } from '../src/core/cooldowns.ts';
import { UserError } from '../src/core/errors.ts';

void test('cooldown kullanıcıları ayırır ve tam süresinde sona erer', () => {
  let now = 0;
  const cooldowns = new Cooldowns(10, () => now);
  assert.equal(cooldowns.consume('a', 1_000), 0);
  now = 300;
  assert.equal(cooldowns.consume('a', 1_000), 700);
  assert.equal(cooldowns.consume('b', 1_000), 0);
  now = 1_000;
  assert.equal(cooldowns.consume('a', 1_000), 0);
});

void test('kapasite aşımı bellek büyütmez, süresi dolan girişler kapasiteyi açar', () => {
  let now = 0;
  const cooldowns = new Cooldowns(1, () => now);
  cooldowns.consume('a', 100);
  assert.throws(() => cooldowns.consume('b', 100), UserError);
  now = 100;
  assert.equal(cooldowns.consume('b', 100), 0);
  cooldowns.clear();
  assert.equal(cooldowns.consume('c', 100), 0);
});
