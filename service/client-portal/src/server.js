// env.js throws on bad config. The logger depends on env.js too, so on that
// failure we can only print with console.error before exiting.
let config;
try {
  config = require('./config/env');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require('./app');
const logger = require('./utils/logger');
const prisma = require('./config/db');

const SHUTDOWN_TIMEOUT_MS = 10000;

process.on('unhandledRejection', (reason) => {
  logger.error(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error(err);
  process.exit(1);
});

let server;

// With the pg adapter the client connects lazily, so run a real query at
// startup to fail fast on a bad DATABASE_URL or a stopped database.
async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
  logger.info('Database connected');

  // No callback on listen(): in Express 5 it receives listen errors, which would
  // bypass the 'error' handler below.
  server = app.listen(config.port);

  server.on('listening', () => {
    logger.info(`Server running on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use`);
    } else {
      logger.error(err);
    }
    process.exit(1);
  });
}

function shutdown() {
  logger.info('Shutting down...');

  // Force exit if open connections never drain. unref so it doesn't keep the process alive.
  setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  // Signal can arrive before startup finished listening.
  if (!server) {
    process.exit(0);
  }

  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
