const { CONTROL_CHARS, NAME, EMAIL, MOBILE_STRIP, MOBILE } = require('./regex');

const NAME_MIN = 2;
const NAME_MAX = 100;
const EMAIL_MAX = 254;
const EMAIL_LOCAL_MAX = 64;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

// Counts characters, not UTF-16 units, so an emoji or astral letter counts once.
const charCount = (value) => [...value].length;

// trim: true  -> "   " counts as empty (name, mobile, email, identifier)
// trim: false -> only "" is empty (password, which is never trimmed)
function isNonEmptyString(value, { trim = true } = {}) {
  if (typeof value !== 'string') return false;
  return (trim ? value.trim() : value).length > 0;
}

// Each parse function returns the normalized value to store, or null if invalid.
// Callers never need to normalize again, so there is one source of truth.

function parseName(value) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return null;
  const name = value.trim().replace(/\s+/g, ' ');
  const length = charCount(name);
  if (length < NAME_MIN || length > NAME_MAX) return null;
  return NAME.test(name) ? name : null;
}

function parseEmail(value) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return null;
  const email = value.trim().toLowerCase();
  if (email.length > EMAIL_MAX) return null;
  if (!EMAIL.test(email)) return null;
  // The pattern guarantees exactly one "@", so the split is safe.
  if (email.indexOf('@') > EMAIL_LOCAL_MAX) return null;
  return email;
}

function parseMobile(value) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return null;
  const match = MOBILE.exec(value.trim().replace(MOBILE_STRIP, ''));
  return match ? `+639${match[1]}` : null;
}

// Returns null when valid, otherwise why it is not.
function passwordProblem(value) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) return 'invalid';
  if (charCount(value) < PASSWORD_MIN) return 'tooShort';
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) return 'tooLong';
  return null;
}

module.exports = {
  isNonEmptyString,
  parseName,
  parseEmail,
  parseMobile,
  passwordProblem,
  PASSWORD_MAX_BYTES,
};
