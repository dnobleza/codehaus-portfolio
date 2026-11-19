// Thrown for expected failures (bad input, not found, forbidden). errorHandler
// returns its message to the client; any other error type is hidden as a 500.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
