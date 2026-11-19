const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config/env');

// Pinned so a token can't pick its own algorithm (e.g. "none").
const ALGORITHM = 'HS256';

// Payload is only { sub, role }. Role is a hint: requireRole re-reads it from the DB.
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: jwtExpires,
  });
}

// Throws a jsonwebtoken error if the token is bad or expired. The caller turns that into a 401.
function verifyToken(token) {
  return jwt.verify(token, jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
