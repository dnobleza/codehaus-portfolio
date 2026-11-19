// env.js runs at require time, so each case loads it in a fresh child process
// with a fully controlled environment (the real .env.test is not inherited).
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SECRET = 'x'.repeat(32);
// A recognizable fake password, to prove the URL is never printed.
const FAKE_DB_PASSWORD = 'fakepassword123';
const TEST_DB = `postgresql://user:${FAKE_DB_PASSWORD}@localhost:5432/app_test`;

function loadEnv(overrides) {
  const env = {
    PORT: '3001',
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    JWT_SECRET: SECRET,
    ...overrides,
  };
  // Drop keys set to undefined so "missing" can be tested.
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];

  const result = spawnSync(
    process.execPath,
    ['-e', "console.log(JSON.stringify(require('./src/config/env')))"],
    { cwd: ROOT, env, encoding: 'utf8' }
  );
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

test('valid config loads, JWT_EXPIRES defaults to 1d', () => {
  const r = loadEnv({});
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(r.stdout).jwtExpires, '1d');
});

test('JWT_SECRET is required', () => {
  const r = loadEnv({ JWT_SECRET: undefined });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /JWT_SECRET is required/);
});

test('JWT_SECRET shorter than 32 characters is refused', () => {
  const r = loadEnv({ JWT_SECRET: 'x'.repeat(31) });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /JWT_SECRET must be at least 32 characters/);
});

test('JWT_SECRET of exactly 32 characters is accepted', () => {
  assert.strictEqual(loadEnv({ JWT_SECRET: 'x'.repeat(32) }).status, 0);
});

test('JWT_EXPIRES accepts seconds as a number and unit forms', () => {
  assert.strictEqual(JSON.parse(loadEnv({ JWT_EXPIRES: '3600' }).stdout).jwtExpires, 3600);
  for (const ok of ['30s', '15m', '2h', '7d']) {
    assert.strictEqual(loadEnv({ JWT_EXPIRES: ok }).status, 0, ok);
  }
});

test('JWT_EXPIRES rejects bad values', () => {
  for (const bad of ['0', 'abc', '1w', '-5', '1.5h', '1 d', '0d']) {
    const r = loadEnv({ JWT_EXPIRES: bad });
    assert.notStrictEqual(r.status, 0, bad);
    assert.match(r.stderr, /JWT_EXPIRES/, bad);
  }
});

test('NODE_ENV=test refuses a database whose name does not end with _test', () => {
  const r = loadEnv({ DATABASE_URL: `postgresql://user:${FAKE_DB_PASSWORD}@localhost:5432/app_dev` });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /_test/);
});

test('the guard never prints the database URL or password', () => {
  const r = loadEnv({ DATABASE_URL: `postgresql://user:${FAKE_DB_PASSWORD}@localhost:5432/app_dev` });
  assert.ok(!r.output.includes(FAKE_DB_PASSWORD));
  assert.ok(!r.output.includes('postgresql://'));
});

test('the guard also covers a trailing query string and does not match _test elsewhere', () => {
  assert.strictEqual(loadEnv({ DATABASE_URL: `${TEST_DB}?schema=public` }).status, 0);
  const r = loadEnv({ DATABASE_URL: `postgresql://user:p@localhost:5432/app_dev?note=x_test` });
  assert.notStrictEqual(r.status, 0);
});

test('outside NODE_ENV=test the database name is not checked', () => {
  const r = loadEnv({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@localhost:5432/app_dev' });
  assert.strictEqual(r.status, 0, r.stderr);
});
