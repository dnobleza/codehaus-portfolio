// Patterns only. The functions that use them live in validation.js.

// Any control character, including null bytes, tabs and newlines.
const CONTROL_CHARS = /\p{Cc}/u;

// Starts with a letter (combining marks allowed so decomposed accents work).
// Words are joined by ONE separator: a space, apostrophe, hyphen or period.
// Because a separator must be followed by a letter, "--Juan", "Ana--Bo" and
// "Jr.." are rejected. A period may be followed by one space ("J. Rizal") and
// may end the name ("Jr.").
const NAME = /^(?:\p{L}\p{M}*)+(?:(?:[ '-]|\. ?)(?:\p{L}\p{M}*)+)*\.?$/u;

// Local part: dot-separated atoms, so no leading, trailing or double dots.
// Domain: labels of letters, digits and inner hyphens, then a TLD of 2+ letters.
const EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Only these separators are stripped from a mobile number before matching.
// \s is avoided on purpose so a tab or newline is not silently accepted.
const MOBILE_STRIP = /[ ()-]/g;

// 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX. Group 1 is the 9 digits after the 9.
const MOBILE = /^(?:\+639|639|09)(\d{9})$/;

// Guards findById: the id column is a UUID, and Postgres errors on anything else.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = { CONTROL_CHARS, NAME, EMAIL, MOBILE_STRIP, MOBILE, UUID };
