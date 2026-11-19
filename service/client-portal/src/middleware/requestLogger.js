const logger = require('../utils/logger');

// Log on 'finish' so the status code and duration are known.
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}

module.exports = requestLogger;
