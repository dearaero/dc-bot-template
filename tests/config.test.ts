import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.ts';
import { ConfigurationError } from '../src/core/errors.ts';

const valid = { DISCORD_TOKEN: 'private-token', DISCORD_APPLICATION_ID: '123456789012345678' };

void test('config geçerli değerleri tipli ve immutable döndürür', () => {
  const config = readConfig(valid);
  assert.equal(config.maxConcurrentInteractions, 100);
  assert.equal(config.guildId, undefined);
  assert.equal(config.environment, 'development');
  assert.equal(Object.isFrozen(config), true);
});

void test('config sorunları birlikte gösterir ve secret değerlerini yansıtmaz', () => {
  assert.throws(
    () =>
      readConfig({
        ...valid,
        DISCORD_APPLICATION_ID: 'private-token',
        LOG_LEVEL: 'wrong',
        SHUTDOWN_TIMEOUT_MS: '-1',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigurationError);
      assert.match(error.message, /DISCORD_APPLICATION_ID/);
      assert.match(error.message, /LOG_LEVEL/);
      assert.match(error.message, /SHUTDOWN_TIMEOUT_MS/);
      assert.doesNotMatch(error.message, /private-token/);
      return true;
    },
  );
});

void test('sınır dışı, boş ve kesirli sayılar reddedilir', () => {
  for (const value of ['', '0', '1.2', 'Infinity', '10001', 'abc']) {
    assert.throws(
      () => readConfig({ ...valid, MAX_CONCURRENT_INTERACTIONS: value }),
      ConfigurationError,
    );
  }
});

void test('boş token, hatalı ortam ve uint64 dışı snowflake reddedilir', () => {
  assert.throws(() => readConfig({ ...valid, DISCORD_TOKEN: ' ' }), ConfigurationError);
  assert.throws(() => readConfig({ ...valid, NODE_ENV: 'staging' }), ConfigurationError);
  assert.throws(
    () => readConfig({ ...valid, DISCORD_GUILD_ID: '99999999999999999999' }),
    ConfigurationError,
  );
});
