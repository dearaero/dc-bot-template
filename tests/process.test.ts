import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DISCORD_TOKEN: 'process-test-secret',
  DISCORD_APPLICATION_ID: '123456789012345678',
  DISCORD_GUILD_ID: '123456789012345679',
};

function run(code: string, overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    cwd: new URL('..', import.meta.url),
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 5_000,
  });
}

const boot = `
  import { Client } from 'discord.js';
  Client.prototype.login = async () => 'mock';
  await import('./src/index.ts');
`;

void test('CLI yapılandırma hatasında API bağlantısı kurmadan kod 1 ile çıkar', () => {
  const result = run("await import('./src/index.ts');", { DISCORD_TOKEN: '' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DISCORD_TOKEN/);
});

void test('SIGTERM kaynak temizliği sonrası kod 0 ile kapanır', () => {
  const result = run(`${boot} process.kill(process.pid, 'SIGTERM'); setTimeout(() => {}, 1000);`);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Bot kapatıldı/);
});

void test('fatal exception ve rejection maskelenmiş logla kod 1 üretir', () => {
  for (const action of [
    "setImmediate(() => { throw new Error('process-test-secret fatal-exception'); });",
    "void Promise.reject(new Error('process-test-secret fatal-rejection'));",
  ]) {
    const result = run(`${boot} ${action}`);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"level":"fatal"/);
    assert.doesNotMatch(result.stderr, /process-test-secret/);
    assert.doesNotMatch(result.stdout, /Bot kapatıldı/);
  }
});

void test('deploy scope ve guild ID kontrolü ağ çağrısından önce başarısız olur', () => {
  for (const args of [['global'], ['guild'], ['wrong-scope']]) {
    const result = run(
      `process.argv = ['node', 'deploy.ts', ...${JSON.stringify(args)}]; await import('./src/deploy.ts');`,
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dağıtımı başarısız/);
    assert.doesNotMatch(result.stderr, /process-test-secret/);
  }
  const missingGuild = run("await import('./src/deploy.ts');", { DISCORD_GUILD_ID: '' });
  assert.equal(missingGuild.status, 1);
  assert.match(missingGuild.stderr, /DISCORD_GUILD_ID/);
});

void test('deploy tüm komutları yalnızca yapılandırılmış sunucunun route’una yazar', () => {
  const result = run(`
    import { REST } from 'discord.js';
    REST.prototype.put = async (route, options) => {
      console.log(JSON.stringify({ route, count: options.body.length }));
      return [];
    };
    process.argv = ['node', 'deploy.ts'];
    await import('./src/deploy.ts');
  `);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /\/applications\/123456789012345678\/guilds\/123456789012345679\/commands/,
  );
  assert.match(result.stdout, /"count":5/);
});
