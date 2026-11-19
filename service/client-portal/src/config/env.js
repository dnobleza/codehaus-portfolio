// The ONLY file allowed to read process.env. Everything else imports from here,
// so a missing or malformed variable fails once, at startup, with a clear message.

const NODE_ENVS = ['development', 'production', 'test'];
const LOG_LEVELS = ['error', 'warn', 'info', 'debug'];

const errors = [];

const port = Number(process.env.PORT);
if (!process.env.PORT) {
  errors.push('PORT is required');
} else if (!Number.isInteger(port) || port < 1 || port > 65535) {
  errors.push('PORT must be an integer between 1 and 65535');
}

const nodeEnv = process.env.NODE_ENV;
if (!nodeEnv) {
  errors.push('NODE_ENV is required');
} else if (!NODE_ENVS.includes(nodeEnv)) {
  errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
}

const logLevel = process.env.LOG_LEVEL || 'info';
if (!LOG_LEVELS.includes(logLevel)) {
  errors.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
}

// Express accepts a boolean or a hop count. Anything else (like a bare
// string) would be read as an IP/subnet list, which we don't want by accident.
const rawTrustProxy = process.env.TRUST_PROXY || 'false';
let trustProxy = false;
if (rawTrustProxy === 'true') {
  trustProxy = true;
} else if (rawTrustProxy !== 'false') {
  trustProxy = Number(rawTrustProxy);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    errors.push('TRUST_PROXY must be true, false, or a non-negative integer');
  }
}

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (errors.length > 0) {
  throw new Error(`Invalid environment:\n - ${errors.join('\n - ')}`);
}

module.exports = Object.freeze({
  port,
  nodeEnv,
  logLevel,
  trustProxy,
  corsOrigins,
  isProduction: nodeEnv === 'production',
});
