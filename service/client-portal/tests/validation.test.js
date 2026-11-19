const { test } = require('node:test');
const assert = require('node:assert');
const {
  isNonEmptyString,
  parseName,
  parseEmail,
  parseMobile,
  passwordProblem,
} = require('../src/utils/validation');

test('isNonEmptyString', () => {
  assert.ok(isNonEmptyString('a'));
  assert.ok(!isNonEmptyString(''));
  assert.ok(!isNonEmptyString('   '));
  assert.ok(isNonEmptyString('   ', { trim: false }));
  for (const v of [undefined, null, 5, {}, [], true]) assert.ok(!isNonEmptyString(v));
});

test('parseName: valid examples', () => {
  assert.strictEqual(parseName('Juan Dela Cruz'), 'Juan Dela Cruz');
  assert.strictEqual(parseName('Maria-Clara Santos'), 'Maria-Clara Santos');
  assert.strictEqual(parseName('Jose Rizal Jr.'), 'Jose Rizal Jr.');
  assert.strictEqual(parseName("Nino D'Souza"), "Nino D'Souza");
  assert.strictEqual(parseName("Niño D'Souza"), "Niño D'Souza");
});

test('parseName: trims and collapses inner spaces', () => {
  assert.strictEqual(parseName('  Juan    Dela   Cruz  '), 'Juan Dela Cruz');
});

test('parseName: length limits after normalizing', () => {
  assert.strictEqual(parseName('Jo'), 'Jo');
  assert.strictEqual(parseName('a'.repeat(100)), 'a'.repeat(100));
  assert.strictEqual(parseName('a'.repeat(101)), null);
  assert.strictEqual(parseName('J'), null);
  assert.strictEqual(parseName('  J  '), null);
});

test('parseName: invalid examples', () => {
  for (const bad of ['J', '1234', '--Juan', 'Juan@Cruz', '<script>', 'a'.repeat(101), 'Juan2', "Ana'-Bo"]) {
    assert.strictEqual(parseName(bad), null, bad);
  }
});

test('parseName: rejects control characters, null bytes and non-strings', () => {
  for (const bad of ['Juan\0Cruz', 'Juan\tCruz', 'Juan\nCruz', 'Juan\u0007', undefined, null, 5, {}]) {
    assert.strictEqual(parseName(bad), null);
  }
});

test('parseEmail: valid examples', () => {
  assert.strictEqual(parseEmail('dan@test.com'), 'dan@test.com');
  assert.strictEqual(parseEmail('dan.nobleza+portal@mail.co.ph'), 'dan.nobleza+portal@mail.co.ph');
});

test('parseEmail: trims and lowercases', () => {
  assert.strictEqual(parseEmail('DAN@TEST.COM'), 'dan@test.com');
  assert.strictEqual(parseEmail('  Dan@Test.Com  '), 'dan@test.com');
});

test('parseEmail: invalid examples', () => {
  for (const bad of [
    'dan@', '@test.com', 'dan@test', 'dan@@test.com', 'dan test@x.com',
    'dan..n@test.com', '.dan@test.com', 'dan@-test.com',
  ]) {
    assert.strictEqual(parseEmail(bad), null, bad);
  }
});

test('parseEmail: length limits (254 total, 64 local part)', () => {
  const local64 = 'a'.repeat(64);
  assert.strictEqual(parseEmail(`${local64}@test.com`), `${local64}@test.com`);
  assert.strictEqual(parseEmail(`${'a'.repeat(65)}@test.com`), null);

  // 63-char labels keep each label legal so only the 254 total limit is tested.
  const label = 'b'.repeat(63);
  const at254 = `a@${label}.${label}.${label}.${'c'.repeat(56)}.com`;
  assert.strictEqual(at254.length, 254);
  assert.strictEqual(parseEmail(at254), at254);
  assert.strictEqual(parseEmail(`x${at254}`), null);
});

test('parseEmail: rejects control characters, null bytes and non-strings', () => {
  for (const bad of ['dan\0@test.com', 'dan@test.com\n', 'da\tn@test.com', undefined, null, 5, {}]) {
    assert.strictEqual(parseEmail(bad), null);
  }
});

test('parseMobile: valid examples all normalize to +639XXXXXXXXX', () => {
  for (const ok of ['09171234567', '+639171234567', '639171234567', '0917 123 4567', '0917-123-4567', '(0917) 123-4567']) {
    assert.strictEqual(parseMobile(ok), '+639171234567', ok);
  }
});

test('parseMobile: invalid examples', () => {
  for (const bad of ['9171234567', '0817123456', '091712345', '0917123456789', '+63 817 123 4567', '09abc234567', '']) {
    assert.strictEqual(parseMobile(bad), null, JSON.stringify(bad));
  }
});

test('parseMobile: rejects other symbols, control characters and non-strings', () => {
  for (const bad of ['0917.123.4567', '0917#1234567', '0917\t1234567', '0917\n1234567', '0917\u00001234567', undefined, null, 9171234567]) {
    assert.strictEqual(parseMobile(bad), null);
  }
});

test('passwordProblem: valid passwords', () => {
  assert.strictEqual(passwordProblem('12345678'), null);
  assert.strictEqual(passwordProblem('        '), null, 'spaces count, password is not trimmed');
  assert.strictEqual(passwordProblem('a'.repeat(72)), null);
});

test('passwordProblem: too short', () => {
  assert.strictEqual(passwordProblem(''), 'tooShort');
  assert.strictEqual(passwordProblem('1234567'), 'tooShort');
});

test('passwordProblem: 72 is a limit in BYTES, not characters', () => {
  assert.strictEqual(passwordProblem('a'.repeat(73)), 'tooLong');
  // 36 two-byte characters = 72 bytes (ok), 37 = 74 bytes (too long), yet both are < 72 characters.
  assert.strictEqual(passwordProblem('é'.repeat(36)), null);
  assert.strictEqual(passwordProblem('é'.repeat(37)), 'tooLong');
});

test('passwordProblem: control characters, null bytes and non-strings are invalid', () => {
  for (const bad of ['password\0', 'pass\tword1', 'password1\n', undefined, null, 12345678, {}]) {
    assert.strictEqual(passwordProblem(bad), 'invalid');
  }
});
