const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const authService = require('../src/services/auth.service');
const AppError = require('../src/utils/AppError');
const { prisma, cleanUsers, validBody } = require('./helpers/db');

before(cleanUsers);
beforeEach(cleanUsers);
after(async () => {
  await cleanUsers();
  await prisma.$disconnect();
});

async function rejects(promise, status, message) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${err}`);
    assert.strictEqual(err.status, status);
    assert.strictEqual(err.message, message);
    return true;
  });
}

test('register: creates a client, hashes the password, returns token + public user', async () => {
  const body = validBody({ email: 'Mixed.Case@AuthTest.Example', mobile: '0999 000 0001' });
  const { token, user } = await authService.register(body);

  assert.ok(token);
  assert.deepStrictEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'mobile', 'name', 'role']);
  assert.strictEqual(user.email, 'mixed.case@authtest.example');
  assert.strictEqual(user.mobile, '+639990000001');
  assert.strictEqual(user.role, 'client');

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  assert.notStrictEqual(row.passwordHash, body.password);
  assert.ok(await bcrypt.compare(body.password, row.passwordHash));
  assert.strictEqual(bcrypt.getRounds(row.passwordHash), 10);
});

test('register: role is always client and body extras are ignored', async () => {
  const { user } = await authService.register(
    validBody({ role: 'admin', id: '00000000-0000-0000-0000-000000000000', passwordHash: 'x' })
  );
  assert.strictEqual(user.role, 'client');
  assert.notStrictEqual(user.id, '00000000-0000-0000-0000-000000000000');
});

test('register: trims name, mobile and email but not the password', async () => {
  const body = validBody({ name: '  Juan   Cruz ', password: '  spaced pass  ' });
  body.email = ` ${body.email} `;
  const { user } = await authService.register(body);
  assert.strictEqual(user.name, 'Juan Cruz');

  const login = await authService.login({ identifier: user.email, password: '  spaced pass  ' });
  assert.strictEqual(login.user.id, user.id);
  await rejects(authService.login({ identifier: user.email, password: 'spaced pass' }), 401, 'Invalid credentials');
});

test('register: missing, empty, whitespace or non-string fields -> 400 required', async () => {
  const msg = 'Name, mobile, email and password are required';
  await rejects(authService.register(undefined), 400, msg);
  await rejects(authService.register({}), 400, msg);
  for (const field of ['name', 'mobile', 'email', 'password']) {
    await rejects(authService.register(validBody({ [field]: undefined })), 400, msg);
    await rejects(authService.register(validBody({ [field]: '' })), 400, msg);
    await rejects(authService.register(validBody({ [field]: 123 })), 400, msg);
  }
  await rejects(authService.register(validBody({ name: '   ' })), 400, msg);
});

test('register: field validation messages', async () => {
  await rejects(authService.register(validBody({ name: '1234' })), 400, 'Invalid name');
  await rejects(authService.register(validBody({ email: 'dan@test' })), 400, 'Invalid email format');
  await rejects(authService.register(validBody({ mobile: '9171234567' })), 400, 'Invalid mobile number');
  await rejects(authService.register(validBody({ password: '1234567' })), 400, 'Password must be at least 8 characters');
  await rejects(authService.register(validBody({ password: 'a'.repeat(73) })), 400, 'Password must be at most 72 bytes');
  await rejects(authService.register(validBody({ password: 'é'.repeat(37) })), 400, 'Password must be at most 72 bytes');
  await rejects(authService.register(validBody({ password: 'password\u0000' })), 400, 'Invalid password');
});

test('register: duplicate email -> 409, including a different-case variant', async () => {
  const first = validBody({ email: 'dan@authtest.example' });
  await authService.register(first);

  await rejects(
    authService.register(validBody({ email: 'dan@authtest.example' })),
    409,
    'Email already registered'
  );
  await rejects(
    authService.register(validBody({ email: 'DAN@AUTHTEST.EXAMPLE' })),
    409,
    'Email already registered'
  );
});

test('register: duplicate mobile -> 409, including every written form of the same number', async () => {
  await authService.register(validBody({ mobile: '09171234567' }));

  for (const variant of ['09171234567', '+63 917 123 4567', '+639171234567', '639171234567', '0917-123-4567']) {
    await rejects(
      authService.register(validBody({ mobile: variant })),
      409,
      'Mobile number already registered'
    );
  }
});

test('register: parallel requests for the same email cannot both succeed (P2002 path)', async () => {
  const email = 'race@authtest.example';
  const results = await Promise.allSettled([
    authService.register(validBody({ email })),
    authService.register(validBody({ email })),
    authService.register(validBody({ email })),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(ok.length, 1);
  assert.strictEqual(failed.length, 2);
  for (const f of failed) {
    assert.ok(f.reason instanceof AppError, String(f.reason));
    assert.strictEqual(f.reason.status, 409);
    assert.strictEqual(f.reason.message, 'Email already registered');
  }
});

test('register: parallel requests for the same mobile cannot both succeed', async () => {
  const mobile = '09171230000';
  const results = await Promise.allSettled([
    authService.register(validBody({ mobile })),
    authService.register(validBody({ mobile: '+63 917 123 0000' })),
  ]);

  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
  const failure = results.find((r) => r.status === 'rejected');
  assert.strictEqual(failure.reason.status, 409);
  assert.strictEqual(failure.reason.message, 'Mobile number already registered');
});

test('login: by email (any case) and by mobile in every written form', async () => {
  const body = validBody({ mobile: '09171234567' });
  const { user } = await authService.register(body);

  for (const identifier of [body.email, body.email.toUpperCase(), `  ${body.email}  `]) {
    const r = await authService.login({ identifier, password: body.password });
    assert.strictEqual(r.user.id, user.id);
    assert.ok(r.token);
  }
  for (const identifier of ['09171234567', '+639171234567', '639171234567', '0917 123 4567']) {
    const r = await authService.login({ identifier, password: body.password });
    assert.strictEqual(r.user.id, user.id);
  }
});

test('login: result never contains the password hash', async () => {
  const body = validBody();
  await authService.register(body);
  const r = await authService.login({ identifier: body.email, password: body.password });
  assert.ok(!JSON.stringify(r).toLowerCase().includes('passwordhash'));
  assert.ok(!JSON.stringify(r).includes('$2'));
});

test('login: missing, empty or non-string identifier/password -> 400', async () => {
  const msg = 'Identifier and password are required';
  await rejects(authService.login(undefined), 400, msg);
  await rejects(authService.login({}), 400, msg);
  await rejects(authService.login({ identifier: 'a@authtest.example' }), 400, msg);
  await rejects(authService.login({ password: 'x' }), 400, msg);
  await rejects(authService.login({ identifier: '', password: 'x' }), 400, msg);
  await rejects(authService.login({ identifier: 'a@authtest.example', password: '' }), 400, msg);
  await rejects(authService.login({ identifier: 123, password: 'x' }), 400, msg);
  await rejects(authService.login({ identifier: 'a@authtest.example', password: 123 }), 400, msg);
  await rejects(authService.login({ identifier: {}, password: [] }), 400, msg);
});

test('login: wrong password and unknown account give the SAME 401', async () => {
  const body = validBody();
  await authService.register(body);

  const wrongPassword = await authService
    .login({ identifier: body.email, password: 'wrong-password' })
    .catch((e) => e);
  const unknownEmail = await authService
    .login({ identifier: 'nobody@authtest.example', password: 'wrong-password' })
    .catch((e) => e);
  const unknownMobile = await authService
    .login({ identifier: '09990999999', password: 'wrong-password' })
    .catch((e) => e);

  for (const err of [wrongPassword, unknownEmail, unknownMobile]) {
    assert.ok(err instanceof AppError);
    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.message, 'Invalid credentials');
  }
});

test('login: malformed identifier -> the same 401, not a format hint', async () => {
  for (const identifier of ['not an identifier', 'dan@test', '12345', '<script>', 'dan@@test.com', 'a\u0000b']) {
    await rejects(authService.login({ identifier, password: 'whatever1' }), 401, 'Invalid credentials');
  }
});

test('login: password over 72 bytes cannot match a stored 72-byte prefix', async () => {
  const body = validBody({ password: 'a'.repeat(72) });
  await authService.register(body);
  await rejects(
    authService.login({ identifier: body.email, password: `${'a'.repeat(72)}extra` }),
    401,
    'Invalid credentials'
  );
});

test('login: an unknown account still costs a bcrypt compare (no fast path)', async () => {
  const body = validBody();
  await authService.register(body);

  const time = async (identifier) => {
    const start = process.hrtime.bigint();
    await authService.login({ identifier, password: 'wrong-password' }).catch(() => {});
    return Number(process.hrtime.bigint() - start) / 1e6;
  };

  const unknown = await time('nobody@authtest.example');
  const malformed = await time('not an identifier');
  // Cost 10 is tens of milliseconds. A skipped compare would finish in a few.
  assert.ok(unknown > 15, `unknown account returned in ${unknown}ms, compare was probably skipped`);
  assert.ok(malformed > 15, `malformed identifier returned in ${malformed}ms, compare was probably skipped`);
});

test('getUserFromToken: valid token returns the user; garbage and deleted users give 401 Unauthorized', async () => {
  const { token, user } = await authService.register(validBody());
  assert.strictEqual((await authService.getUserFromToken(token)).id, user.id);

  await rejects(authService.getUserFromToken('garbage'), 401, 'Unauthorized');

  await prisma.user.delete({ where: { id: user.id } });
  await rejects(authService.getUserFromToken(token), 401, 'Unauthorized');
});
