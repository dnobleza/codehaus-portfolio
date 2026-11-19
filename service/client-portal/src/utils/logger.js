const winston = require('winston');
const config = require('../config/env');

const { combine, timestamp, colorize, printf, errors, json } = winston.format;

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
});

// Colors only in dev: escape codes would pollute production log files.
const devFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'HH:mm:ss' }),
  colorize(),
  printf(({ timestamp: time, level, message, stack }) =>
    stack ? `${time} ${level}: ${message}\n${stack}` : `${time} ${level}: ${message}`
  )
);

const prodFormat = combine(errors({ stack: true }), timestamp(), json());

const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

module.exports = logger;
