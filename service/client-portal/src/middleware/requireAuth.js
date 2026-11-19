const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');
const toPublicUser = require('../utils/toPublicUser');

const BEARER = /^Bearer (\S+)$/;

// Identity comes only from the verified token. Sets req.user (public fields only).
async function requireAuth(req, res, next) {
  try {
    const match = BEARER.exec(req.headers.authorization ?? '');
    if (!match) throw new AppError(401, 'Unauthorized');

    const user = await authService.getUserFromToken(match[1]);
    req.user = toPublicUser(user);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
