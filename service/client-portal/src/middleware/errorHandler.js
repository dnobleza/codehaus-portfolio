const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Express recognises error middleware by its 4 arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Malformed JSON body or body over the 10kb limit: client mistakes, not 500s.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }

  // Unknown error: log the detail, never leak it to the client.
  logger.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
