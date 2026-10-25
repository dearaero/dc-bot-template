import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogger, logContext } from '../src/core/logger.ts';

void test('log seviyesi filtrelenir ve async context korunur', async () => {
  const lines: string[] = [];
  const logger = createLogger('info', [], (line) => {
    lines.push(line);
  });
  logger.debug('gizli debug');
  await logContext.run({ requestId: 'req-1' }, async () => {
    await Promise.resolve();
    logger.info('ok');
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /"requestId":"req-1"/);
});

void test('secret, nested token, webhook ve interaction URL bilgileri maskelenir', () => {
  const lines: string[] = [];
  const logger = createLogger('debug', ['top-secret'], (line) => {
    lines.push(line);
  });
  logger.error('top-secret', {
    error: new Error(
      'https://discord.com/api/v10/webhooks/123/hidden-webhook-token /interactions/456/hidden-interaction-token/callback Bot hidden-authorization-token',
      { cause: new Error('top-secret') },
    ),
    nested: { authorization: 'abc-secret', accessToken: 'nested-secret' },
  });
  const output = lines.join('');
  for (const secret of [
    'top-secret',
    'hidden-webhook-token',
    'hidden-interaction-token',
    'hidden-authorization-token',
    'abc-secret',
    'nested-secret',
  ])
    assert.equal(output.includes(secret), false);
  assert.match(output, /REDACTED/);
  assert.match(output, /cause/);
});

void test('circular ve bigint log alanları süreç çökertmez', () => {
  const lines: string[] = [];
  const logger = createLogger('info', [], (line) => {
    lines.push(line);
  });
  const circular: Record<string, unknown> = { id: 3n };
  circular.self = circular;
  logger.info('ok', circular);
  assert.match(lines[0]!, /Circular/);
  assert.match(lines[0]!, /"3"/);
});

void test('normal Bot mesajları credential sanılıp bozulmaz', () => {
  const lines: string[] = [];
  createLogger('info', [], (line) => {
    lines.push(line);
  }).info('Bot kapatıldı.');
  assert.match(lines[0]!, /Bot kapatıldı/);
});
