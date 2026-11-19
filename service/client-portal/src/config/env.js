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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  errors.push('DATABASE_URL is required');
} else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  errors.push('DATABASE_URL must start with postgres:// or postgresql://');
}

// Tests create and delete users. Refuse to run them against anything that is
// not clearly a test database. Never print the URL: it contains credentials.
if (nodeEnv === 'test' && databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl)) {
  let dbName = '';
  try {
    dbName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    // Unparseable URL: dbName stays empty and fails the check below.
  }
  if (!dbName.endsWith('_test')) {
    errors.push('DATABASE_URL must point to a database whose name ends with _test when NODE_ENV is test');
  }
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  errors.push('JWT_SECRET is required');
} else if (jwtSecret.length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters');
}

// jsonwebtoken reads a digit-only string as milliseconds, which is a trap.
// So digits alone become a number of seconds; otherwise require a unit.
const rawJwtExpires = process.env.JWT_EXPIRES || '1d';
let jwtExpires = rawJwtExpires;
if (/^\d+$/.test(rawJwtExpires)) {
  jwtExpires = Number(rawJwtExpires);
  if (jwtExpires < 1) {
    errors.push('JWT_EXPIRES must be greater than 0');
  }
} else if (!/^[1-9]\d*[smhd]$/.test(rawJwtExpires)) {
  errors.push('JWT_EXPIRES must be seconds (3600) or a number with a unit s, m, h or d (e.g. 15m, 1d)');
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
  databaseUrl,
  jwtSecret,
  jwtExpires,
  logLevel,
  trustProxy,
  corsOrigins,
  isProduction: nodeEnv === 'production',
});
