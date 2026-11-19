const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { jwtSecret } = require('../../src/config/env');
const { prisma, cleanUsers, validBody } = require('../helpers/db');

before(cleanUsers);
beforeEach(cleanUsers);
after(async () => {
  await cleanUsers();
  await prisma.$disconnect();
});

const me = (authorization) => {
  const req = request(app).get('/api/v1/auth/me');
  return authorization === undefined ? req : req.set('Authorization', authorization);
};

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send(validBody());
  return { token: res.body.token, user: res.body.user };
}

function assertUnauthorized(res) {
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(res.body, { error: 'Unauthorized' });
}

test('GET /me 200: valid token returns the user, never the hash', async () => {
  const { token, user } = await registerUser();
  const res = await me(`Bearer ${token}`);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { user });
  const text = JSON.stringify(res.body).toLowerCase();
  assert.ok(!text.includes('password'));
});

test('GET /me: a token from login works the same as one from register', async () => {
  const body = validBody();
  await request(app).post('/api/v1/auth/register').send(body);
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: body.email, password: body.password });

  const res = await me(`Bearer ${loginRes.body.token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.email, body.email);
});

test('GET /me 401: no Authorization header', async () => {
  assertUnauthorized(await me());
});

test('GET /me 401: malformed Authorization header', async () => {
  const { token } = await registerUser();
  for (const header of [
    '', 'Bearer', 'Bearer ', token, `Basic ${token}`, `bearer ${token}`,
    `Bearer  ${token}`, `Bearer ${token} extra`, `Token ${token}`,
  ]) {
    assertUnauthorized(await me(header));
  }
});

test('GET /me 401: garbage, tampered and wrong-secret tokens', async () => {
  const { token, user } = await registerUser();

  assertUnauthorized(await me('Bearer garbage'));
  assertUnauthorized(await me('Bearer a.b.c'));

  const [head, payload, signature] = token.split('.');
  assertUnauthorized(await me(`Bearer ${head}.${payload}.${signature.slice(0, -2)}xx`));

  const wrongSecret = jwt.sign({ sub: user.id, role: 'client' }, 'z'.repeat(40), { algorithm: 'HS256' });
  assertUnauthorized(await me(`Bearer ${wrongSecret}`));
});

test('GET /me 401: unsigned "alg: none" token and other algorithms are refused', async () => {
  const { user } = await registerUser();
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, role: 'admin' })}.`;
  assertUnauthorized(await me(`Bearer ${none}`));

  const hs512 = jwt.sign({ sub: user.id, role: 'client' }, jwtSecret, { algorithm: 'HS512' });
  assertUnauthorized(await me(`Bearer ${hs512}`));
});

test('GET /me 401: expired token', async () => {
  const { user } = await registerUser();
  const expired = jwt.sign(
    { sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) - 60 },
    jwtSecret,
    { algorithm: 'HS256' }
  );
  assertUnauthorized(await me(`Bearer ${expired}`));
});

test('GET /me 401: token for a user that was deleted', async () => {
  const { token, user } = await registerUser();
  assert.strictEqual((await me(`Bearer ${token}`)).status, 200);

  await prisma.user.delete({ where: { id: user.id } });
  assertUnauthorized(await me(`Bearer ${token}`));
});

test('GET /me 401: valid signature but sub is missing or not a UUID', async () => {
  for (const claims of [{ role: 'client' }, { sub: 'not-a-uuid', role: 'client' }, { sub: 123, role: 'client' }, { sub: "1' OR '1'='1", role: 'client' }]) {
    const token = jwt.sign(claims, jwtSecret, { algorithm: 'HS256' });
    assertUnauthorized(await me(`Bearer ${token}`));
  }
});

test('GET /me: identity comes only from the token, never URL or body', async () => {
  const a = await registerUser();
  const b = await registerUser();

  const res = await request(app)
    .get(`/api/v1/auth/me?id=${b.user.id}&userId=${b.user.id}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ id: b.user.id, sub: b.user.id });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.id, a.user.id);
});

test('GET /me: role in the token is not trusted, the database role is returned', async () => {
  const { user } = await registerUser();
  const forged = jwt.sign({ sub: user.id, role: 'admin' }, jwtSecret, { algorithm: 'HS256' });

  const res = await me(`Bearer ${forged}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.role, 'client');
});
