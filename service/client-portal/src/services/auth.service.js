const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const userModel = require('../models/user.model');
const toPublicUser = require('../utils/toPublicUser');
const { signToken, verifyToken } = require('../utils/token');
const { UUID } = require('../utils/regex');
const {
  isNonEmptyString,
  parseName,
  parseEmail,
  parseMobile,
  passwordProblem,
  PASSWORD_MAX_BYTES,
} = require('../utils/validation');

const BCRYPT_COST = 10;

// Compared against when the account doesn't exist, so a missing account costs
// the same time as a wrong password and timing can't reveal which accounts exist.
// Computed once at load, with the same cost as real hashes.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', BCRYPT_COST);

const invalidCredentials = () => new AppError(401, 'Invalid credentials');
const unauthorized = () => new AppError(401, 'Unauthorized');

async function register(body) {
  // Only these four fields are ever read. Anything else in the body is ignored.
  const { name, mobile, email, password } = body ?? {};

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(mobile) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(password, { trim: false })
  ) {
    throw new AppError(400, 'Name, mobile, email and password are required');
  }

  const cleanName = parseName(name);
  if (!cleanName) throw new AppError(400, 'Invalid name');

  const cleanEmail = parseEmail(email);
  if (!cleanEmail) throw new AppError(400, 'Invalid email format');

  const cleanMobile = parseMobile(mobile);
  if (!cleanMobile) throw new AppError(400, 'Invalid mobile number');

  const problem = passwordProblem(password);
  if (problem === 'invalid') throw new AppError(400, 'Invalid password');
  if (problem === 'tooShort') throw new AppError(400, 'Password must be at least 8 characters');
  if (problem === 'tooLong') {
    throw new AppError(400, `Password must be at most ${PASSWORD_MAX_BYTES} bytes`);
  }

  // Friendly early check. The unique constraints below are the real guarantee.
  if (await userModel.findByEmail(cleanEmail)) {
    throw new AppError(409, 'Email already registered');
  }
  if (await userModel.findByMobile(cleanMobile)) {
    throw new AppError(409, 'Mobile number already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const data = { name: cleanName, mobile: cleanMobile, email: cleanEmail, passwordHash };

  let user;
  try {
    // role comes AFTER ...data so nothing in the request can override it.
    user = await userModel.createUser({ ...data, role: 'client' });
  } catch (err) {
    // Two parallel requests can both pass the check above; the database stops the second.
    if (err.code === 'P2002') {
      // Look up instead of reading err.meta, whose shape differs between Prisma drivers.
      if (await userModel.findByEmail(cleanEmail)) {
        throw new AppError(409, 'Email already registered');
      }
      throw new AppError(409, 'Mobile number already registered');
    }
    throw err;
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

async function login(body) {
  const { identifier, password } = body ?? {};

  if (!isNonEmptyString(identifier) || !isNonEmptyString(password, { trim: false })) {
    throw new AppError(400, 'Identifier and password are required');
  }

  // Same parsers as registration: one definition of "valid email" and "valid mobile".
  const email = parseEmail(identifier);
  const mobile = email ? null : parseMobile(identifier);

  let user = null;
  if (email) user = await userModel.findByEmail(email);
  else if (mobile) user = await userModel.findByMobile(mobile);

  // Always run exactly one bcrypt compare, even for a malformed identifier.
  // bcrypt only reads 72 bytes, so a longer password could match a stored
  // prefix. Real passwords are capped at 72 on register; reject longer ones here.
  const withinLimit = Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES;
  const matches = await bcrypt.compare(
    withinLimit ? password : '',
    user ? user.passwordHash : DUMMY_HASH
  );

  if (!user || !withinLimit || !matches) throw invalidCredentials();

  return { token: signToken(user), user: toPublicUser(user) };
}

// Used by requireAuth. Every failure is the same 401 so callers learn nothing.
async function getUserFromToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized();
  }

  if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw unauthorized();

  // Re-read from the DB: a deleted user's token must stop working immediately.
  const user = await userModel.findById(payload.sub);
  if (!user) throw unauthorized();

  return user;
}

module.exports = { register, login, getUserFromToken };
