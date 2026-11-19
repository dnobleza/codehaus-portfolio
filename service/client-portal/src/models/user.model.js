// All users-table access. No business rules and no AppError here.
const prisma = require('../config/db');

function createUser(data) {
  return prisma.user.create({ data });
}

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findByMobile(mobile) {
  return prisma.user.findUnique({ where: { mobile } });
}

function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

module.exports = { createUser, findByEmail, findByMobile, findById };
