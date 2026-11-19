// Shared by DB-backed tests. Safe by construction: env.js refuses to load when
// NODE_ENV is "test" and the database name does not end with _test.
const prisma = require('../../src/config/db');

// Every user a test creates uses this domain, so cleanup can't touch anything else.
const TEST_DOMAIN = '@authtest.example';

const cleanUsers = () => prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });

let counter = 0;

// A valid, unique register body. Pass overrides to break one field.
function validBody(overrides = {}) {
  counter += 1;
  return {
    name: 'Juan Dela Cruz',
    mobile: `09990${String(counter).padStart(6, '0')}`,
    email: `user${counter}${TEST_DOMAIN}`,
    password: 'correct-horse-battery',
    ...overrides,
  };
}

module.exports = { prisma, TEST_DOMAIN, cleanUsers, validBody };
