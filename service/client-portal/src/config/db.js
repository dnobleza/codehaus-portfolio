// One shared Prisma client. Prisma 7 needs a driver adapter; the adapter owns
// the pg connection pool.
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { databaseUrl } = require('./env');

const adapter = new PrismaPg({ connectionString: databaseUrl });

module.exports = new PrismaClient({ adapter });
