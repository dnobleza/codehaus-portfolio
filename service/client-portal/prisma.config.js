// Prisma CLI config (migrate, generate). Prisma 7 no longer loads .env itself.
// Tooling only, not app code: the app reads config through src/config/env.js.
const fs = require('node:fs');
const { defineConfig, env } = require('prisma/config');

// In CI the variable is already set and there is no .env file.
if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
