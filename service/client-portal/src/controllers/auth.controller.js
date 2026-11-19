// No rules here: read the request, call the service, send the response.
const authService = require('../services/auth.service');

async function register(req, res) {
  const { token, user } = await authService.register(req.body);
  res.status(201).json({ message: 'Registration successful', token, user });
}

async function login(req, res) {
  const { token, user } = await authService.login(req.body);
  res.status(200).json({ message: 'Login successful', token, user });
}

// req.user was set by requireAuth from the verified token.
function me(req, res) {
  res.status(200).json({ user: req.user });
}

module.exports = { register, login, me };
