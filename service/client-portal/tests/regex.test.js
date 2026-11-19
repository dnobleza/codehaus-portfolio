const { test } = require('node:test');
const assert = require('node:assert');
const { CONTROL_CHARS, NAME, EMAIL, MOBILE_STRIP, MOBILE, UUID } = require('../src/utils/regex');

test('CONTROL_CHARS matches null bytes, tabs and newlines but not normal text', () => {
  for (const bad of ['a\0b', 'a\tb', 'a\nb', '\u0007']) assert.ok(CONTROL_CHARS.test(bad));
  for (const ok of ['Juan Cruz', 'Niño', 'a b']) assert.ok(!CONTROL_CHARS.test(ok));
});

test('NAME accepts letters joined by single separators', () => {
  for (const ok of ['Juan', "D'Souza", 'Maria-Clara', 'Jr.', 'J. Rizal', 'Niño', 'Niño']) {
    assert.ok(NAME.test(ok), ok);
  }
});

test('NAME rejects digits, symbols, leading or doubled punctuation', () => {
  for (const bad of ['1234', '--Juan', 'Ana--Bo', 'Jr..', "Ana'-Bo", 'Juan@Cruz', '<script>', 'Ana ', ' Ana']) {
    assert.ok(!NAME.test(bad), bad);
  }
});

test('EMAIL accepts normal addresses', () => {
  for (const ok of ['dan@test.com', 'dan.nobleza+portal@mail.co.ph', 'a@b-c.io']) {
    assert.ok(EMAIL.test(ok), ok);
  }
});

test('EMAIL rejects malformed addresses', () => {
  const bad = [
    'dan@', '@test.com', 'dan@test', 'dan@@test.com', 'dan test@x.com', 'dan..n@test.com',
    '.dan@test.com', 'dan.@test.com', 'dan@-test.com', 'dan@test-.com', 'dan@.test.com',
    'dan@test..com', 'dan@test.c', 'dan@test.c0m',
  ];
  for (const b of bad) assert.ok(!EMAIL.test(b), b);
});

test('MOBILE_STRIP removes only spaces, dashes and parentheses', () => {
  assert.strictEqual('(0917) 123-4567'.replace(MOBILE_STRIP, ''), '09171234567');
  assert.strictEqual('0917\t1234567'.replace(MOBILE_STRIP, ''), '0917\t1234567');
});

test('MOBILE matches the three accepted forms and captures the last 9 digits', () => {
  for (const ok of ['09171234567', '+639171234567', '639171234567']) {
    assert.strictEqual(MOBILE.exec(ok)[1], '171234567', ok);
  }
});

test('MOBILE rejects wrong prefixes and lengths', () => {
  for (const bad of ['9171234567', '0817123456', '091712345', '0917123456789', '+638171234567', '']) {
    assert.ok(!MOBILE.test(bad), bad);
  }
});

test('UUID matches a v4 uuid and nothing else', () => {
  assert.ok(UUID.test('123e4567-e89b-12d3-a456-426614174000'));
  for (const bad of ['', 'abc', '123e4567e89b12d3a456426614174000', "1' OR '1'='1"]) {
    assert.ok(!UUID.test(bad), bad);
  }
});
