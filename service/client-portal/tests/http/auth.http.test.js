const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../../src/app');
const { prisma, cleanUsers, validBody } = require('../helpers/db');

before(cleanUsers);
beforeEach(cleanUsers);
after(async () => {
  await cleanUsers();
  await prisma.$disconnect();
});

const register = (body) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);

// Hash material must never appear in any response, success or error.
function assertNoHash(res) {
  const text = JSON.stringify(res.body).toLowerCase();
  assert.ok(!text.includes('password_hash'), 'password_hash leaked');
  assert.ok(!text.includes('passwordhash'), 'passwordHash leaked');
  assert.ok(!text.includes('$2a$') && !text.includes('$2b$'), 'bcrypt hash leaked');
}

test('POST /register 201: message, token, public user', async () => {
  const body = validBody();
  const res = await register(body);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.message, 'Registration successful');
  assert.strictEqual(typeof res.body.token, 'string');
  assert.deepStrictEqual(Object.keys(res.body.user).sort(), ['createdAt', 'email', 'id', 'mobile', 'name', 'role']);
  assert.strictEqual(res.body.user.email, body.email);
  assert.strictEqual(res.body.user.role, 'client');
  assert.ok(!('password' in res.body.user));
  assertNoHash(res);
});

test('POST /register: "role":"admin" and other extras in the body are ignored', async () => {
  const res = await register(validBody({ role: 'admin', id: 'abc', status: 'approved', clientId: 'x' }));
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.role, 'client');
  assert.notStrictEqual(res.body.user.id, 'abc');

  const row = await prisma.user.findUnique({ where: { id: res.body.user.id } });
  assert.strictEqual(row.role, 'client');
});

test('POST /register: email is stored lowercase, mobile as +639XXXXXXXXX', async () => {
  const res = await register(validBody({ email: 'DAN@AUTHTEST.EXAMPLE', mobile: '0917 123 4567' }));
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.email, 'dan@authtest.example');
  assert.strictEqual(res.body.user.mobile, '+639171234567');
});

test('POST /register 400: every validation message', async () => {
  const cases = [
    [{ name: undefined }, 'Name, mobile, email and password are required'],
    [{ mobile: '' }, 'Name, mobile, email and password are required'],
    [{ email: 5 }, 'Name, mobile, email and password are required'],
    [{ password: null }, 'Name, mobile, email and password are required'],
    [{ name: '<script>' }, 'Invalid name'],
    [{ email: 'dan@test' }, 'Invalid email format'],
    [{ mobile: '0817123456' }, 'Invalid mobile number'],
    [{ password: '1234567' }, 'Password must be at least 8 characters'],
    [{ password: 'a'.repeat(73) }, 'Password must be at most 72 bytes'],
    [{ password: 'pass\u0000word1' }, 'Invalid password'],
  ];
  for (const [override, message] of cases) {
    const res = await register(validBody(override));
    assert.strictEqual(res.status, 400, JSON.stringify(override));
    assert.deepStrictEqual(res.body, { error: message }, JSON.stringify(override));
  }
});

test('POST /register 400: empty body, no body and malformed JSON', async () => {
  const empty = await register({});
  assert.strictEqual(empty.status, 400);
  assert.strictEqual(empty.body.error, 'Name, mobile, email and password are required');

  const none = await request(app).post('/api/v1/auth/register');
  assert.strictEqual(none.status, 400);
  assert.strictEqual(none.body.error, 'Name, mobile, email and password are required');

  const bad = await request(app)
    .post('/api/v1/auth/register')
    .set('Content-Type', 'application/json')
    .send('{"name": ');
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.body.error, 'Invalid JSON');
});

test('POST /register 409: duplicate email, then duplicate mobile (normalized variants)', async () => {
  await register(validBody({ email: 'dan@authtest.example', mobile: '09171234567' }));

  const dupEmail = await register(validBody({ email: 'DAN@AUTHTEST.EXAMPLE' }));
  assert.strictEqual(dupEmail.status, 409);
  assert.deepStrictEqual(dupEmail.body, { error: 'Email already registered' });

  const dupMobile = await register(validBody({ mobile: '+63 917 123 4567' }));
  assert.strictEqual(dupMobile.status, 409);
  assert.deepStrictEqual(dupMobile.body, { error: 'Mobile number already registered' });
});

test('POST /login 200: by email and by mobile, same shape as register', async () => {
  const body = validBody({ mobile: '09171234567' });
  const reg = await register(body);

  for (const identifier of [body.email, '09171234567', '+639171234567']) {
    const res = await login({ identifier, password: body.password });
    assert.strictEqual(res.status, 200, identifier);
    assert.strictEqual(res.body.message, 'Login successful');
    assert.strictEqual(typeof res.body.token, 'string');
    assert.strictEqual(res.body.user.id, reg.body.user.id);
    assert.deepStrictEqual(Object.keys(res.body.user).sort(), ['createdAt', 'email', 'id', 'mobile', 'name', 'role']);
    assertNoHash(res);
  }
});

test('POST /login 400: missing, empty or non-string fields', async () => {
  const msg = { error: 'Identifier and password are required' };
  for (const body of [{}, { identifier: 'a@b.co' }, { password: 'x' }, { identifier: '', password: 'x' }, { identifier: 1, password: 'x' }]) {
    const res = await login(body);
    assert.strictEqual(res.status, 400, JSON.stringify(body));
    assert.deepStrictEqual(res.body, msg);
  }
  const none = await request(app).post('/api/v1/auth/login');
  assert.strictEqual(none.status, 400);
});

test('POST /login 401: wrong password, unknown account and malformed identifier are identical', async () => {
  const body = validBody();
  await register(body);

  const attempts = [
    { identifier: body.email, password: 'wrong-password' },
    { identifier: 'nobody@authtest.example', password: body.password },
    { identifier: '09990999999', password: body.password },
    { identifier: 'not an email or mobile', password: body.password },
  ];
  const responses = [];
  for (const attempt of attempts) {
    const res = await login(attempt);
    assert.strictEqual(res.status, 401, JSON.stringify(attempt.identifier));
    assert.deepStrictEqual(res.body, { error: 'Invalid credentials' });
    assertNoHash(res);
    responses.push(res.text);
  }
  assert.strictEqual(new Set(responses).size, 1, 'responses must be byte-identical');
});

test('error responses never include a token or user', async () => {
  const res = await login({ identifier: 'nobody@authtest.example', password: 'wrong-password' });
  assert.deepStrictEqual(Object.keys(res.body), ['error']);
});
