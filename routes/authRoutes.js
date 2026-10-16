/**
 * NovaCare Hospital Management System - Authentication Routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.post(
  '/login',
  validateBody(['username', 'password']),
  authController.login
);

router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/logout', verifyToken, authController.logout);

router.post(
  '/register',
  verifyToken,
  requireRoles('ADMIN'),
  validateBody(['username', 'email', 'password', 'full_name', 'role']),
  authController.registerUser
);

module.exports = router;
