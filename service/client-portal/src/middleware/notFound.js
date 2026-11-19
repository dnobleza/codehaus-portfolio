const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'Not found'));
}

module.exports = notFound;
