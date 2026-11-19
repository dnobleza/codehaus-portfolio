// The only way a user leaves the API. Explicit allow-list, so a new column
// (like passwordHash) can never leak by accident.
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

module.exports = toPublicUser;
